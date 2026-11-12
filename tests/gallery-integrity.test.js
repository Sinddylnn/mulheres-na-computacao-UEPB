import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const exists = path => access(new URL(path, root)).then(() => true, () => false);

test('toda foto e miniatura cadastrada na galeria existe', async () => {
  const events = JSON.parse(await readFile(new URL('data/timeline.json', root), 'utf8'));
  const missing = [];
  for (const event of events) {
    for (const photo of event.fotos) {
      const full = `imagens/galeria/${event.caminho_relativo}/${photo}`;
      const thumb = `imagens/miniaturas/${event.metadados[photo]?.miniatura}`;
      if (!await exists(full)) missing.push(full);
      if (!await exists(thumb)) missing.push(thumb);
    }
  }
  assert.deepEqual(missing, [], `Arquivos cadastrados que não existem:\n${missing.join('\n')}`);
});
