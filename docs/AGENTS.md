# Diretrizes para agentes no projeto MNC

## Contexto

Este repositório contém o site institucional do projeto de extensão Mulheres na Computação (MNC), da UEPB. Consulte o README para a arquitetura e os comandos atuais.

## Arquitetura

- O site é estático e usa HTML, CSS e JavaScript em módulos ES6.
- Não há framework, bundler ou dependências de frontend em produção. O `package.json` configura os testes nativos do Node.js e o servidor local.
- `index.html` fica na raiz; as demais páginas ficam em `paginas/`.
- Cada página mantém seu documento HTML, estilos, scripts e conteúdo. Cabeçalho e rodapé são carregados dos arquivos compartilhados `header.html` e `footer.html` por `js/core/includes.js`, antes da inicialização dos controles. Não há build para desenvolvimento.
- `js/main.js` é o ponto de entrada e delega a inicialização a `js/core/bootstrap.js`.
- A galeria é gerada a partir de `data/timeline.json`.
- `tools/fotos/` contém o importador local com prévia, conversão WebP e cadastro incremental. O conversor Python antigo está desativado.
- `tools/build_site.py` copia os arquivos públicos para `_site` somente para publicação; `tools/validar_site.py` verifica a raiz por padrão ou a pasta passada como argumento.

## Regras de implementação

- Siga os componentes e convenções definidos em `docs/FRONTEND.md`; botões de ação usam `btn` e uma variante compartilhada, e campos usam `form-control`. Não crie sobrescritas locais para esses componentes.
- Preserve o uso de HTML, CSS e JavaScript puros, salvo solicitação explícita para mudar a arquitetura.
- Reutilize as variáveis e componentes CSS existentes antes de criar estilos duplicados.
- Coloque estilos específicos em `css/paginas/` e estilos compartilhados nos arquivos globais adequados.
- Use `js/core/paths.js` para recursos carregados pelo JavaScript.
- Edite navegação e rodapé somente em `header.html` e `footer.html`; não duplique esse conteúdo nas páginas. Mantenha os pontos de montagem com `data-include` e preserve os identificadores usados em `js/features/navigation.js`. Os caminhos dos fragmentos são relativos à raiz do projeto.
- Preserve os temas claro e escuro e valide os dois após mudanças visuais.
- Mantenha a interface responsiva e navegável por teclado. Em toda mudança de interface, siga a seção **Responsividade no celular** de `docs/FRONTEND.md`, mesmo quando o pedido não mencionar celular.
- Use HTML semântico, rótulos de formulário, textos alternativos e estados de foco visíveis.
- Não invente nomes, cargos, e-mails, métricas ou outros dados institucionais. Use marcadores claros quando o dado depender da equipe do MNC.
- Não inclua credenciais, tokens ou endpoints privados no repositório.

## Galeria

- Atualize a galeria pelo importador local: `npm ci` e `npm run fotos`. Consulte `docs/FOTOS.md`.
- Cada importação exige prévia e confirmação, acrescenta somente o lote escolhido e preserva o cadastro existente. Não reconstrua a timeline a partir das pastas de originais.
- Preserve a estrutura `imagens/galeria/<categoria>/<data-ou-ano>/`.
- Em escolas, use `escolas/<ano>/`, com um evento por ano na timeline e sem subpastas por data de visita. Siga essa organização também nos originais e nas miniaturas.
- Preserve a estrutura equivalente em `imagens/miniaturas/` e os metadados de dimensões da timeline.
- Trate `escola` e `escolas` como categorias com apresentação em acordeão.
- Não remova fotos nem arquivos gerados sem confirmar que não são mais utilizados.
- Não adicione limpeza automática nem substituição de fotos ao fluxo de importação. Exclusões exigem revisão separada.

## Execução e verificação

Sirva a raiz por HTTP usando Live Server ou o comando abaixo, pois módulos ES6 e chamadas `fetch` podem falhar com arquivos abertos diretamente:

```bash
node tools/serve_site.js
```

Após uma alteração, verifique pelo menos:

- a página inicial e a página modificada;
- o carregamento do cabeçalho e do rodapé;
- os links e caminhos de imagens;
- os temas claro e escuro;
- a matriz de larguras e os cenários aplicáveis definidos em **Responsividade no celular**, em `docs/FRONTEND.md`;
- o console do navegador, sem novos erros.

Execute também os testes locais:

```bash
node --test
```

O GitHub Actions executa o validador Python, mas não processa fotos nem altera o acervo. Para testar o importador e sua dependência Sharp, execute:

```bash
npm ci
npm test
npm run fotos
```

## Escopo das mudanças

- Mantenha este arquivo de instruções em `docs/AGENTS.md`; não crie nem mova `AGENTS.md` para a raiz do repositório.
- Centralize todos os arquivos `.md` e a documentação de desenvolvimento e manutenção em `docs/`. A única exceção é o `README.md` da raiz, que apresenta o projeto e aponta para os documentos. Ao criar um documento, adicione seu link na seção de documentação do README; não duplique instruções em outras pastas. Os PDFs de publicações disponibilizados no site continuam em `pdfs/`.
- Faça alterações pequenas e focadas no pedido atual.
- Preserve conteúdo institucional existente, salvo quando a atualização for solicitada.
- Não reformule toda a identidade visual para corrigir um problema localizado.
- Atualize a documentação quando mudar a estrutura, o processo de execução ou o fluxo da galeria.
