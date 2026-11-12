# CLAUDE.md

Instruções para o Claude Code neste repositório. Este arquivo é carregado automaticamente por `.claude/CLAUDE.md` e é a única fonte de instruções para agentes.

Site estático institucional do projeto de extensão Mulheres na Computação (MNC), da UEPB. Toda a documentação e o conteúdo estão em português; escreva código, textos da interface e documentação em português.

## Ambiente

O desenvolvimento é feito no Windows com PowerShell 5.1, que não aceita `&&`. Encadeie comandos com `;` e use `if ($?) { ... }` quando o segundo depender do primeiro. Requer Node.js 22 ou superior. Python só é necessário para o validador e o empacotamento usados na CI.

## Comandos

```powershell
node tools/serve_site.js           # ou npm start — serve a raiz em http://127.0.0.1:8000
node --test                        # todos os testes Node (tests/*.test.js)
node --test tests/team.test.js     # um único arquivo de teste
npm ci; if ($?) { npm run fotos }  # importador de fotos em http://127.0.0.1:8001 (usa sharp)
```

- Sirva a raiz por HTTP; módulos ES6 e `fetch` falham com arquivos abertos diretamente.
- Os smoke tests HTTP (`tests/http-smoke.test.js`) só rodam com `SITE_URL` definido e o servidor aberto: `$env:SITE_URL = 'http://127.0.0.1:8000'; node --test; Remove-Item Env:SITE_URL`.
- Validação equivalente à CI: `python tools/validar_site.py` (raiz), `python tools/build_site.py` seguido de `python tools/validar_site.py _site`, e `python -m unittest discover -s tests -p 'test_*.py'`. A `.venv` local aponta para uma instalação de outro computador e não funciona sem ser recriada.
- Não há lint, bundler nem build para desenvolvimento. `_site/` é gerado apenas para publicação e está no `.gitignore`.

## Arquitetura

- HTML, CSS e JavaScript em módulos ES6, sem framework nem dependências de frontend. `index.html` fica na raiz; as demais páginas em `paginas/`, e as ferramentas internas em `paginas/area-da-equipe/`.
- **Inicialização**: cada página carrega `js/core/theme-preload.js` (script clássico no `<head>`, aplica o tema antes de exibir) e `js/main.js` (módulo). `js/core/bootstrap.js` injeta `header.html` e `footer.html` nos elementos `[data-include]`, inicializa os recursos de `js/features/` e importa o módulo da página indicado por `<body data-page="...">`, chamando seu `init()`.
- **Página nova**: registre-a em `pageInitializers` de `js/core/bootstrap.js` (se tiver comportamento) e em `PAGES` de `tools/build_site.py`.
- **Caminhos**: o site é publicado em subdiretório no GitHub Pages. `js/core/paths.js` resolve caminhos a partir da raiz via `import.meta.url` (`projectHref()`, `projectUrl()`), e `js/core/includes.js` reescreve `href`/`src` dos fragmentos. Caminhos nos fragmentos são relativos à raiz. Nunca use caminhos absolutos iniciados por `/`. O Windows ignora maiúsculas e minúsculas, mas a CI e o GitHub Pages não: escreva o nome exatamente como está no Git (`tests/file-case.test.js` confere).
- **Galeria** (`js/pages/gallery/`): `data.js` busca `data/timeline.json` → `model.js` normaliza (funções puras, testadas em `tests/gallery-model.test.js`) → `render.js` monta o DOM → `filters.js`, `accordion.js` e `lightbox.js` adicionam interação. Cada evento tem `categoria`, `data` (ano ou `AAAA-MM-DD`), `caminho_relativo`, `fotos` e `metadados` (largura, altura, miniatura), espelhando `imagens/galeria/` e `imagens/miniaturas/`.
- **Importador de fotos** (`tools/fotos/`): `server.js` atende só em 127.0.0.1, com token e CSP; a UI fica em `ui/`. `importer.js` converte para WebP com sharp (até 1600 px, qualidade 80; miniaturas até 480 px, qualidade 72), guarda os originais em `imagens/fotos_originais/` e acrescenta o lote à timeline de forma atômica (lock `data/.fotos-import.lock`, arquivo temporário, backup em `.mnc-fotos-backups/`). Originais e backups ficam fora do Git e da publicação. `tools/converter_fotos.py` é legado e está desativado.
- **Área da equipe** (pasta `paginas/area-da-equipe/`: `index.html` reúne `enviar-fotos.html` e `cadastro-equipe.html`, e cada ferramenta tem link de volta; os caminhos relativos ali começam com `../../`): páginas fora do menu e com `noindex`, que publicam direto na `main` pela API do GitHub com o token da colaboradora. `js/pages/admin/` tem o código comum: `github.js` (cliente da API e `publishWithRetry`, que relê o arquivo e tenta de novo se outra pessoa publicar ao mesmo tempo, sem forçar) e `session.js` (login por token). Os painéis usam as classes `.admin-*` de `css/components.css`.
- **Envio de fotos pela web** (`js/pages/upload/`): converte as fotos para WebP no navegador (`image.js`) e publica fotos, miniaturas e `timeline.json` num único commit. `model.js` concentra as regras do cadastro (destino, limites, duplicatas, nomes e inclusão na timeline) e é usado também pelo importador local; altere as regras somente ali.
- **Equipe**: os cards ficam em `paginas/equipe.html` (blocos `article.team-member`, cargo em `p`, bio em `p.member-bio`, fotos em `imagens/equipe/`). Podem ser editados à mão ou pela página `area-da-equipe/cadastro-equipe.html` (`js/pages/team-admin/`), cujo `model.js` lê e reescreve os cards como texto, no mesmo formato, preservando o card fixado; mantenha esse formato ao editar à mão, ou o teste `tests/team-admin.test.js` acusa a diferença. Fotos novas recebem nome com hash e nunca substituem arquivos. `js/pages/team.js` reorganiza os cards conforme o número de colunas, preservando a ordem do DOM e os cards fixados, como o da coordenadora.
- **Formulário de contato** (`paginas/quero-participar.html`): usa FormSubmit; nome, telefone/WhatsApp e mensagem são obrigatórios.
- **CI** (`.github/workflows/`): `validar-site.yml` roda em branches diferentes de `main` e em PRs; `publicar-site.yml` valida, empacota `_site` e publica no GitHub Pages a cada push em `main`. `otimizar-imagens.yml` está desativado e só exibe um aviso.

## Frontend

**Antes de criar ou alterar qualquer HTML, CSS ou JavaScript de interface, carregue a skill `frontend`** (`.claude/skills/frontend/SKILL.md`). Ela é a fonte única dos componentes compartilhados, dos tokens de cor por tema, das regras de acessibilidade e responsividade e do checklist de verificação. Não repita essas regras aqui.

## Regras gerais

- Preserve HTML, CSS e JavaScript puros, salvo pedido explícito para mudar a arquitetura.
- Edite navegação e rodapé somente em `header.html` e `footer.html`. Mantenha os pontos `data-include` e os identificadores usados em `js/features/navigation.js`.
- Não invente nomes, cargos, e-mails, métricas ou outros dados institucionais; use marcadores claros quando o dado depender da equipe.
- Não inclua credenciais, tokens ou endpoints privados no repositório.

## Galeria

- Atualize a galeria somente pelo importador local. Cada importação exige prévia e confirmação e acrescenta só o lote escolhido.
- Não reconstrua a timeline a partir das pastas de originais.
- Preserve a estrutura `imagens/galeria/<categoria>/<data-ou-ano>/` e a equivalente em `imagens/miniaturas/`, com os metadados de dimensões. Escolas usam `escolas/<ano>/`, com um evento por ano. `escola` e `escolas` são exibidas em acordeão.
- O importador nunca exclui nem substitui fotos; mantenha essa garantia. Não remova fotos nem arquivos gerados sem confirmar que não são usados; exclusões exigem revisão separada.

## Verificação

Rode `node --test` depois de qualquer alteração. Para mudanças de interface, siga também o checklist da skill `frontend`; os testes não substituem a validação visual.

## Git e escopo

- **Não faça commits nem push.** Somente a responsável pelo repositório faz commits; deixe as alterações no working tree e informe o que mudou.
- Documentação de desenvolvimento fica em `docs/`; na raiz, apenas `README.md`. Em `.claude/` ficam só o `CLAUDE.md` (que importa este arquivo) e as skills do projeto. Ao criar um documento, adicione o link na seção de documentação do README.
- Faça alterações pequenas e focadas, preserve o conteúdo institucional e atualize a documentação quando mudar estrutura, execução ou fluxo da galeria.
