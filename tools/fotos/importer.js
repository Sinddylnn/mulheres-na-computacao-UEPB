import { createHash, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile, realpath, open, rename, unlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { LIMITS, ImportError, destination, checkBatch, checkTimeline, checkDuplicate, photoStem, addPhotos, serializeTimeline }
  from '../../js/pages/upload/model.js';

export { LIMITS, ImportError };
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

export async function createImporter(projectRoot) {
  const root = await realpath(projectRoot);
  const stageRoot = await mkdtemp(path.join(tmpdir(), 'mnc-fotos-'));
  const manifestPath = path.join(root, 'data', 'timeline.json');
  const plans = new Map();
  let busy = false;
  const within = target => {
    const relative = path.relative(root, target);
    return relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
  };
  async function directory(relative) {
    const folder = path.join(root, relative);
    await mkdir(folder, { recursive: true });
    if (!within(await realpath(folder))) throw new ImportError('A pasta de destino está fora do projeto.');
    return folder;
  }
  async function readManifest() {
    if (!within(await realpath(manifestPath))) throw new ImportError('O cadastro está fora do projeto.');
    const bytes = await readFile(manifestPath);
    let events;
    try { events = JSON.parse(bytes); } catch { throw new ImportError('O cadastro da galeria contém JSON inválido. Nada foi alterado.'); }
    return { bytes, events: checkTimeline(events), revision: hash(bytes) };
  }
  function getPlan(id) {
    const plan = plans.get(id);
    if (!plan) throw new ImportError('Prévia não encontrada. Gere uma nova prévia.', 404);
    return plan;
  }
  return {
    async preview({ category, year, date = '', files }) {
      if (busy) throw new ImportError('Aguarde a operação atual terminar.', 409);
      busy = true;
      let stage;
      try {
        const target = destination(category, year, date);
        if (!Array.isArray(files)) throw new ImportError('Selecione de 1 a 20 fotos por vez.');
        checkBatch(files.map(file => ({ name: path.basename(String(file.name).replaceAll('\\', '/')), size: file.bytes?.length || 0 })));
        // Bound temporary disk use when a tab repeatedly regenerates its preview.
        for (const [id, old] of plans) {
          if (!old.result) { await rm(old.stage, { recursive: true, force: true }); plans.delete(id); }
        }
        const manifest = await readManifest();
        const id = randomUUID();
        stage = path.join(stageRoot, id);
        await mkdir(stage);
        const photos = [];
        const seen = new Set();
        for (const [index, file] of files.entries()) {
          const name = path.basename(String(file.name).replaceAll('\\', '/'));
          const digest = hash(file.bytes);
          checkDuplicate(manifest.events, target, digest, seen, name);
          let full, thumb, extension;
          try {
            const image = sharp(file.bytes, { limitInputPixels: LIMITS.pixels, failOn: 'warning' });
            const meta = await image.metadata();
            extension = { jpeg: 'jpg', png: 'png', webp: 'webp' }[meta.format];
            if (!extension || (meta.pages || 1) > 1) throw new Error('Formato não suportado');
            full = await image.rotate().resize({ width: LIMITS.fullSize, height: LIMITS.fullSize, fit: 'inside', withoutEnlargement: true })
              .webp({ quality: Math.round(LIMITS.fullQuality * 100) }).toBuffer({ resolveWithObject: true });
            thumb = await sharp(full.data).resize({ width: LIMITS.thumbSize, height: LIMITS.thumbSize, fit: 'inside', withoutEnlargement: true })
              .webp({ quality: Math.round(LIMITS.thumbQuality * 100) }).toBuffer();
          } catch {
            throw new ImportError(`${name}: não foi possível abrir a foto. Use JPG, PNG ou WebP estático com até 40 megapixels.`);
          }
          const stem = photoStem(name, digest, id, index);
          const output = `${stem}.webp`;
          await writeFile(path.join(stage, `${index}-original`), file.bytes);
          await writeFile(path.join(stage, `${index}-full`), full.data);
          await writeFile(path.join(stage, `${index}-thumb`), thumb);
          photos.push({ name, output, original: `${stem}.${extension}`, sha256: digest,
            width: full.info.width, height: full.info.height, inputBytes: file.bytes.length,
            outputBytes: full.data.length, thumbnailBytes: thumb.length });
        }
        plans.set(id, { ...target, stage, photos, revision: manifest.revision });
        return { id, category, date: target.date, photos: photos.map((photo, index) => ({ ...photo, previewUrl: `/api/preview/${id}/${index}` })) };
      } catch (error) {
        if (stage) await rm(stage, { recursive: true, force: true });
        throw error;
      } finally { busy = false; }
    },
    async thumbnail(id, index) {
      const plan = getPlan(id);
      if (!Number.isInteger(index) || index < 0 || index >= plan.photos.length) throw new ImportError('Foto não encontrada.', 404);
      return readFile(path.join(plan.stage, `${index}-thumb`));
    },
    async commit(id) {
      if (busy) throw new ImportError('Aguarde a operação atual terminar.', 409);
      const plan = getPlan(id);
      if (plan.result) return plan.result;
      busy = true;
      let lock, temporary;
      const created = [];
      const lockPath = path.join(root, 'data', '.fotos-import.lock');
      try {
        await directory('data');
        try { lock = await open(lockPath, 'wx'); }
        catch (error) {
          if (error.code === 'EEXIST') throw new ImportError('Outra importação está em andamento. Tente novamente ao terminar.', 409);
          throw error;
        }
        const manifest = await readManifest();
        if (manifest.revision !== plan.revision) throw new ImportError('A galeria mudou desde a prévia. Gere uma nova prévia antes de adicionar.', 409);
        const backup = await directory(`.mnc-fotos-backups/${id}`);
        await writeFile(path.join(backup, 'timeline.json'), manifest.bytes, { flag: 'wx' });
        const destinations = await Promise.all(['galeria', 'miniaturas', 'fotos_originais'].map(kind => directory(`imagens/${kind}/${plan.folder}`)));
        // Exclusive file creation: an import never overwrites an existing image or original.
        for (const [index, photo] of plan.photos.entries()) {
          for (const [folder, filename, source] of [
            [destinations[0], photo.output, `${index}-full`],
            [destinations[1], photo.output, `${index}-thumb`],
            [destinations[2], photo.original, `${index}-original`]
          ]) {
            const target = path.join(folder, filename);
            const bytes = await readFile(path.join(plan.stage, source));
            const handle = await open(target, 'wx');
            created.push(target);
            try { await handle.writeFile(bytes); } finally { await handle.close(); }
          }
        }
        const events = addPhotos(manifest.events, plan, plan.photos);
        // If another editor saved during image writes, preserve their version and abort.
        if (hash(await readFile(manifestPath)) !== plan.revision) throw new ImportError('O cadastro foi alterado durante a importação. Gere uma nova prévia.', 409);
        temporary = path.join(root, 'data', `.timeline-${id}.tmp`);
        await writeFile(temporary, serializeTimeline(events), { flag: 'wx' });
        await rename(temporary, manifestPath);
        temporary = null;
        plan.result = { count: plan.photos.length, backup: `.mnc-fotos-backups/${id}/timeline.json`, category: plan.category, date: plan.date };
        return plan.result;
      } catch (error) {
        // Roll back only files created by this attempt; never touch existing photos.
        await Promise.all(created.map(file => unlink(file)));
        if (temporary) await unlink(temporary).catch(() => {});
        throw error;
      } finally {
        if (lock) { await lock.close(); await unlink(lockPath); }
        busy = false;
      }
    },
    async cancel(id) {
      if (busy) throw new ImportError('Aguarde a operação atual terminar.', 409);
      const plan = getPlan(id);
      if (plan.result) throw new ImportError('Este lote já foi adicionado à galeria.', 409);
      plans.delete(id);
      await rm(plan.stage, { recursive: true, force: true });
    },
    async close() { await rm(stageRoot, { recursive: true, force: true }); }
  };
}
