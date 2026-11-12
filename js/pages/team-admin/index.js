import { TEAM_PAGE, LIMITS, TeamError, NETWORKS, parseMembers, parseMember, validateMember, photoPath, renderMember, upsertMember } from './model.js';
import { ImportError } from '../upload/model.js';
import { convertAvatar, sha256, toBase64 } from '../upload/image.js';
import { publishWithRetry } from '../admin/github.js';
import { initSession, friendly as baseFriendly, setBusy } from '../admin/session.js';
import { projectHref } from '../../core/paths.js';

const NEW = '';
const friendly = error => baseFriendly(error, TeamError, ImportError);

export function init() {
  const $ = id => document.getElementById(id);
  const el = {
    form: $('member-form'), fields: $('member-fields'), select: $('member-select'),
    name: $('member-name'), role: $('member-role'), bio: $('member-bio'), bioCount: $('member-bio-count'),
    photo: $('member-photo'), photoHelp: $('member-photo-help'), status: $('member-status'),
    preview: $('preview'), previewCard: $('preview-card'), summary: $('preview-summary'),
    publish: $('publish'), cancel: $('cancel'), publishStatus: $('publish-status'),
    done: $('done'), doneTitle: $('done-titulo'), doneMessage: $('done-message'), again: $('again')
  };
  if (!el.form) return;
  const socialInputs = Object.fromEntries(NETWORKS.map(network => [network.key, $(`member-${network.key}`)]));

  let client = null;
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
    currentHtml = (await client.snapshot(TEAM_PAGE)).content;
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

  // ── Acesso ───────────────────────────────────────────────────────────
  initSession({
    async onLogin(candidate) {
      client = candidate;
      try {
        await loadTeam();
        el.fields.disabled = false;
      } catch (error) {
        el.status.textContent = friendly(error);
      }
    },
    onLogout() { client = null; discardDraft(); el.fields.disabled = true; }
  });

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
    if (!client) return;
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
      // Confere nome repetido antes de mostrar a prévia; a publicação confere de novo.
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
      el.status.textContent = 'Confira a prévia abaixo antes de publicar.';
      el.publish.focus();
    } catch (error) {
      el.status.textContent = friendly(error);
    } finally {
      setBusy(el.form, false);
    }
  });

  el.cancel.addEventListener('click', () => {
    discardDraft();
    el.status.textContent = 'Cancelado. Nada foi publicado.';
    el.name.focus();
  });

  // ── Publicar ─────────────────────────────────────────────────────────
  el.publish.addEventListener('click', async () => {
    if (!client || !draft) return;
    setBusy(el.preview, true);
    try {
      const { member, original, avatar } = draft;
      const photoFile = avatar ? [{ path: avatar.path, base64: await toBase64(avatar.blob) }] : [];
      const message = original ? `atualizando o card de ${member.name} na equipe` : `cadastrando ${member.name} na equipe`;
      await publishWithRetry(client, TEAM_PAGE, content => [...photoFile, { path: TEAM_PAGE, text: upsertMember(content, member, original) }],
        message, { onAttempt: attempt => {
          el.publishStatus.textContent = attempt === 1 ? 'Enviando para o GitHub…' : 'Outra pessoa publicou ao mesmo tempo. Tentando de novo…';
        } });

      discardDraft();
      el.select.value = member.name;
      await loadTeam().catch(() => {});
      el.status.textContent = '';
      el.doneTitle.innerHTML = original ? 'Card <em>atualizado!</em>' : 'Card <em>publicado!</em>';
      el.doneMessage.textContent = `${member.name} ${original ? 'foi atualizada' : 'foi incluída'} na página da equipe. O site é atualizado automaticamente em alguns minutos.`;
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
