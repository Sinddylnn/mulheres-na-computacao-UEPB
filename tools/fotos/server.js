import { createServer } from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { createImporter, ImportError, LIMITS } from './importer.js';

const assets = new URL('./ui/', import.meta.url);
const projectRoot = fileURLToPath(new URL('../../', import.meta.url));

export async function createPhotoServer(root = projectRoot) {
  root = await realpath(root);
  const importer = await createImporter(root);
  const token = randomBytes(32).toString('hex');
  const server = createServer(async (request, response) => {
    const json = (status, body) => {
      response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify(body));
    };
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self'; style-src 'self'; script-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    try {
      const origin = `http://127.0.0.1:${server.address().port}`;
      if (request.headers.host !== new URL(origin).host) throw new ImportError('Abra a ferramenta pelo endereço 127.0.0.1 informado no terminal.', 403);
      if (request.headers.origin && request.headers.origin !== origin) throw new ImportError('Origem não permitida.', 403);
      const url = new URL(request.url, origin);
      if (request.method === 'GET') {
        if (url.pathname.startsWith('/site/')) {
          const relative = decodeURIComponent(url.pathname.slice(6)) || 'index.html';
          const parts = relative.replaceAll('\\', '/').split('/');
          const publicFile = ['index.html', 'header.html', 'footer.html'].includes(relative)
            || ['paginas', 'css', 'js', 'imagens', 'pdfs'].includes(parts[0])
            || (parts[0] === 'data' && parts[1] === 'galeria' && !parts.includes('originais') && !parts.at(-1).startsWith('.'));
          if (!publicFile || parts.includes('..')) throw new ImportError('Arquivo não encontrado.', 404);
          let filename;
          try { filename = await realpath(path.join(root, relative)); } catch { throw new ImportError('Arquivo não encontrado.', 404); }
          const resolvedRelative = path.relative(root, filename);
          if (resolvedRelative.startsWith('..') || path.isAbsolute(resolvedRelative)) throw new ImportError('Arquivo não encontrado.', 404);
          const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
            '.json': 'application/json; charset=utf-8', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
            '.webp': 'image/webp', '.svg': 'image/svg+xml', '.pdf': 'application/pdf' };
          const type = types[path.extname(filename).toLowerCase()];
          if (!type) throw new ImportError('Arquivo não encontrado.', 404);
          response.removeHeader('Content-Security-Policy');
          response.setHeader('Content-Type', type);
          response.end(await readFile(filename));
          return;
        }
        if (url.pathname === '/api/session') return json(200, { token, limits: LIMITS });
        const preview = url.pathname.match(/^\/api\/preview\/([\da-f-]{36})\/(\d+)$/);
        if (preview) {
          response.setHeader('Content-Type', 'image/webp');
          response.end(await importer.thumbnail(preview[1], Number(preview[2])));
          return;
        }
        const files = { '/': ['index.html', 'text/html; charset=utf-8'], '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
          '/style.css': ['style.css', 'text/css; charset=utf-8'], '/base.css': ['../../../css/base.css', 'text/css; charset=utf-8'],
          '/components.css': ['../../../css/components.css', 'text/css; charset=utf-8'] };
        const asset = files[url.pathname];
        if (!asset) throw new ImportError('Página não encontrada.', 404);
        let bytes = await readFile(new URL(asset[0], assets));
        if (url.pathname === '/base.css') bytes = Buffer.from(bytes.toString('utf8').replace(/^@import url\([^\n]+\);\s*$/m, ''));
        response.setHeader('Content-Type', asset[1]);
        response.end(bytes);
        return;
      }
      if (request.method !== 'POST') throw new ImportError('Método não permitido.', 405);
      if (request.headers['x-import-token'] !== token) throw new ImportError('Sessão inválida. Recarregue a ferramenta.', 403);
      const maxBytes = url.pathname === '/api/preview' ? LIMITS.batchBytes + 1024 * 1024 : 1024;
      if (Number(request.headers['content-length']) > maxBytes) throw new ImportError('O lote excede o limite de 60 MB.', 413);
      const chunks = [];
      let size = 0;
      for await (const chunk of request) {
        size += chunk.length;
        if (size > maxBytes) throw new ImportError('O pedido excede o tamanho permitido.', 413);
        chunks.push(chunk);
      }
      const body = Buffer.concat(chunks);
      if (url.pathname === '/api/preview') {
        let form;
        try { form = await new Response(body, { headers: { 'Content-Type': request.headers['content-type'] || '' } }).formData(); }
        catch { throw new ImportError('Não foi possível ler as fotos enviadas.'); }
        const uploaded = form.getAll('photos');
        if (uploaded.length > LIMITS.files || uploaded.some(file => typeof file === 'string')) throw new ImportError('Selecione até 20 fotos.');
        const files = await Promise.all(uploaded.map(async file => ({ name: file.name, bytes: Buffer.from(await file.arrayBuffer()) })));
        return json(200, await importer.preview({ category: form.get('category'), year: form.get('year'), date: form.get('date') || '', files }));
      }
      let payload;
      try { payload = JSON.parse(body); } catch { throw new ImportError('Pedido inválido.'); }
      if (url.pathname === '/api/commit') return json(200, await importer.commit(payload.id));
      if (url.pathname === '/api/cancel') { await importer.cancel(payload.id); return json(200, { cancelled: true }); }
      throw new ImportError('Operação não encontrada.', 404);
    } catch (error) {
      if (!(error instanceof ImportError)) console.error(error);
      json(error.status || 500, { error: error instanceof ImportError ? error.message : 'A operação falhou. As fotos existentes foram preservadas. Consulte o terminal e gere uma nova prévia.' });
    }
  });
  return { server, importer };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { server, importer } = await createPhotoServer();
  server.listen(8001, '127.0.0.1', () => console.log('Importador de fotos: http://127.0.0.1:8001 (Ctrl+C para encerrar)'));
  server.on('error', async error => { console.error(`Não foi possível iniciar: ${error.message}`); await importer.close(); process.exitCode = 1; });
  let stopping = false;
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
    if (stopping) return;
    stopping = true;
    server.close(async () => { await importer.close(); process.exit(); });
  });
}
