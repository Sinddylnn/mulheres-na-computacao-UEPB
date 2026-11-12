// Regras do cadastro da equipe: lê e reescreve os cards de paginas/equipe.html.
// Funções puras, sem DOM, testadas em tests/team-admin.test.js.

export const TEAM_PAGE = 'paginas/equipe.html';
export const LIMITS = { name: 60, role: 60, bio: 700 };

export class TeamError extends Error {}

const INDENT = '          ';
const GRID = '<div class="team-grid-scroll">';
const CARD = /^[ \t]*<article class="card team-member[^"]*"[^>]*>[\s\S]*?<\/article>/gm;

export const NETWORKS = [
  { key: 'instagram', label: 'Instagram', hosts: ['instagram.com'],
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>' },
  { key: 'linkedin', label: 'LinkedIn', hosts: ['linkedin.com'],
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M7.5 10v7M11 17v-7m0 3a3 3 0 0 1 6 0v4"/><circle cx="7.5" cy="7" r="1" fill="currentColor" stroke="none"/></svg>' },
  { key: 'github', label: 'GitHub', hosts: ['github.com'],
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 19c-4 1-4-2-6-2m12 5v-4a3.5 3.5 0 0 0-1-2.7c3.3-.4 6.8-1.6 6.8-7A5.4 5.4 0 0 0 19.3 4a5 5 0 0 0-.1-4S18 0 15.2 1.5a13.4 13.4 0 0 0-7 0C5.4 0 4.2 0 4.2 0A5 5 0 0 0 4.1 4a5.4 5.4 0 0 0-1.5 3.8c0 5.4 3.5 6.6 6.8 7A3.5 3.5 0 0 0 8.5 18v4" transform="translate(1 2) scale(.9)"/></svg>' }
];

const escape = text => String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const unescape = text => String(text).replaceAll('&lt;', '<').replaceAll('&gt;', '>')
  .replaceAll('&quot;', '"').replaceAll('&#39;', "'").replaceAll('&amp;', '&');
const sameName = (a, b) => a != null && b != null
  && a.normalize('NFC').trim().toLocaleLowerCase('pt-BR') === b.normalize('NFC').trim().toLocaleLowerCase('pt-BR');

const normalize = html => html.replace(/\r\n/g, '\n');

/** Cards da página na ordem do arquivo: [{ name, start, end, block }]. */
export function parseMembers(html) {
  const text = normalize(html);
  const grid = text.indexOf(GRID);
  if (grid < 0) throw new TeamError('Não encontrei a grade da equipe em equipe.html. Nada foi alterado.');
  const members = [];
  for (const match of text.matchAll(CARD)) {
    if (match.index < grid) continue;
    const name = match[0].match(/<h3>([\s\S]*?)<\/h3>/);
    if (!name) throw new TeamError('Há um card da equipe sem nome em equipe.html. Nada foi alterado.');
    members.push({ name: unescape(name[1].trim()), start: match.index, end: match.index + match[0].length, block: match[0] });
  }
  return members;
}

/** Dados de um card: { name, role, bio, photo, social, fixed, open, pin }. */
export function parseMember(block) {
  const pick = pattern => { const found = block.match(pattern); return found ? unescape(found[1].trim()) : ''; };
  const social = {};
  for (const link of block.matchAll(/<a href="([^"]+)"[^>]*title="([^"]+)"/g)) {
    const network = NETWORKS.find(item => item.label === link[2]);
    if (network) social[network.key] = unescape(link[1]);
  }
  const open = block.match(/<article[^>]*>/)[0];
  return {
    name: pick(/<h3>([\s\S]*?)<\/h3>/),
    role: pick(/<p>([\s\S]*?)<\/p>/),
    bio: pick(/<p class="member-bio">([\s\S]*?)<\/p>/),
    photo: pick(/<img src="\.\.\/([^"]+)"/),
    social,
    fixed: open.includes('data-team-fixed'),
    open,
    pin: block.match(/[ \t]*<span class="member-pin"[\s\S]*?<\/span>\n/)?.[0] ?? ''
  };
}

/** Confere e limpa o que foi digitado. Lança TeamError com mensagem amigável. */
export function validateMember(input) {
  const name = String(input.name ?? '').replace(/\s+/g, ' ').trim();
  const role = String(input.role ?? '').replace(/\s+/g, ' ').trim();
  const bio = String(input.bio ?? '').replace(/\s+/g, ' ').trim();
  if (!name) throw new TeamError('Informe o nome.');
  if (name.length > LIMITS.name) throw new TeamError(`O nome pode ter até ${LIMITS.name} caracteres.`);
  if (role.length > LIMITS.role) throw new TeamError(`O cargo pode ter até ${LIMITS.role} caracteres.`);
  if (bio.length > LIMITS.bio) throw new TeamError(`A apresentação pode ter até ${LIMITS.bio} caracteres.`);
  const social = {};
  for (const network of NETWORKS) {
    const value = String(input.social?.[network.key] ?? '').trim();
    if (!value) continue;
    let url;
    try { url = new URL(value); } catch { throw new TeamError(`${network.label}: cole o endereço completo, começando com https://.`); }
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || !network.hosts.some(item => host === item || host.endsWith('.' + item))) {
      throw new TeamError(`${network.label}: use um link https:// do ${network.label}.`);
    }
    social[network.key] = url.href;
  }
  return { name, role, bio, social };
}

/** Caminho da foto nova; o trecho do hash evita substituir arquivos e o cache antigo. */
export function photoPath(name, digest) {
  const slug = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'integrante';
  return `imagens/equipe/${slug}-${digest.slice(0, 8)}.webp`;
}

/** HTML do card no mesmo formato dos cards escritos à mão. src permite usar outra imagem na prévia. */
export function renderMember(member, { open, pin = '', src } = {}) {
  const inner = INDENT + '  ';
  const name = escape(member.name);
  const lines = [
    INDENT + open,
    ...(pin ? [pin.replace(/\n$/, '')] : []),
    `${inner}<div class="member-avatar" aria-hidden="true"><img src="${escape(src ?? '../' + member.photo)}" alt="" loading="lazy" decoding="async"></div>`,
    `${inner}<h3>${name}</h3>`
  ];
  if (member.role) lines.push(`${inner}<p>${escape(member.role)}</p>`);
  if (member.bio) lines.push(`${inner}<p class="member-bio">${escape(member.bio)}</p>`);
  const links = NETWORKS.filter(network => member.social?.[network.key]);
  if (links.length) {
    lines.push(`${inner}<nav class="member-social-card" aria-label="Redes sociais de ${name}">`);
    for (const network of links) {
      lines.push(`${inner}  <a href="${escape(member.social[network.key])}" target="_blank" rel="noopener noreferrer" aria-label="${network.label} de ${name}" title="${network.label}">`,
        `${inner}    ${network.icon}`, `${inner}  </a>`);
    }
    lines.push(`${inner}</nav>`);
  }
  lines.push(INDENT + '</article>');
  return lines.join('\n');
}

/**
 * Inclui (originalName nulo) ou atualiza um card e devolve o novo HTML com finais de linha LF.
 * member: { name, role, bio, social, photo? }. Sem photo, a atualização mantém a foto atual.
 */
export function upsertMember(html, member, originalName = null) {
  const text = normalize(html);
  const members = parseMembers(text);
  if (members.some(item => sameName(item.name, member.name) && !sameName(item.name, originalName))) {
    throw new TeamError(`Já existe um card com o nome ${member.name}. Escolha esse card para editar.`);
  }
  if (originalName) {
    const target = members.find(item => sameName(item.name, originalName));
    if (!target) throw new TeamError(`O card de ${originalName} não está mais na página. Recarregue e tente de novo.`);
    const current = parseMember(target.block);
    const block = renderMember({ ...member, photo: member.photo || current.photo }, { open: current.open, pin: current.pin });
    return text.slice(0, target.start) + block + text.slice(target.end);
  }
  if (!member.photo) throw new TeamError('Escolha uma foto para o novo card.');
  const open = `<article class="card team-member reveal reveal-delay-${(members.length % 2) + 1}">`;
  const block = renderMember(member, { open });
  const last = members.at(-1);
  if (last) return text.slice(0, last.end) + '\n\n' + block + text.slice(last.end);
  const at = text.indexOf(GRID) + GRID.length;
  return text.slice(0, at) + '\n' + block + text.slice(at);
}
