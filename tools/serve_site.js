/**
 * Servidor local (npm start): serve o site sem build e também atende o cadastro
 * da equipe, que grava direto na pasta do projeto. Só escuta em 127.0.0.1.
 */
import { createTeamServer } from './equipe/server.js';
import { projectRoot } from './static_server.js';

const server = await createTeamServer(projectRoot, { home: null });
server.on('error', error => {
  console.error(`Não foi possível iniciar o servidor: ${error.message}`);
  process.exitCode = 1;
});
server.listen(8000, '127.0.0.1', () => {
  const base = 'http://127.0.0.1:8000/';
  console.log([
    'MNC rodando. Segure Ctrl e clique no link para abrir:',
    `  Site:            ${base}`,
    `  Área da equipe:  ${base}paginas/area-da-equipe/`,
    'Ctrl+C para encerrar.'
  ].join('\n'));
});
