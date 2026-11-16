// Cliente mínimo da API do GitHub usado pelas páginas da área da equipe:
// lê um arquivo do branch e publica um conjunto de arquivos num único commit.
// O token fica só na memória da aba (ou no sessionStorage, se a pessoa escolher).

export const REPO = { owner: 'Sinddylnn', name: 'mulheres-na-computacao-UEPB', branch: 'main' };

const API = 'https://api.github.com';

export class GitHubError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

export function createClient(token, repo = REPO, fetchImpl = globalThis.fetch.bind(globalThis)) {
  const base = `${API}/repos/${repo.owner}/${repo.name}`;

  async function request(path, { method = 'GET', body, accept = 'application/vnd.github+json' } = {}) {
    let response;
    try {
      response = await fetchImpl(path.startsWith('http') ? path : base + path, {
        method,
        headers: { Accept: accept, Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28',
          ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        cache: 'no-store'
      });
    } catch {
      throw new GitHubError('Sem conexão com o GitHub. Confira a internet e tente novamente.', 0);
    }
    if (response.status === 401) throw new GitHubError('Token inválido ou expirado. Gere um novo token.', 401);
    if (response.status === 403 || response.status === 404) {
      throw new GitHubError('Este token não tem permissão de escrita no repositório do site. Peça para ser adicionada como colaboradora.', response.status);
    }
    if (!response.ok) throw new GitHubError(`O GitHub recusou a operação (erro ${response.status}).`, response.status);
    return accept.endsWith('raw+json') ? response.text() : response.json();
  }

  return {
    /** Confere o token e devolve o login de quem vai publicar. */
    async verify() {
      const [user, info] = await Promise.all([request(`${API}/user`), request('')]);
      if (!info.permissions?.push) {
        throw new GitHubError('Este token não tem permissão de escrita no repositório do site. Peça para ser adicionada como colaboradora.', 403);
      }
      return user.login;
    },

    /** Lê a versão atual do branch e o conteúdo de um arquivo de texto nessa versão. */
    async snapshot(path) {
      const ref = await request(`/git/ref/heads/${repo.branch}`);
      const commit = await request(`/git/commits/${ref.object.sha}`);
      const content = await request(`/contents/${path}?ref=${ref.object.sha}`, { accept: 'application/vnd.github.raw+json' });
      return { head: ref.object.sha, tree: commit.tree.sha, content };
    },

    /**
     * Cria um commit com os arquivos e avança o branch sem forçar.
     * files: [{ path, base64 } | { path, text }]. Retorna false se o branch mudou no meio.
     */
    async commit(snapshot, files, message) {
      const tree = [];
      for (const file of files) {
        const blob = await request('/git/blobs', { method: 'POST', body: file.text !== undefined
          ? { content: file.text, encoding: 'utf-8' }
          : { content: file.base64, encoding: 'base64' } });
        tree.push({ path: file.path, mode: '100644', type: 'blob', sha: blob.sha });
      }
      const newTree = await request('/git/trees', { method: 'POST', body: { base_tree: snapshot.tree, tree } });
      const commit = await request('/git/commits', { method: 'POST', body: { message, tree: newTree.sha, parents: [snapshot.head] } });
      try {
        await request(`/git/refs/heads/${repo.branch}`, { method: 'PATCH', body: { sha: commit.sha, force: false } });
      } catch (error) {
        if (error.status === 422) return false;
        throw error;
      }
      return commit;
    }
  };
}

/**
 * Publica relendo o arquivo a cada tentativa, para nunca sobrescrever um envio simultâneo.
 * build(content) devolve a lista de arquivos do commit a partir do conteúdo atual de path.
 */
export async function publishWithRetry(client, path, build, message, { attempts = 3, onAttempt } = {}) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    onAttempt?.(attempt);
    const snapshot = await client.snapshot(path);
    const commit = await client.commit(snapshot, await build(snapshot.content), message);
    if (commit) return commit;
  }
  throw new GitHubError('Muitas publicações ao mesmo tempo. Aguarde um minuto e tente de novo.', 409);
}
