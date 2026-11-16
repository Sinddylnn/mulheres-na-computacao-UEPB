/** Entrega dos arquivos estáticos do site, usada por tools/serve_site.js e tools/equipe/server.js. */
import { readFile, realpath, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const projectRoot = fileURLToPath(new URL('../', import.meta.url));

const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.pdf': 'application/pdf'
};

/** Responde GET/HEAD com os arquivos de root (já resolvido com realpath). */
export async function serveStatic(root, request, response) {
  const insideRoot = target => {
    const relative = path.relative(root, target);
    return !relative.startsWith('..') && !path.isAbsolute(relative);
  };
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    let target = path.resolve(root, '.' + pathname);
    if (!insideRoot(target)) {
      response.writeHead(403).end('Acesso negado');
      return;
    }
    if ((await stat(target)).isDirectory()) target = path.join(target, 'index.html');
    target = await realpath(target);
    if (!insideRoot(target)) {
      response.writeHead(403).end('Acesso negado');
      return;
    }
    const content = await readFile(target);
    response.writeHead(200, {
      'Content-Type': types[path.extname(target)] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch (error) {
    const status = error instanceof URIError ? 400 : 404;
    response.writeHead(status).end(status === 400 ? 'URL inválida' : 'Arquivo não encontrado');
  }
}
