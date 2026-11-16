// Regras do cadastro da galeria compartilhadas pela página de envio (navegador)
// e pelo importador local (tools/fotos/importer.js). Funções puras, sem DOM nem fs.

export const LIMITS = {
  files: 20,
  fileBytes: 15 * 1024 * 1024,
  batchBytes: 60 * 1024 * 1024,
  pixels: 40_000_000,
  fullSize: 1600,
  thumbSize: 480,
  fullQuality: 0.8,
  thumbQuality: 0.72
};

export const CATEGORIES = ['escolas', 'encontros'];

export class ImportError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

/** Valida categoria, ano e data e devolve a pasta do evento. */
export function destination(category, year, date = '') {
  if (!CATEGORIES.includes(category)) throw new ImportError('Selecione uma categoria válida.');
  if (!/^\d{4}$/.test(year) || +year < 1900 || +year > 2100) throw new ImportError('Informe um ano entre 1900 e 2100.');
  if (category === 'escolas' && date) throw new ImportError('Fotos de escolas são organizadas somente por ano.');
  if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !date.startsWith(year + '-')
      || Number.isNaN(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date)) {
    throw new ImportError('A data do encontro deve ser válida e pertencer ao ano informado.');
  }
  return { category, date: date || year, folder: `${category}/${date || year}` };
}

/** Confere o lote antes de processar as imagens. */
export function checkBatch(files) {
  if (!Array.isArray(files) || !files.length || files.length > LIMITS.files) throw new ImportError('Selecione de 1 a 20 fotos por vez.');
  if (files.reduce((sum, file) => sum + file.size, 0) > LIMITS.batchBytes) throw new ImportError('O lote deve ter até 60 MB.');
  for (const file of files) {
    if (!file.size || file.size > LIMITS.fileBytes) throw new ImportError(`${file.name}: o limite é 15 MB por foto.`);
  }
}

/** Valida a estrutura mínima do cadastro antes de qualquer alteração. */
export function checkTimeline(events) {
  if (!Array.isArray(events) || events.some(event => !event || typeof event !== 'object' || Array.isArray(event)
    || !Array.isArray(event.fotos) || !event.metadados || typeof event.metadados !== 'object' || Array.isArray(event.metadados))) {
    throw new ImportError('O cadastro da galeria precisa ser revisado antes da importação. Nada foi alterado.');
  }
  return events;
}

/** Lança erro se a foto já está no lote ou já foi cadastrada no mesmo evento. */
export function checkDuplicate(events, target, digest, seen, name) {
  if (seen.has(digest) || events.some(event => event.categoria === target.category
    && event.data === target.date && Object.values(event.metadados).some(meta => meta?.sha256 === digest))) {
    throw new ImportError(`${name}: foto repetida neste lote ou já importada neste evento.`);
  }
  seen.add(digest);
}

/** Nome base único e seguro para URL, derivado do nome original e do conteúdo. */
export function photoStem(originalName, digest, batchId, index) {
  const base = String(originalName).replaceAll('\\', '/').split('/').pop().replace(/\.[^.]*$/, '');
  const slug = base.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 55) || 'foto';
  return `${slug}-${digest.slice(0, 12)}-${batchId.slice(0, 8)}-${index + 1}`;
}

/**
 * Acrescenta as fotos ao evento (criando-o se preciso) e devolve o novo cadastro.
 * photos: [{ output, width, height, sha256 }]. Não altera o array recebido.
 */
export function addPhotos(events, target, photos) {
  const next = structuredClone(events);
  let event = next.find(item => item.categoria === target.category && item.data === target.date);
  if (event && event.caminho_relativo !== target.folder) throw new ImportError('O evento existente usa outra pasta. Nada foi adicionado.');
  if (!event) {
    event = { categoria: target.category, data: target.date, caminho_relativo: target.folder, fotos: [], metadados: {} };
    next.unshift(event);
  }
  for (const photo of photos) {
    if (event.fotos.includes(photo.output)) throw new ImportError(`${photo.output}: já existe no cadastro. Nada foi adicionado.`);
    event.fotos.push(photo.output);
    event.metadados[photo.output] = { largura: photo.width, altura: photo.height,
      miniatura: `${target.folder}/${photo.output}`, sha256: photo.sha256 };
  }
  return next;
}

export const serializeTimeline = events => JSON.stringify(events, null, 2) + '\n';

/** Medidas para caber em size × size sem ampliar. */
export function fitInside(width, height, size) {
  const scale = Math.min(1, size / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
