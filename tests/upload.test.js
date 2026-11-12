import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { destination, checkBatch, checkTimeline, checkDuplicate, photoStem, addPhotos, fitInside, ImportError }
  from '../js/pages/upload/model.js';
import { createClient, GitHubError } from '../js/pages/admin/github.js';

const repo = { owner: 'dona', name: 'site', branch: 'main' };

test('destino segue as regras de categoria, ano e data', () => {
  assert.deepEqual(destination('escolas', '2025'), { category: 'escolas', date: '2025', folder: 'escolas/2025' });
  assert.equal(destination('encontros', '2026', '2026-05-11').folder, 'encontros/2026-05-11');
  assert.throws(() => destination('escolas', '2025', '2025-01-02'), ImportError);
  assert.throws(() => destination('encontros', '2026', '2025-05-11'), ImportError);
  assert.throws(() => destination('outra', '2026'), ImportError);
});

test('lote respeita quantidade e tamanho', () => {
  assert.throws(() => checkBatch([]), /1 a 20/);
  assert.throws(() => checkBatch([{ name: 'a.jpg', size: 16 * 1024 * 1024 }]), /15 MB/);
  assert.doesNotThrow(() => checkBatch([{ name: 'a.jpg', size: 1000 }]));
});

test('cadastro com metadados em lista é recusado', () => {
  assert.throws(() => checkTimeline([{ fotos: [], metadados: [] }]), ImportError);
  assert.throws(() => checkTimeline({}), ImportError);
});

test('fotos repetidas no lote ou no evento são recusadas', () => {
  const target = destination('encontros', '2026');
  const events = [{ categoria: 'encontros', data: '2026', metadados: { 'x.webp': { sha256: 'abc' } } }];
  assert.throws(() => checkDuplicate(events, target, 'abc', new Set(), 'x.jpg'), /repetida/);
  const seen = new Set();
  checkDuplicate(events, target, 'def', seen, 'y.jpg');
  assert.throws(() => checkDuplicate(events, target, 'def', seen, 'y.jpg'), /repetida/);
});

test('nome gerado é seguro para URL', () => {
  assert.equal(photoStem('C:\\Fotos\\Visitação Ã Escola.JPG', 'a'.repeat(64), 'b'.repeat(36), 0),
    `visitacao-a-escola-${'a'.repeat(12)}-${'b'.repeat(8)}-1`);
});

test('fotos são acrescentadas sem alterar o cadastro original', () => {
  const events = [{ categoria: 'escolas', data: '2024', caminho_relativo: 'escolas/2024', fotos: ['old.jpg'], metadados: { 'old.jpg': {} } }];
  const photo = { output: 'n.webp', width: 10, height: 20, sha256: 'h' };
  const next = addPhotos(events, destination('escolas', '2024'), [photo]);
  assert.deepEqual(events[0].fotos, ['old.jpg']);
  assert.deepEqual(next[0].fotos, ['old.jpg', 'n.webp']);
  assert.deepEqual(next[0].metadados['n.webp'], { largura: 10, altura: 20, miniatura: 'escolas/2024/n.webp', sha256: 'h' });
  const created = addPhotos(events, destination('encontros', '2026'), [photo]);
  assert.equal(created[0].caminho_relativo, 'encontros/2026');
  assert.throws(() => addPhotos(next, destination('escolas', '2024'), [photo]), /já existe/);
});

test('redimensionamento cabe no limite sem ampliar', () => {
  assert.deepEqual(fitInside(4000, 3000, 1600), { width: 1600, height: 1200 });
  assert.deepEqual(fitInside(800, 600, 1600), { width: 800, height: 600 });
});

function fakeFetch(routes) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, method: options.method, body: options.body && JSON.parse(options.body) });
    const key = `${options.method} ${url.replace('https://api.github.com', '')}`;
    const route = Object.entries(routes).find(([pattern]) => key.startsWith(pattern));
    const [status, body] = route ? route[1](calls.at(-1)) : [500, {}];
    return { ok: status < 300, status, json: async () => body, text: async () => body };
  };
  return { fetchImpl, calls };
}

test('publicação cria blobs, árvore e commit e avança o branch sem forçar', async () => {
  let blobs = 0;
  const { fetchImpl, calls } = fakeFetch({
    'GET /repos/dona/site/git/ref/heads/main': () => [200, { object: { sha: 'head' } }],
    'GET /repos/dona/site/git/commits/head': () => [200, { tree: { sha: 'tree' } }],
    'GET /repos/dona/site/contents/data/timeline.json': () => [200, '[]'],
    'POST /repos/dona/site/git/blobs': () => [201, { sha: `blob${++blobs}` }],
    'POST /repos/dona/site/git/trees': () => [201, { sha: 'newtree' }],
    'POST /repos/dona/site/git/commits': () => [201, { sha: 'novo', html_url: 'https://github.com/c/novo' }],
    'PATCH /repos/dona/site/git/refs/heads/main': () => [200, {}]
  });
  const client = createClient('tok', repo, fetchImpl);
  const snapshot = await client.snapshot('data/timeline.json');
  assert.deepEqual(snapshot, { head: 'head', tree: 'tree', content: '[]' });
  const commit = await client.commit(snapshot, [{ path: 'a.webp', base64: 'AA==' }, { path: 'data/timeline.json', text: '[]\n' }], 'msg');
  assert.equal(commit.sha, 'novo');
  const tree = calls.find(call => call.url.endsWith('/git/trees')).body;
  assert.equal(tree.base_tree, 'tree');
  assert.deepEqual(tree.tree.map(entry => entry.path), ['a.webp', 'data/timeline.json']);
  assert.deepEqual(calls.find(call => call.url.endsWith('/git/commits')).body.parents, ['head']);
  assert.deepEqual(calls.at(-1).body, { sha: 'novo', force: false });
});

test('branch alterado durante a publicação devolve false para nova tentativa', async () => {
  const { fetchImpl } = fakeFetch({
    'POST /repos/dona/site/git/blobs': () => [201, { sha: 'b' }],
    'POST /repos/dona/site/git/trees': () => [201, { sha: 't' }],
    'POST /repos/dona/site/git/commits': () => [201, { sha: 'c' }],
    'PATCH /repos/dona/site/git/refs/heads/main': () => [422, {}]
  });
  const client = createClient('tok', repo, fetchImpl);
  assert.equal(await client.commit({ head: 'h', tree: 't' }, [{ path: 'x', text: '' }], 'm'), false);
});

test('token sem permissão de escrita é recusado', async () => {
  const { fetchImpl } = fakeFetch({
    'GET /user': () => [200, { login: 'ana' }],
    'GET /repos/dona/site': () => [200, { permissions: { push: false } }]
  });
  await assert.rejects(createClient('tok', repo, fetchImpl).verify(), GitHubError);
  const invalid = fakeFetch({ 'GET /user': () => [401, {}], 'GET /repos/dona/site': () => [401, {}] });
  await assert.rejects(createClient('tok', repo, invalid.fetchImpl).verify(), /expirado/);
});

test('página de envio fica fora do menu e dos buscadores', async () => {
  const html = await readFile(new URL('../paginas/area-da-equipe/enviar-fotos.html', import.meta.url), 'utf8');
  const header = await readFile(new URL('../header.html', import.meta.url), 'utf8');
  assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
  assert.match(html, /<body data-page="upload">/);
  assert.doesNotMatch(header, /enviar-fotos/);
});
