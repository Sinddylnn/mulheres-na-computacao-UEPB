/** Servidor local para visualizar as páginas estáticas sem build. */
import { createServer } from 'node:http';
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

/** Responde GET/HEAD com os arquivos de root (já resolvido com realpath). Também usado por tools/equipe. */
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

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = await realpath(projectRoot);
  const server = createServer((request, response) => serveStatic(root, request, response));
  server.on('error', error => {
    console.error(`Não foi possível iniciar o servidor: ${error.message}`);
    process.exitCode = 1;
  });
  server.listen(8000, '127.0.0.1', () => {
    console.log('MNC: http://127.0.0.1:8000 (Ctrl+C para encerrar)');
  });
}
