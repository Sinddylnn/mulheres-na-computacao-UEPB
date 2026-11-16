import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

import {
  formatDate,
  groupSchoolsByYear,
  normalizeTimeline,
  uniquePhotos
} from '../js/pages/gallery/model.js';

const rawTimeline = [
  {
    categoria: 'encontros',
    data: '2025-03-15',
    caminho_relativo: 'encontros/2025-03-15',
    fotos: ['foto.webp', 'foto.webp'],
    metadados: {
      'foto.webp': { largura: 1200, altura: 800, miniatura: 'encontros/2025-03-15/foto.webp' }
    }
  },
  {
    categoria: 'escolas',
    data: '2024',
    caminho_relativo: 'escolas/2024',
    fotos: ['turma.webp'],
    metadados: {
      'turma.webp': { largura: 800, altura: 600, miniatura: 'escolas/2024/turma.webp' }
    }
  }
];

test('formata datas completas e preserva anos', () => {
  assert.equal(formatDate('2024'), '2024');
  assert.equal(formatDate('2025-03-15'), '15 DE MARÇO, 2025');
  assert.equal(formatDate('data-inválida'), 'data-inválida');
});

test('normaliza eventos e metadados de fotos sem acessar o DOM', () => {
  const events = normalizeTimeline(rawTimeline);
  assert.equal(events[0].categoryTitle, 'Encontros');
  assert.equal(events[0].photos[0].width, 1200);
  assert.equal(events[0].photos[0].thumbnailPath, 'data/galeria/miniaturas/encontros/2025-03-15/foto.webp');
});

test('remove fotos duplicadas da visão geral', () => {
  const photos = uniquePhotos(normalizeTimeline(rawTimeline));
  assert.equal(photos.length, 2);
});

test('agrupa escolas por ano em ordem decrescente', () => {
  const events = normalizeTimeline([
    rawTimeline[1],
    { ...rawTimeline[1], data: '2025', caminho_relativo: 'escolas/2025' }
  ]);
  assert.deepEqual([...groupSchoolsByYear(events).keys()], ['2025', '2024']);
});


test('a galeria registra ações nas escolas somente em 2024 e 2025', async () => {
  const timeline = JSON.parse(await readFile(new URL('../data/galeria/timeline.json', import.meta.url), 'utf8'));
  const schools = groupSchoolsByYear(normalizeTimeline(timeline));
  assert.deepEqual([...schools.keys()], ['2025', '2024']);
  assert.ok([...schools.values()].every(photos => photos.length > 0));
  const schoolEvents = timeline.filter(event => event.categoria === 'escolas');
  assert.equal(schoolEvents.length, 2);
  for (const event of schoolEvents) {
    assert.match(event.data, /^\d{4}$/);
    assert.equal(event.caminho_relativo, `escolas/${event.data}`);
    for (const photo of event.fotos) {
      assert.equal(event.metadados[photo].miniatura.split('/').slice(0, -1).join('/'), event.caminho_relativo);
    }
  }
});
