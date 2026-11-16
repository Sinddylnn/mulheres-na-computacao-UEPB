// Login por token do GitHub, compartilhado pelas páginas da área da equipe.
// O token fica só na memória da aba ou, se a pessoa escolher, no sessionStorage
// (vale para as outras páginas da área abertas na mesma aba).
import { createClient, GitHubError } from './github.js';

const TOKEN_KEY = 'mnc-upload-token';

const storage = {
  get() { try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; } },
  set(value) { try { sessionStorage.setItem(TOKEN_KEY, value); } catch { /* armazenamento bloqueado */ } },
  clear() { try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* armazenamento bloqueado */ } }
};

/** Mensagem amigável para os erros esperados; os demais viram uma mensagem genérica. */
export function friendly(error, ...known) {
  return [GitHubError, ...known].some(type => error instanceof type)
    ? error.message : 'Algo deu errado. Nada foi publicado; tente novamente.';
}

export function setBusy(container, busy) {
  container.setAttribute('aria-busy', String(busy));
  container.querySelectorAll('button').forEach(button => { button.disabled = busy; });
}

/**
 * Liga o painel de acesso (ids login-form, token, remember, session, login-name,
 * logout, login-status). Chama onLogin(client) e onLogout().
 */
export function initSession({ onLogin, onLogout }) {
  const $ = id => document.getElementById(id);
  const el = {
    form: $('login-form'), token: $('token'), remember: $('remember'), session: $('session'),
    name: $('login-name'), logout: $('logout'), status: $('login-status')
  };

  async function login(token, remember) {
    el.status.textContent = 'Conferindo o acesso…';
    setBusy(el.form, true);
    try {
      const client = createClient(token);
      const user = await client.verify();
      if (remember) storage.set(token); else storage.clear();
      el.token.value = '';
      el.name.textContent = '@' + user;
      el.form.hidden = true;
      el.session.hidden = false;
      el.status.textContent = '';
      await onLogin(client);
    } catch (error) {
      storage.clear();
      el.status.textContent = friendly(error);
    } finally {
      setBusy(el.form, false);
    }
  }

  el.form.addEventListener('submit', event => {
    event.preventDefault();
    const token = el.token.value.trim();
    if (!token) { el.status.textContent = 'Cole o seu token do GitHub.'; el.token.focus(); return; }
    login(token, el.remember.checked);
  });

  el.logout.addEventListener('click', () => {
    storage.clear();
    onLogout();
    el.session.hidden = true;
    el.form.hidden = false;
    el.status.textContent = 'Você saiu. O token foi esquecido nesta aba.';
    el.token.focus();
  });

  const saved = storage.get();
  if (saved) { el.remember.checked = true; login(saved, true); }
}
