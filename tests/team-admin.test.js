import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseMembers, parseMember, renderMember, validateMember, upsertMember, photoPath, TeamError }
  from '../js/pages/team-admin/model.js';
import { createClient, publishWithRetry } from '../js/pages/admin/github.js';

const page = await readFile(new URL('../paginas/equipe.html', import.meta.url), 'utf8');

test('todos os cards atuais são lidos e reescritos sem diferença', () => {
  const members = parseMembers(page);
  assert.ok(members.length > 0);
  for (const member of members) {
    const data = parseMember(member.block);
    assert.equal(renderMember(data, { open: data.open, pin: data.pin }), member.block, member.name);
  }
});

test('card fixado mantém o marcador e a classe', () => {
  const fixed = parseMembers(page).map(member => parseMember(member.block)).find(member => member.fixed);
  assert.ok(fixed?.pin.includes('member-pin'));
  const html = upsertMember(page, { ...fixed, bio: 'Nova apresentação.' }, fixed.name);
  const updated = parseMember(parseMembers(html).find(member => member.name === fixed.name).block);
  assert.equal(updated.fixed, true);
  assert.equal(updated.bio, 'Nova apresentação.');
  assert.equal(updated.photo, fixed.photo);
});

test('nova integrante entra no fim da grade, com texto escapado', () => {
  const member = { ...validateMember({ name: 'Ana <b>', bio: 'Gosto de C & café.', social: { github: 'https://github.com/ana' } }),
    photo: 'imagens/equipe/ana-12345678.webp' };
  const html = upsertMember(page, member);
  const members = parseMembers(html);
  assert.equal(members.length, parseMembers(page).length + 1);
  const added = members.at(-1);
  assert.equal(added.name, 'Ana <b>');
  assert.match(added.block, /<h3>Ana &lt;b&gt;<\/h3>/);
  assert.match(added.block, /C &amp; café/);
  assert.deepEqual(parseMember(added.block).social, { github: 'https://github.com/ana' });
  assert.doesNotMatch(html, /\r/);
});

test('nome repetido, card sumido e card novo sem foto são recusados', () => {
  const [first, second] = parseMembers(page);
  assert.throws(() => upsertMember(page, { name: first.name.toUpperCase(), photo: 'x.webp' }), /Já existe/);
  assert.throws(() => upsertMember(page, { name: first.name }, second.name), /Já existe/);
  assert.throws(() => upsertMember(page, { name: 'Zé' }, 'Ninguém'), /não está mais/);
  assert.throws(() => upsertMember(page, { name: 'Zé' }), /foto/);
  assert.doesNotThrow(() => upsertMember(page, { name: first.name }, first.name));
});

test('links de redes sociais precisam ser https da rede certa', () => {
  assert.deepEqual(validateMember({ name: ' Ana  Maria ', social: { linkedin: 'https://br.linkedin.com/in/ana' } }),
    { name: 'Ana Maria', role: '', bio: '', social: { linkedin: 'https://br.linkedin.com/in/ana' } });
  assert.throws(() => validateMember({ name: 'Ana', social: { instagram: 'http://instagram.com/ana' } }), TeamError);
  assert.throws(() => validateMember({ name: 'Ana', social: { github: 'https://github.com.evil.io/ana' } }), TeamError);
  assert.throws(() => validateMember({ name: 'Ana', social: { github: 'javascript:alert(1)' } }), TeamError);
  assert.throws(() => validateMember({ name: '' }), /nome/);
  assert.throws(() => validateMember({ name: 'Ana', bio: 'x'.repeat(701) }), /700/);
});

test('foto nova ganha nome próprio, sem substituir arquivos', () => {
  assert.equal(photoPath('Maria Luíza', 'abcdef0123456789'), 'imagens/equipe/maria-luiza-abcdef01.webp');
});

test('publicação relê a página e tenta de novo quando o branch muda', async () => {
  let patches = 0;
  const reads = [];
  const fetchImpl = async (url, options) => {
    const key = `${options.method} ${url.replace('https://api.github.com/repos/dona/site', '')}`;
    let status = 200; let body = {};
    if (key.startsWith('GET /git/ref/')) body = { object: { sha: `head${patches}` } };
    else if (key.startsWith('GET /git/commits/')) body = { tree: { sha: 'tree' } };
    else if (key.startsWith('GET /contents/')) { reads.push(url); body = `v${patches}`; }
    else if (key.startsWith('POST')) { status = 201; body = { sha: 'x' }; }
    else if (key.startsWith('PATCH')) status = ++patches === 1 ? 422 : 200;
    return { ok: status < 300, status, json: async () => body, text: async () => body };
  };
  const seen = [];
  const commit = await publishWithRetry(createClient('t', { owner: 'dona', name: 'site', branch: 'main' }, fetchImpl),
    'paginas/equipe.html', content => { seen.push(content); return [{ path: 'paginas/equipe.html', text: content }]; }, 'm');
  assert.ok(commit);
  assert.deepEqual(seen, ['v0', 'v1']);
  assert.ok(reads.every(url => url.includes('/contents/paginas/equipe.html?ref=')));
});

test('página de cadastro fica fora do menu e dos buscadores', async () => {
  const html = await readFile(new URL('../paginas/area-da-equipe/cadastro-equipe.html', import.meta.url), 'utf8');
  const header = await readFile(new URL('../header.html', import.meta.url), 'utf8');
  assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
  assert.match(html, /<body data-page="team-admin">/);
  assert.doesNotMatch(header, /cadastro-equipe/);
});

test('área da equipe reúne as ferramentas, fora do menu e dos buscadores', async () => {
  const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const hub = await read('paginas/area-da-equipe/index.html');
  const header = await read('header.html');
  assert.match(hub, /<meta name="robots" content="noindex, nofollow">/);
  assert.doesNotMatch(header, /area-da-equipe/);
  for (const tool of ['enviar-fotos.html', 'cadastro-equipe.html']) {
    assert.match(hub, new RegExp(`href="${tool}"`));
    assert.match(await read(`paginas/area-da-equipe/${tool}`), /href="index.html"/);
  }
});
