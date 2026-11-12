---
name: frontend
description: Padrões de interface do site MNC — componentes CSS compartilhados, tokens de cor por tema, acessibilidade, responsividade e checklist de verificação. Use SEMPRE antes de criar ou alterar qualquer HTML, CSS ou JavaScript de interface (páginas, cards, botões, formulários, cabeçalho, rodapé, galeria, equipe, parcerias), inclusive mudanças pequenas de texto, foto ou estilo.
---

# Frontend do MNC

Site estático em HTML, CSS e JavaScript puros. Os componentes compartilhados são a fonte de verdade: a página combina componentes e acrescenta apenas layout e conteúdo próprios. Antes de escrever CSS novo, procure aqui um componente ou token que já resolva.

## Onde cada coisa fica

| Arquivo | Conteúdo |
| --- | --- |
| `css/base.css` | Tokens (cores, temas, raios, fontes, medidas), reset e foco |
| `css/components.css` | Botões, campos, overline, títulos, cards, decorações, animações, hero interna |
| `css/layout.css` | Cabeçalho, menu, rodapé e fundo quadriculado |
| `css/paginas/<pagina>.css` | Só o que é exclusivo da página |
| `header.html`, `footer.html` | Navegação e rodapé (únicos; nunca copie nas páginas) |
| `js/features/` | Comportamentos compartilhados, exportam `initNome()` |
| `js/pages/` | Comportamento da página, exporta `init()` |

Ordem dos estilos em toda página: `base.css`, `layout.css`, `components.css`, CSS da página.

## Tokens de cor

O tema claro é `[data-theme="light"]` no `<html>`. **Não crie regras `[data-theme="light"]` para trocar teal por roxo**: use os tokens de destaque, que já mudam sozinhos.

| Token | Escuro | Claro | Uso |
| --- | --- | --- | --- |
| `--accent-text` | teal | roxo escuro | Texto e ícones de destaque |
| `--accent-surface` | teal claro translúcido | lilás translúcido | Fundo de pílulas, ícones e botões suaves |
| `--accent-border` | borda teal | borda lilás | Borda de elementos de destaque |
| `--accent-strong` | teal | roxo escuro | Fundo sólido em hover ou estado ativo |
| `--on-accent` | escuro | branco | Texto sobre `--accent-strong` |
| `--on-teal` | escuro | escuro | Texto sobre teal fixo (`btn--primary`) |

Também use `--bg-page`, `--bg-surface`, `--bg-card`, `--border`, `--text-primary`, `--text-secondary`, `--text-muted`, `--shadow-sm`, `--shadow-md`, `--radius-*` e `--control-height` (44px). Cores fixas (`#fff`, `rgba(...)`) só em superfícies que são escuras nos dois temas, como o rodapé e os banners roxos.

## Componentes

### Botões

```html
<a class="btn btn--primary" href="...">Quero participar</a>
<button class="btn btn--primary" type="submit">Enviar</button>
<a class="btn btn--secondary" href="...">Conhecer o programa</a>
<a class="btn btn--soft btn--small" href="..." download>Baixar PDF</a>
```

Links navegam; `button` executa ações. Não sobrescreva fonte, padding ou cores de `.btn` no CSS da página. Se precisar de outra aparência, crie uma variante em `components.css`. Filtros da galeria (`.btn-filtro`, com `aria-pressed`), acordeões e botões de ícone são controles especializados.

### Formulários

`form-field` (rótulo + campo), `form-control` (input/textarea), `form-note` (orientação), `form-status` (retorno, com `role="status"`). Associe rótulos com `for`/`id` e orientações com `aria-describedby`.

### Overline (pílula acima do título)

```html
<span class="overline">Quem somos</span>
```

### Destaque em título

Qualquer `<em>` dentro de `h1` ou `h2` fica em itálico com `--accent-text`. Não crie regras `h2 em` por página. Em fundo roxo fixo, sobrescreva com `color: inherit`.

### Cabeçalho de seção

```html
<div class="section-heading reveal">
  <span class="overline">Por que participar</span>
  <h2>Título com <em>destaque</em></h2>
  <p>Descrição opcional.</p>
</div>
```

### Cards

Todo card usa `.card` e uma classe própria só para padding e layout:

```html
<div class="card info-card reveal">...</div>
<div class="card card--accent info-card">...</div>          <!-- faixa gradiente lateral -->
<div class="card card--accent-bottom opp-card">...</div>    <!-- faixa na base, no hover -->
```

`.card` já define fundo, borda, raio, transição e o hover/foco (sobe 5px, borda teal, sombra). Não repita essas propriedades na classe da página. Dentro do card:

- `<h3 class="card-eyebrow">` para título curto em caixa alta;
- `<div class="icon-box"><svg>…</svg></div>` para ícone, que reage ao hover do card.

Blocos de chamada com fundo gradiente suave usam `.call-panel` (com `h2` e `p`).

### Área da equipe

Páginas de formulário fora do menu (`enviar-fotos`, `cadastro-equipe`) usam `.admin-hero` na hero, `.admin-section` > `.admin-inner` como coluna e `.card.admin-panel` para cada etapa (sem o deslocamento de hover). Dentro do painel: `.admin-fields` (grade de campos), `.admin-check` (checkbox), `.admin-actions` (botões; `--center` no `.call-panel` final), `.admin-session` e `.admin-help`. O login e a publicação vêm de `js/pages/admin/`.

### Decorações

```html
<section class="page-hero">                     <!-- position:relative + overflow:hidden -->
  <div class="bg-glow bg-glow--start" aria-hidden="true"></div>
  <div class="bg-glow bg-glow--end" aria-hidden="true"></div>
  <div class="page-hero-inner">...</div>        <!-- conteúdo com position:relative e z-index:1 -->
</section>
```

- `.section-illustration` fica entre seções; `.section-illustration--edge` a centraliza sobre a borda superior de uma seção com `position:relative`.
- `.arrow-down` indica rolagem na hero.
- `.reveal` com `.reveal-delay-1` a `-4` anima a entrada (respeita `prefers-reduced-motion`).

## Regras

- Reutilize componente ou token antes de criar CSS. Se o mesmo bloco aparecer em duas páginas, ele vai para `components.css`.
- Caminhos são relativos à raiz do projeto; no JavaScript use `projectHref()`/`projectUrl()` de `js/core/paths.js`. Nunca comece um caminho com `/`.
- Uma página nova precisa do `<body data-page="...">`, de `pageInitializers` em `js/core/bootstrap.js` (se tiver comportamento) e de `PAGES` em `tools/build_site.py`.
- Um único `h1` por página; `h2` para seções e `h3` para subseções. Conteúdo em `<main id="conteudo" tabindex="-1">`.
- HTML semântico, `alt` em imagens, rótulos em campos e foco visível (definido em `base.css`; não remova).
- Classes e arquivos em kebab-case, funções em camelCase, textos da interface em português. `.editorconfig`: UTF-8, LF, dois espaços.
- Não invente nomes, cargos, e-mails ou números institucionais; use marcadores claros quando o dado depender da equipe.

## Responsividade no celular

Vale para toda mudança de interface, mesmo quando o pedido não menciona celular.

- Larguras fluidas; `min-width:0` em filhos de flex/grid; grades de cards caem para uma coluna em telas estreitas.
- Sem altura fixa ou truncamento para acomodar texto. Títulos, links e grupos de botões podem quebrar linha. Imagens e logos mantêm a proporção.
- Alvos de toque com pelo menos 44 × 44 px (`--control-height`); nenhuma ação depende só de hover.
- Não use `overflow-x:hidden` para esconder vazamentos; corrija a origem.
- Layouts reorganizados por JavaScript (cards da equipe) devem reagir ao redimensionamento e preservar a ordem do DOM e os cards fixados.

## Verificação antes de concluir

1. `node --test` (com `SITE_URL` e o servidor aberto, para incluir os testes HTTP).
2. Sirva com `node tools/serve_site.js` e confira a página alterada e a inicial, nos temas claro e escuro, em 320, 390, 768 e 1280 px, e com zoom de 200% no desktop.
3. Confira cabeçalho, rodapé, menu móvel, foco por teclado e o console sem erros novos.
4. Se mexeu em `components.css` ou `base.css`, confira todas as páginas que usam o componente.
5. Na entrega, diga quais telas e larguras foram realmente conferidas. Sem navegador disponível, declare a limitação e não afirme que o visual foi validado.
