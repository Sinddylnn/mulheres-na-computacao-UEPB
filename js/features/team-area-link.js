import { projectHref } from '../core/paths.js';

const AREA = 'paginas/area-da-equipe/index.html';
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

/** O site publicado nunca roda nesses endereços; só o servidor local (npm start). */
export const isLocalHost = hostname => LOCAL_HOSTS.has(hostname);

/**
 * Mostra o link da Área da equipe ao lado do botão de tema, só no computador.
 * O link é criado aqui, e não em header.html, para que o site publicado não aponte para as ferramentas internas.
 */
export function initTeamAreaLink(location = window.location) {
  const themeToggle = document.getElementById('themeToggle');
  if (!themeToggle || !isLocalHost(location.hostname)) return;

  const link = document.createElement('a');
  link.className = 'team-area-link';
  link.href = projectHref(AREA);
  link.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg><span class="team-area-text">Área da equipe</span>';
  if (location.pathname.includes('/paginas/area-da-equipe/')) link.setAttribute('aria-current', 'page');
  themeToggle.before(link);
}
