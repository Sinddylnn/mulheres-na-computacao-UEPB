// Cadastro da equipe. Funciona só no computador, com o servidor local
// (npm start ou npm run equipe, ambos com tools/equipe/server.js), que grava direto na pasta do projeto.
import { TEAM_PAGE, LIMITS, TeamError, NETWORKS, parseMembers, parseMember, validateMember, photoPath, renderMember, upsertMember } from './model.js';
import { ImportError } from '../../shared/upload-model.js';
import { convertAvatar, sha256, toBase64 } from '../upload/image.js';
import { setBusy } from '../../shared/admin/session.js';
import { projectHref, projectUrl } from '../../core/paths.js';

const NEW = '';
const API = 'api/equipe';

class LocalError extends Error {}
const friendly = error => [TeamError, ImportError, LocalError].some(type => error instanceof type)
  ? error.message : 'Algo deu errado. Nada foi salvo; tente novamente.';

/** Conversa com tools/equipe/server.js, que só existe quando a ferramenta roda no computador. */
const local = {
  token: null,
  async read() {
    let response = null;
    try { response = await fetch(projectUrl(API), { cache: 'no-store' }); } catch { /* sem servidor */ }
    const type = response?.headers.get('Content-Type') ?? '';
    if (!response?.ok || !type.includes('application/json')) {
      throw new LocalError('Esta página só funciona no computador, com a ferramenta local aberta. Veja abaixo como abrir.');
    }
    const data = await response.json();
    this.token = data.token;
    return data.html;
  },
  async save(payload) {
    let response;
    try {
      response = await fetch(projectUrl(API), {
        method: 'POST', cache: 'no-store', body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json', 'X-Equipe-Token': this.token }
      });
    } catch {
      throw new LocalError('O servidor local foi fechado. Rode npm.cmd start de novo e recarregue a página.');
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new LocalError(data.error || 'Não foi possível salvar. Consulte o terminal.');
    return data;
  }
};

export function init() {
  const $ = id => document.getElementById(id);
  const el = {
    form: $('member-form'), fields: $('member-fields'), select: $('member-select'),
    name: $('member-name'), role: $('member-role'), bio: $('member-bio'), bioCount: $('member-bio-count'),
    photo: $('member-photo'), photoHelp: $('member-photo-help'), status: $('member-status'),
    preview: $('preview'), previewCard: $('preview-card'), summary: $('preview-summary'),
    publish: $('publish'), cancel: $('cancel'), publishStatus: $('publish-status'),
    localStatus: $('local-status'), localHelp: $('local-help'),
    done: $('done'), doneTitle: $('done-titulo'), doneMessage: $('done-message'), again: $('again')
  };
  if (!el.form) return;
  const socialInputs = Object.fromEntries(NETWORKS.map(network => [network.key, $(`member-${network.key}`)]));

  let ready = false;
  let members = []; // nomes na ordem do arquivo
  let currentHtml = '';
  let draft = null; // { member, original, avatar, url }

  el.bio.maxLength = LIMITS.bio;
  el.name.maxLength = LIMITS.name;
  el.role.maxLength = LIMITS.role;
  const syncCount = () => { el.bioCount.textContent = `${el.bio.value.length} de ${LIMITS.bio} caracteres`; };
  el.bio.addEventListener('input', syncCount);
  syncCount();

  async function loadTeam() {
    el.status.textContent = 'Lendo a página da equipe…';
    currentHtml = await local.read();
    members = parseMembers(currentHtml).map(member => member.name);
    const selected = el.select.value;
    el.select.replaceChildren(new Option('Nova integrante', NEW), ...members.map(name => new Option(name, name)));
    el.select.value = members.includes(selected) ? selected : NEW;
    fillForm();
    el.status.textContent = '';
  }

  function fillForm() {
    const original = el.select.value;
    const data = original
      ? parseMember(parseMembers(currentHtml).find(member => member.name === original).block)
      : { name: '', role: '', bio: '', social: {} };
    el.name.value = data.name;
    el.role.value = data.role;
    el.bio.value = data.bio;
    for (const network of NETWORKS) socialInputs[network.key].value = data.social[network.key] ?? '';
    el.photo.value = '';
    el.photo.required = !original;
    el.photoHelp.textContent = original
      ? 'Deixe em branco para manter a foto atual. JPG, PNG ou WebP, até 15 MB.'
      : 'Obrigatória. Prefira o rosto centralizado: o site usa um recorte circular. JPG, PNG ou WebP, até 15 MB.';
    syncCount();
  }
  el.select.addEventListener('change', () => { discardDraft(); fillForm(); });

  // ── Ferramenta local ─────────────────────────────────────────────────
  (async () => {
    el.localStatus.textContent = 'Procurando a ferramenta local…';
    try {
      await loadTeam();
      ready = true;
      el.fields.disabled = false;
      el.localStatus.textContent = `Pronto: as alterações serão salvas em ${TEAM_PAGE} neste computador.`;
    } catch (error) {
      el.status.textContent = '';
      el.localStatus.textContent = friendly(error);
      el.localHelp.open = true;
    }
  })();

  // ── Prévia ───────────────────────────────────────────────────────────
  function discardDraft() {
    if (draft?.url) URL.revokeObjectURL(draft.url);
    draft = null;
    el.previewCard.replaceChildren();
    el.preview.hidden = true;
    el.publishStatus.textContent = '';
  }

  el.form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!ready) return;
    discardDraft();
    el.done.hidden = true;
    setBusy(el.form, true);
    try {
      const original = el.select.value || null;
      const member = validateMember({
        name: el.name.value, role: el.role.value, bio: el.bio.value,
        social: Object.fromEntries(NETWORKS.map(network => [network.key, socialInputs[network.key].value]))
      });
      const file = el.photo.files[0];
      if (!file && !original) throw new TeamError('Escolha uma foto para o novo card.');
      let avatar = null;
      if (file) {
        el.status.textContent = 'Convertendo a foto…';
        const digest = await sha256(await file.arrayBuffer());
        avatar = { ...await convertAvatar(file), path: photoPath(member.name, digest) };
        member.photo = avatar.path;
      }
      // Confere nome repetido antes de mostrar a prévia; o salvamento confere de novo.
      upsertMember(currentHtml, member, original);

      const current = original && parseMember(parseMembers(currentHtml).find(item => item.name === original).block);
      const url = avatar && URL.createObjectURL(avatar.blob);
      draft = { member, original, avatar, url };
      const template = document.createElement('template');
      template.innerHTML = renderMember({ ...member, photo: member.photo || current.photo },
        { open: current?.open ?? '<article class="card team-member">', pin: current?.pin, src: url || projectHref(current.photo) }).trim();
      const card = template.content.firstElementChild;
      card.classList.remove('reveal', 'reveal-delay-1', 'reveal-delay-2', 'reveal-delay-3', 'reveal-delay-4');
      card.querySelectorAll('a').forEach(link => { link.tabIndex = -1; });
      el.previewCard.replaceChildren(card);
      el.summary.textContent = original
        ? `O card de ${original} será atualizado${avatar ? ', com foto nova' : ''}.`
        : `Um novo card de ${member.name} será incluído na página da equipe.`;
      el.preview.hidden = false;
      el.photo.value = ''; // libera o original selecionado
      el.status.textContent = 'Confira a prévia abaixo antes de salvar.';
      el.publish.focus();
    } catch (error) {
      el.status.textContent = friendly(error);
    } finally {
      setBusy(el.form, false);
    }
  });

  el.cancel.addEventListener('click', () => {
    discardDraft();
    el.status.textContent = 'Cancelado. Nada foi salvo.';
    el.name.focus();
  });

  // ── Salvar ───────────────────────────────────────────────────────────
  el.publish.addEventListener('click', async () => {
    if (!ready || !draft) return;
    setBusy(el.preview, true);
    try {
      const { member, original, avatar } = draft;
      el.publishStatus.textContent = 'Salvando no projeto…';
      const saved = await local.save({ original, member, photo: avatar ? await toBase64(avatar.blob) : null });

      discardDraft();
      el.select.value = saved.name;
      await loadTeam().catch(() => {});
      el.status.textContent = '';
      el.doneTitle.innerHTML = original ? 'Card <em>atualizado!</em>' : 'Card <em>salvo!</em>';
      el.doneMessage.textContent = `${saved.name} ${original ? 'foi atualizada' : 'foi incluída'} em ${TEAM_PAGE}`
        + `${saved.photo ? `, com a foto ${saved.photo}` : ''}. Confira com git diff e faça o commit para publicar no site.`;
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
    el.select.value = NEW;
    fillForm();
    el.name.focus();
  });
}
