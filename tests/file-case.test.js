import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { posix } from 'node:path';

// O Windows ignora maiúsculas e minúsculas nos nomes de arquivo; o GitHub Pages e a CI não.
// Este teste compara cada referência com o nome exato registrado no Git.
const root = new URL('../', import.meta.url);
const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
const exact = new Set(tracked);
const byLowerCase = new Map(tracked.map(file => [file.toLowerCase(), file]));

const REFERENCE = /(?:href|src)="([^"#?]+)"|url\(["']?([^)"'?#]+)|from\s+["'](\.[^"']+)|import\(\s*["'](\.[^"']+)/g;
const EXTERNAL = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i;

test('referências usam o nome do arquivo com a mesma caixa do Git', async () => {
  const wrong = [];
  for (const file of tracked.filter(name => /\.(?:html|css|js)$/.test(name) && !name.startsWith('tests/'))) {
    const text = await readFile(new URL(file, root), 'utf8');
    // header.html e footer.html usam caminhos relativos à raiz.
    const base = ['header.html', 'footer.html'].includes(file) ? '' : posix.dirname(file);
    for (const match of text.matchAll(REFERENCE)) {
      const reference = match.slice(1).find(Boolean);
      if (!reference || EXTERNAL.test(reference) || reference.includes('${')) continue;
      const target = posix.normalize(posix.join(base, decodeURI(reference)));
      const real = byLowerCase.get(target.toLowerCase());
      if (!exact.has(target) && real) wrong.push(`${file}: ${reference} (no Git: ${real})`);
    }
  }
  assert.deepEqual(wrong, [], `Corrija a caixa das referências:\n${wrong.join('\n')}`);
});
