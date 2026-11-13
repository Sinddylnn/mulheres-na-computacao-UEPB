import { ImportError, destination, checkBatch, checkTimeline, checkDuplicate, photoStem, addPhotos, serializeTimeline } from './model.js';
import { convertPhoto, sha256, toBase64 } from './image.js';
import { publishWithRetry } from '../admin/github.js';
import { initSession, friendly as baseFriendly, setBusy } from '../admin/session.js';
import { TIMELINE, PHOTOS_DIR, THUMBNAILS_DIR } from '../gallery/paths.js';

const formatSize = bytes => bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const friendly = error => baseFriendly(error, ImportError);

export function init() {
  const $ = id => document.getElementById(id);
  const el = {
    photosForm: $('photos-form'), fields: $('photos-fields'), category: $('category'), year: $('year'),
    date: $('date'), dateField: $('date-field'), photos: $('photos'), photosStatus: $('photos-status'),
    preview: $('preview'), summary: $('preview-summary'), grid: $('preview-grid'),
    publish: $('publish'), cancel: $('cancel'), publishStatus: $('publish-status'),
    done: $('done'), doneMessage: $('done-message'), again: $('again')
  };
  if (!el.photosForm) return;

  let client = null;
  let batch = null; // { target, photos: [...], urls: [...] }

  el.year.value = new Date().getFullYear();

  function syncDateField() {
    const isSchool = el.category.value === 'escolas';
    el.dateField.hidden = isSchool;
    if (isSchool) el.date.value = '';
  }
  el.category.addEventListener('change', syncDateField);
  syncDateField();

  // ── Acesso ───────────────────────────────────────────────────────────
  initSession({
    onLogin(candidate) { client = candidate; el.fields.disabled = false; },
    onLogout() { client = null; discardBatch(); el.fields.disabled = true; }
  });

  // ── Preparar ─────────────────────────────────────────────────────────
  function discardBatch() {
    batch?.urls.forEach(url => URL.revokeObjectURL(url));
    batch = null;
    el.grid.replaceChildren();
    el.preview.hidden = true;
    el.publishStatus.textContent = '';
  }

  function renderPreview() {
    const total = batch.photos.reduce((sum, photo) => sum + photo.full.blob.size, 0);
    el.summary.textContent = `${batch.photos.length} foto(s) para ${batch.target.folder} · ${formatSize(total)} depois da conversão.`;
    el.grid.replaceChildren(...batch.photos.map((photo, index) => {
      const item = document.createElement('li');
      item.className = 'upload-photo';
      const img = document.createElement('img');
      img.src = batch.urls[index];
      img.alt = `Prévia de ${photo.name}`;
      img.width = photo.thumb.width;
      img.height = photo.thumb.height;
      const caption = document.createElement('p');
      caption.textContent = `${photo.name} · ${photo.full.width}×${photo.full.height} · ${formatSize(photo.size)} → ${formatSize(photo.full.blob.size)}`;
      item.append(img, caption);
      return item;
    }));
    el.preview.hidden = false;
  }

  el.photosForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (!client) return;
    discardBatch();
    el.done.hidden = true;
    setBusy(el.photosForm, true);
    try {
      const target = destination(el.category.value, String(el.year.value).trim(), el.date.value);
      const files = [...el.photos.files];
      checkBatch(files);
      el.photosStatus.textContent = 'Conferindo a galeria atual…';
      const events = checkTimeline(JSON.parse((await client.snapshot(TIMELINE)).content));
      const batchId = crypto.randomUUID();
      const seen = new Set();
      const photos = [];
      for (const [index, file] of files.entries()) {
        el.photosStatus.textContent = `Convertendo ${index + 1} de ${files.length}: ${file.name}`;
        const digest = await sha256(await file.arrayBuffer());
        checkDuplicate(events, target, digest, seen, file.name);
        const converted = await convertPhoto(file);
        photos.push({ name: file.name, size: file.size, sha256: digest,
          output: `${photoStem(file.name, digest, batchId, index)}.webp`, ...converted });
      }
      batch = { target, photos, urls: photos.map(photo => URL.createObjectURL(photo.thumb.blob)) };
      el.photos.value = ''; // libera os originais selecionados
      el.photosStatus.textContent = 'Fotos prontas. Confira abaixo antes de publicar.';
      renderPreview();
      el.publish.focus();
    } catch (error) {
      el.photosStatus.textContent = friendly(error);
    } finally {
      setBusy(el.photosForm, false);
    }
  });

  el.cancel.addEventListener('click', () => {
    discardBatch();
    el.photosStatus.textContent = 'Envio cancelado. Nada foi publicado.';
    el.photos.focus();
  });

  // ── Publicar ─────────────────────────────────────────────────────────
  el.publish.addEventListener('click', async () => {
    if (!client || !batch) return;
    setBusy(el.preview, true);
    try {
      el.publishStatus.textContent = 'Preparando os arquivos…';
      const { target, photos } = batch;
      const images = [];
      for (const photo of photos) {
        images.push({ path: `${PHOTOS_DIR}/${target.folder}/${photo.output}`, base64: await toBase64(photo.full.blob) });
        images.push({ path: `${THUMBNAILS_DIR}/${target.folder}/${photo.output}`, base64: await toBase64(photo.thumb.blob) });
      }
      const entries = photos.map(photo => ({ output: photo.output, width: photo.full.width, height: photo.full.height, sha256: photo.sha256 }));
      const message = `adicionando ${photos.length} foto(s) em ${target.folder}`;

      await publishWithRetry(client, TIMELINE, content => {
        const events = checkTimeline(JSON.parse(content));
        const seen = new Set();
        photos.forEach(photo => checkDuplicate(events, target, photo.sha256, seen, photo.name));
        return [...images, { path: TIMELINE, text: serializeTimeline(addPhotos(events, target, entries)) }];
      }, message, { onAttempt: attempt => {
        el.publishStatus.textContent = attempt === 1 ? 'Enviando para o GitHub…' : 'Outra pessoa publicou ao mesmo tempo. Tentando de novo…';
      } });

      const count = photos.length;
      discardBatch();
      el.photosStatus.textContent = '';
      el.doneMessage.textContent = `${count} foto(s) enviada(s) para ${target.folder}. O site é atualizado automaticamente em alguns minutos.`;
      el.done.hidden = false;
      el.done.focus();
    } catch (error) {
      el.publishStatus.textContent = friendly(error);
    } finally {
      setBusy(el.preview, false);
    }
  });

  el.again.addEventListener('click', () => {
    el.done.hidden = true;
    el.photos.focus();
  });
}
