import assert from 'node:assert/strict';
import test from 'node:test';
import { isLocalHost } from '../js/features/team-area-link.js';

test('o botão da Área da equipe só aparece no servidor local', () => {
  for (const host of ['127.0.0.1', 'localhost', '[::1]']) assert.equal(isLocalHost(host), true, host);
  for (const host of ['sinddylnn.github.io', 'exemplo.com', '127.0.0.1.exemplo.com', '']) assert.equal(isLocalHost(host), false, host);
});
