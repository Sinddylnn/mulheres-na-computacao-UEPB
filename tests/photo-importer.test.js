import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, readFile, writeFile, readdir, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { createImporter } from '../tools/fotos/importer.js';
import { createPhotoServer } from '../tools/fotos/server.js';

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'mnc-import-test-'));
  await mkdir(path.join(root, 'data/galeria'), { recursive: true });
  const existing = [{ categoria: 'escolas', data: '2024', caminho_relativo: 'escolas/2024',
    fotos: ['antiga.jpg'], metadados: { 'antiga.jpg': { largura: 800, altura: 600, miniatura: 'escolas/2024/antiga.jpg' } }, observacao: 'preservar' }];
  const before = JSON.stringify(existing, null, 4) + '\n';
  await writeFile(path.join(root, 'data/galeria/timeline.json'), before);
  for (const kind of ['fotos', 'miniaturas', 'originais']) {
    await mkdir(path.join(root, 'data/galeria', kind, 'escolas/2024'), { recursive: true });
    await writeFile(path.join(root, 'data/galeria', kind, 'escolas/2024/antiga.jpg'), `arquivo-${kind}`);
  }
  const importer = await createImporter(root);
  t.after(async () => { await importer.close(); await rm(root, { recursive: true, force: true }); });
  const bytes = await sharp({ create: { width: 2400, height: 1200, channels: 3, background: '#7fb8ad' } }).png().toBuffer();
  const selection = { category: 'escolas', year: '2024', files: [{ name: 'Visita à escola.png', bytes }] };
  return { root, importer, before, existing, selection, bytes };
}
const manifest = root => readFile(path.join(root, 'data/galeria/timeline.json'), 'utf8');
async function preserved(root) {
  for (const kind of ['fotos', 'miniaturas', 'originais']) {
    assert.equal(await readFile(path.join(root, 'data/galeria', kind, 'escolas/2024/antiga.jpg'), 'utf8'), `arquivo-${kind}`);
  }
}

test('a prévia não escreve no acervo; a confirmação acrescenta WebP, miniatura e original sem mudar o restante', async t => {
  const { root, importer, before, existing, selection, bytes } = await fixture(t);
  const plan = await importer.preview(selection);
  assert.equal(await manifest(root), before);
  assert.deepEqual(await readdir(path.join(root, 'data/galeria/fotos/escolas/2024')), ['antiga.jpg']);
  await assert.rejects(access(path.join(root, '.mnc-fotos-backups')));
  const thumb = await sharp(await importer.thumbnail(plan.id, 0)).metadata();
  assert.equal(thumb.format, 'webp');
  assert.deepEqual([thumb.width, thumb.height], [480, 240]);
  const result = await importer.commit(plan.id);
  const after = JSON.parse(await manifest(root));
  const photo = plan.photos[0];
  assert.deepEqual(after[0].fotos, ['antiga.jpg', photo.output]);
  assert.deepEqual(after[0].metadados['antiga.jpg'], existing[0].metadados['antiga.jpg']);
  assert.equal(after[0].observacao, 'preservar');
  assert.equal(after.length, 1);
  assert.equal(await readFile(path.join(root, result.backup), 'utf8'), before);
  assert.deepEqual(await readFile(path.join(root, 'data/galeria/originais/escolas/2024', photo.original)), bytes);
  const full = await sharp(await readFile(path.join(root, 'data/galeria/fotos/escolas/2024', photo.output))).metadata();
  assert.equal(full.format, 'webp');
  assert.deepEqual([full.width, full.height], [1600, 800]);
  await preserved(root);
  assert.deepEqual(await importer.commit(plan.id), result);
  assert.equal(JSON.parse(await manifest(root))[0].fotos.length, 2);
  await assert.rejects(importer.preview(selection), /já importada/);
});

test('cancelar e recusar arquivos inválidos não altera o cadastro nem as fotos', async t => {
  const { root, importer, before, selection } = await fixture(t);
  const plan = await importer.preview(selection);
  await importer.cancel(plan.id);
  await assert.rejects(importer.commit(plan.id), /Prévia não encontrada/);
  await assert.rejects(importer.preview({ ...selection, files: [...selection.files, { name: 'quebrada.jpg', bytes: Buffer.from('inválido') }] }), /não foi possível abrir/);
  await assert.rejects(importer.preview({ ...selection, files: [...selection.files, ...selection.files] }), /foto repetida/);
  await assert.rejects(importer.preview({ ...selection, category: '../escolas' }), /categoria válida/);
  await assert.rejects(importer.preview({ ...selection, date: '2024-01-01' }), /somente por ano/);
  await assert.rejects(importer.preview({ ...selection, category: 'encontros', date: '2024-02-30' }), /data do encontro/);
  assert.equal(await manifest(root), before);
  await preserved(root);
});

test('mudanças externas no cadastro e bloqueios de outra importação impedem a confirmação', async t => {
  const { root, importer, before, selection } = await fixture(t);
  const plan = await importer.preview(selection);
  const edited = before + '\n';
  await writeFile(path.join(root, 'data/galeria/timeline.json'), edited);
  await assert.rejects(importer.commit(plan.id), /galeria mudou/);
  assert.equal(await manifest(root), edited);
  await writeFile(path.join(root, 'data/galeria/timeline.json'), before);
  await writeFile(path.join(root, 'data/galeria/.fotos-import.lock'), 'outra operação');
  await assert.rejects(importer.commit(plan.id), /Outra importação/);
  assert.equal(await readFile(path.join(root, 'data/galeria/.fotos-import.lock'), 'utf8'), 'outra operação');
  await preserved(root);
});

test('falha após gravar uma foto reverte somente os novos arquivos, sem apagar uma colisão existente', async t => {
  const { root, importer, before, selection } = await fixture(t);
  const plan = await importer.preview(selection);
  const output = plan.photos[0].output;
  await writeFile(path.join(root, 'data/galeria/miniaturas/escolas/2024', output), 'arquivo-existente');
  await assert.rejects(importer.commit(plan.id), { code: 'EEXIST' });
  await assert.rejects(access(path.join(root, 'data/galeria/fotos/escolas/2024', output)));
  assert.equal(await readFile(path.join(root, 'data/galeria/miniaturas/escolas/2024', output), 'utf8'), 'arquivo-existente');
  assert.equal(await manifest(root), before);
  await preserved(root);
});

test('novo evento preserva os eventos anteriores; orientação e imagens pequenas são respeitadas', async t => {
  const { root, importer, existing } = await fixture(t);
  const bytes = await sharp({ create: { width: 90, height: 60, channels: 3, background: '#8773a4' } })
    .jpeg().withMetadata({ orientation: 6 }).toBuffer();
  const plan = await importer.preview({ category: 'encontros', year: '2025', date: '2025-09-12', files: [{ name: '../../CON.jpg', bytes }] });
  assert.equal(plan.date, '2025-09-12');
  assert.deepEqual([plan.photos[0].width, plan.photos[0].height], [60, 90]);
  assert.doesNotMatch(plan.photos[0].output, /[\\/]/);
  await importer.commit(plan.id);
  const after = JSON.parse(await manifest(root));
  assert.equal(after[0].caminho_relativo, 'encontros/2025-09-12');
  assert.deepEqual(after[1], existing[0]);
  await preserved(root);
});

test('o servidor exige sessão e origem local e permite prévia, confirmação e consulta do cadastro atualizado', async t => {
  const { root, before, bytes } = await fixture(t);
  const { server, importer } = await createPhotoServer(root);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await importer.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(base)).status, 200);
  assert.equal((await fetch(base + '/app.js')).status, 200);
  assert.equal((await fetch(base + '/base.css')).status, 200);
  assert.equal((await fetch(base + '/api/session', { headers: { Origin: 'https://example.com' } })).status, 403);
  const { token } = await (await fetch(base + '/api/session')).json();
  assert.equal((await fetch(base + '/api/commit', { method: 'POST', body: '{}' })).status, 403);
  const form = new FormData();
  form.set('category', 'escolas'); form.set('year', '2025');
  form.append('photos', new Blob([bytes], { type: 'image/png' }), 'nova.png');
  const previewResponse = await fetch(base + '/api/preview', { method: 'POST', headers: { 'X-Import-Token': token }, body: form });
  assert.equal(previewResponse.status, 200);
  const plan = await previewResponse.json();
  assert.equal(await manifest(root), before);
  assert.equal((await fetch(base + plan.photos[0].previewUrl)).status, 200);
  const response = await fetch(base + '/api/commit', { method: 'POST', headers: { 'X-Import-Token': token }, body: JSON.stringify({ id: plan.id }) });
  assert.equal(response.status, 200);
  const listing = await fetch(base + '/site/data/galeria/timeline.json');
  assert.equal(listing.headers.get('cache-control'), 'no-store');
  assert.equal((await listing.json())[0].data, '2025');
  assert.equal((await fetch(base + `/site/data/galeria/fotos/escolas/2025/${plan.photos[0].output}`)).status, 200);
  assert.equal((await fetch(base + `/site/data/galeria/originais/escolas/2025/${plan.photos[0].original}`)).status, 404);
  assert.equal((await fetch(base + '/site/.mnc-fotos-backups/')).status, 404);
  assert.equal((await fetch(base + '/site/tools/fotos/server.js')).status, 404);
  await preserved(root);
});
