// Cadastro da equipe local: serve o site em 127.0.0.1 e grava os cards direto
// na pasta do projeto, sem GitHub e sem token. Quem tem o repositório revisa e faz o commit.
import { createServer } from 'node:http';
import { readFile, writeFile, rename, rm, realpath } from 'node:fs/promises';
import { createHash, randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveStatic, projectRoot } from '../static_server.js';
import { TEAM_PAGE, TeamError, validateMember, photoPath, upsertMember } from '../../js/pages/team-admin/model.js';

export const PAGE = 'paginas/area-da-equipe/cadastro-equipe.html';
const MAX_PHOTO = 4 * 1024 * 1024;
const MAX_BODY = Math.ceil(MAX_PHOTO * 4 / 3) + 64 * 1024;

class HttpError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

const isWebp = bytes => bytes.length > 12 && bytes.toString('latin1', 0, 4) === 'RIFF' && bytes.toString('latin1', 8, 12) === 'WEBP';

/**
 * Inclui ou atualiza um card em paginas/equipe.html.
 * input: { original, member: { name, role, bio, social }, photo?: base64 de um WebP }.
 * A foto nova ganha nome com hash e nunca substitui um arquivo existente.
 */
export async function saveMember(root, input) {
  const member = validateMember(input?.member ?? {});
  const original = input?.original ? String(input.original) : null;
  let photo = null;
  if (input?.photo) {
    const bytes = Buffer.from(String(input.photo), 'base64');
    if (bytes.length > MAX_PHOTO || !isWebp(bytes)) throw new TeamError('A foto convertida é inválida. Escolha outra imagem.');
    const digest = createHash('sha256').update(bytes).digest('hex');
    photo = { bytes, path: photoPath(member.name, digest) };
    member.photo = photo.path;
  }
  const pageFile = path.join(root, TEAM_PAGE);
  // Lê e monta o HTML antes de gravar qualquer coisa: um erro aqui não deixa arquivos soltos.
  const html = upsertMember(await readFile(pageFile, 'utf8'), member, original);
  if (photo) {
    const target = path.join(root, photo.path);
    try {
      await writeFile(target, photo.bytes, { flag: 'wx' });
    } catch (error) {
      // O nome tem o hash do conteúdo: se já existe com os mesmos bytes, é a mesma foto.
      if (error.code !== 'EEXIST' || !(await readFile(target)).equals(photo.bytes)) throw error;
    }
  }
  const temporary = `${pageFile}.${randomBytes(6).toString('hex')}.tmp`;
  try {
    await writeFile(temporary, html, { flag: 'wx' });
    await rename(temporary, pageFile);
  } finally {
    await rm(temporary, { force: true });
  }
  return { name: member.name, photo: photo?.path ?? null };
}

/**
 * Servidor do site com a API do cadastro (/api/equipe).
 * home: página para onde "/" redireciona; null serve o index.html normalmente (npm start).
 */
export async function createTeamServer(root = projectRoot, { home = PAGE } = {}) {
  root = await realpath(root);
  const token = randomBytes(32).toString('hex');
  let queue = Promise.resolve(); // um salvamento por vez

  const server = createServer(async (request, response) => {
    const json = (status, body) => {
      response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify(body));
    };
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    try {
      const origin = `http://127.0.0.1:${server.address().port}`;
      if (request.headers.host !== new URL(origin).host) throw new HttpError('Abra a ferramenta pelo endereço 127.0.0.1 informado no terminal.', 403);
      if (request.headers.origin && request.headers.origin !== origin) throw new HttpError('Origem não permitida.', 403);
      const url = new URL(request.url, origin);

      if (home && url.pathname === '/') {
        response.writeHead(302, { Location: '/' + home }).end();
        return;
      }
      if (url.pathname !== '/api/equipe') return serveStatic(root, request, response);

      if (request.method === 'GET') {
        return json(200, { token, html: await readFile(path.join(root, TEAM_PAGE), 'utf8') });
      }
      if (request.method !== 'POST') throw new HttpError('Método não permitido.', 405);
      if (request.headers['x-equipe-token'] !== token) throw new HttpError('Sessão inválida. Recarregue a página.', 403);
      if (Number(request.headers['content-length']) > MAX_BODY) throw new HttpError('A foto é grande demais.', 413);
      const chunks = [];
      let size = 0;
      for await (const chunk of request) {
        size += chunk.length;
        if (size > MAX_BODY) throw new HttpError('A foto é grande demais.', 413);
        chunks.push(chunk);
      }
      let payload;
      try { payload = JSON.parse(Buffer.concat(chunks)); } catch { throw new HttpError('Pedido inválido.', 400); }
      const result = queue.then(() => saveMember(root, payload));
      queue = result.catch(() => {});
      return json(200, await result);
    } catch (error) {
      const known = error instanceof HttpError || error instanceof TeamError;
      if (!known) console.error(error);
      json(error.status || (known ? 400 : 500), {
        error: known ? error.message : 'Não foi possível salvar. Nenhum card existente foi apagado; consulte o terminal.'
      });
    }
  });
  return server;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const server = await createTeamServer();
  server.on('error', error => { console.error(`Não foi possível iniciar: ${error.message}`); process.exitCode = 1; });
  server.listen(8002, '127.0.0.1', () => console.log(`Cadastro da equipe: http://127.0.0.1:8002/${PAGE} (Ctrl+C para encerrar)`));
}
