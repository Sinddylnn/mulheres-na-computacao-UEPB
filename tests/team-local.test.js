import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createTeamServer, saveMember } from '../tools/equipe/server.js';
import { parseMembers, parseMember } from '../js/pages/team-admin/model.js';

const PAGE = `<main>
        <div class="team-grid-scroll">
          <article class="card team-member reveal reveal-delay-1">
            <div class="member-avatar" aria-hidden="true"><img src="../imagens/equipe/ana.webp" alt="" loading="lazy" decoding="async"></div>
            <h3>Ana</h3>
            <p>Coordenadora</p>
          </article>
        </div>
</main>
`;
// Cabeçalho mínimo de um WebP: basta para o servidor reconhecer o formato.
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 '), Buffer.alloc(16, 1)]);

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'mnc-equipe-test-'));
  await mkdir(path.join(root, 'paginas'), { recursive: true });
  await mkdir(path.join(root, 'imagens/equipe'), { recursive: true });
  await writeFile(path.join(root, 'paginas/equipe.html'), PAGE);
  await writeFile(path.join(root, 'imagens/equipe/ana.webp'), 'foto-antiga');
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}
const page = root => readFile(path.join(root, 'paginas/equipe.html'), 'utf8');

test('salvar inclui o card e a foto nova sem mexer no que já existe', async t => {
  const root = await fixture(t);
  const saved = await saveMember(root, { member: { name: 'Bia Souza', role: 'Monitora', bio: '', social: {} }, photo: WEBP.toString('base64') });
  assert.match(saved.photo, /^imagens\/equipe\/bia-souza-[0-9a-f]{8}\.webp$/);
  assert.deepEqual(await readFile(path.join(root, saved.photo)), WEBP);
  assert.equal(await readFile(path.join(root, 'imagens/equipe/ana.webp'), 'utf8'), 'foto-antiga');
  const members = parseMembers(await page(root));
  assert.deepEqual(members.map(member => member.name), ['Ana', 'Bia Souza']);
  assert.equal(parseMember(members[1].block).photo, saved.photo);
});

test('editar mantém a foto atual quando nenhuma foto nova é enviada', async t => {
  const root = await fixture(t);
  await saveMember(root, { original: 'Ana', member: { name: 'Ana', role: 'Coordenadora geral', bio: 'Oi', social: {} } });
  const [ana] = parseMembers(await page(root));
  assert.equal(parseMember(ana.block).photo, 'imagens/equipe/ana.webp');
  assert.equal(parseMember(ana.block).role, 'Coordenadora geral');
  assert.deepEqual(await readdir(path.join(root, 'imagens/equipe')), ['ana.webp']);
});

test('dados inválidos são recusados sem gravar nada', async t => {
  const root = await fixture(t);
  await assert.rejects(saveMember(root, { member: { name: 'Ana', social: {} }, photo: WEBP.toString('base64') }), /Já existe/);
  await assert.rejects(saveMember(root, { member: { name: 'Cris', social: {} }, photo: Buffer.from('não é imagem').toString('base64') }), /foto/);
  await assert.rejects(saveMember(root, { member: { name: 'Cris', social: {} } }), /foto/);
  assert.equal(await page(root), PAGE);
  assert.deepEqual(await readdir(path.join(root, 'imagens/equipe')), ['ana.webp']);
});

test('o servidor exige o token da sessão e recusa outras origens', async t => {
  const root = await fixture(t);
  const server = await createTeamServer(root);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;

  const session = await (await fetch(`${base}/api/equipe`)).json();
  assert.equal(session.html, PAGE);
  const body = JSON.stringify({ member: { name: 'Bia', social: {} }, photo: WEBP.toString('base64') });
  const post = headers => fetch(`${base}/api/equipe`, { method: 'POST', body, headers: { 'Content-Type': 'application/json', ...headers } });

  assert.equal((await post({})).status, 403);
  assert.equal((await post({ 'X-Equipe-Token': session.token, Origin: 'https://exemplo.com' })).status, 403);
  assert.equal(await page(root), PAGE);

  const response = await post({ 'X-Equipe-Token': session.token, Origin: base });
  assert.equal(response.status, 200);
  assert.deepEqual(parseMembers(await page(root)).map(member => member.name), ['Ana', 'Bia']);

  const redirect = await fetch(`${base}/`, { redirect: 'manual' });
  assert.equal(redirect.status, 302);
  assert.equal(redirect.headers.get('location'), '/paginas/area-da-equipe/cadastro-equipe.html');
});
