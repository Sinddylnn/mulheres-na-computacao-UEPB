// Conversão das fotos no navegador: o original nunca sai do computador.
// Gera WebP sem metadados (EXIF/localização), com as mesmas medidas do importador local.
import { LIMITS, ImportError, fitInside } from './model.js';

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

export async function sha256(buffer) {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function encode(source, size, quality) {
  const { width, height } = fitInside(source.width, source.height, size);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  context.imageSmoothingQuality = 'high';
  context.drawImage(source, 0, 0, width, height);
  return new Promise((resolve, reject) => canvas.toBlob(blob => {
    // Navegadores sem codificador WebP devolvem PNG; recuse para não publicar arquivos pesados.
    if (!blob || blob.type !== 'image/webp') {
      reject(new ImportError('Este navegador não consegue gerar WebP. Use Chrome, Edge ou Firefox atualizados.'));
      return;
    }
    resolve({ blob, width, height, canvas });
  }, 'image/webp', quality));
}

async function open(file) {
  if (!ACCEPTED.includes(file.type)) throw new ImportError(`${file.name}: use JPG, PNG ou WebP.`);
  if (file.size > LIMITS.fileBytes) throw new ImportError(`${file.name}: a foto passa de 15 MB.`);
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new ImportError(`${file.name}: não foi possível abrir a foto.`);
  }
  if (bitmap.width * bitmap.height > LIMITS.pixels) {
    bitmap.close();
    throw new ImportError(`${file.name}: a foto passa de 40 megapixels.`);
  }
  return bitmap;
}

/** Foto de perfil da equipe: WebP com até size px no lado maior. */
export async function convertAvatar(file, size = 600, quality = 0.82) {
  const bitmap = await open(file);
  try {
    const { blob, width, height } = await encode(bitmap, size, quality);
    return { blob, width, height };
  } finally {
    bitmap.close();
  }
}

/** Converte um File em { full, thumb } WebP. Lança ImportError com mensagem amigável. */
export async function convertPhoto(file) {
  const bitmap = await open(file);
  try {
    const full = await encode(bitmap, LIMITS.fullSize, LIMITS.fullQuality);
    const thumb = await encode(full.canvas, LIMITS.thumbSize, LIMITS.thumbQuality);
    return {
      full: { blob: full.blob, width: full.width, height: full.height },
      thumb: { blob: thumb.blob, width: thumb.width, height: thumb.height }
    };
  } finally {
    bitmap.close();
  }
}

export function toBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',', 2)[1]);
    reader.onerror = () => reject(new ImportError('Não foi possível ler a foto convertida.'));
    reader.readAsDataURL(blob);
  });
}
