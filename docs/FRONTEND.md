# Padrões do frontend

O site usa HTML, CSS e módulos JavaScript nativos. Os componentes compartilhados são a fonte de verdade; páginas combinam esses componentes e acrescentam somente seu layout e conteúdo.

## Responsabilidades

| Local | Responsabilidade |
| --- | --- |
| `css/base.css` | Cores dos temas, fontes, medidas compartilhadas, reset e foco por teclado |
| `css/components.css` | Botões, campos, avisos de formulário, badges e hero compartilhada |
| `css/layout.css` | Cabeçalho, menu, rodapé e suas adaptações para celular |
| `css/paginas/` | Layout e elementos exclusivos de cada página |
| `header.html` e `footer.html` | Conteúdo único da navegação e do rodapé |
| `js/core/` | Inicialização, fragmentos, caminhos e aplicação antecipada do tema |
| `js/features/` | Comportamentos compartilhados, com funções `initNome()` |
| `js/pages/` | Comportamentos específicos, com função pública `init()` |

## Botões

Use `btn` junto de uma variante. Links navegam; elementos `button` executam ações. Ambos recebem a mesma tipografia, alinhamento, altura mínima, borda e espaçamento.

```html
<a class="btn btn--primary" href="...">Quero participar</a>
<button class="btn btn--primary" type="submit">Enviar mensagem</button>
<a class="btn btn--secondary" href="...">Conhecer o programa</a>
<a class="btn btn--soft btn--small" href="..." download>Baixar PDF</a>
```

`btn--primary` mantém como referência o botão de acompanhar o Instagram: fonte de `.88rem`, peso 700 e altura de linha 1.65. Não sobrescreva fontes, padding ou cores de `.btn` em um CSS de página. Se uma nova variação for necessária, crie uma variante compartilhada. Estados `disabled` são centralizados; formulários com `aria-busy="true"` indicam envio em andamento. Filtros, acordeões e botões de ícone continuam sendo controles especializados.

## Formulários

Use `form-field` para agrupar rótulo e campo, `form-control` no input/textarea, `form-note` na orientação e `form-status` para retorno do envio. Associe rótulos com `for`/`id`, orientações com `aria-describedby` e mensagens com `role="status"`. Cada formulário define regras de validação e sua disposição responsiva. Nome, telefone/WhatsApp e mensagem do contato são obrigatórios.

## Páginas e acessibilidade

- Um único `h1` por página; `h2` para seções e `h3` para subseções.
- Conteúdo principal em `<main id="conteudo" tabindex="-1">`, destino do link de pular navegação.
- Cabeçalho e rodapé usam os pontos de montagem `data-include`, sem cópias locais.
- Ordem de estilos: base, layout, componentes, página.
- `theme-preload.js` é carregado como script clássico no head para aplicar o tema antes de mostrar a página. `main.js` é um módulo e inicializa os controles após carregar os fragmentos.
- Caminhos nos fragmentos são relativos à raiz do projeto; JavaScript usa `projectHref()` ou `projectUrl()`. Não use caminhos que dependam de o site estar na raiz do domínio.
- Foco por teclado é definido em `base.css`, com uma cor por tema. Evite regras locais que removam ou substituam o indicador de foco.

## Responsividade no celular

Esta seção se aplica a toda alteração de interface, inclusive mudanças de texto, fotos, cards e links. Considere celular desde o início da implementação e preserve o desktop. Uma tela correta em desktop não comprova que a versão móvel funciona.

### Implementação

- Use larguras fluidas e limites de conteúdo; evite larguras mínimas que ultrapassem a tela. Em filhos de flex/grid, aplique `min-width: 0` quando necessário. Para grades de cards, prefira colunas que se adaptem ao espaço disponível e uma coluna em telas estreitas.
- Escolha os pontos de quebra pelo conteúdo, observando onde menu, títulos, imagens e controles deixam de caber. Confira também larguras intermediárias, sem depender apenas de modelos específicos de celular.
- Deixe textos crescerem naturalmente. Não use altura fixa, truncamento ou redução excessiva da fonte para acomodar bios e descrições longas. Cards podem ter alturas iguais na mesma linha, mas não devem obrigar todas as linhas a ter a altura do maior card da página.
- Permita quebra de linha em títulos, links longos e grupos de botões. Preserve a proporção das imagens; use `object-fit` conforme a intenção de conter a imagem inteira ou recortar uma foto. Não distorça logos.
- Mantenha ícones e botões acionáveis por toque, com área de interação de pelo menos 44 × 44 pixels CSS e espaço entre ações. Rótulos precisam continuar legíveis, e ações não podem depender apenas de hover.
- No celular, remova ou adapte elementos `sticky` e posições absolutas que cubram conteúdo. Cabeçalho, menu, rodapé e botão de fechar precisam continuar acessíveis, inclusive em telas baixas e com o teclado virtual aberto.
- Layouts reorganizados por JavaScript, como os cards da equipe, devem considerar a quantidade atual de colunas e reagir ao redimensionamento. Preserve a ordem de leitura e de foco no DOM e os elementos fixados explicitamente, como a coordenadora.
- Não esconda conteúdo importante para fazê-lo caber. Não use `overflow-x: hidden` na página como solução para elementos que vazam; corrija a origem do problema. Áreas com rolagem própria, como uma tabela quando necessária, devem manter seu conteúdo acessível.

### Verificação antes de concluir

Sirva o projeto por HTTP com `node tools/serve_site.js`. Abra a página alterada em um navegador e confira os temas claro e escuro nas larguras abaixo, em pixels CSS:

| Largura | O que verificar |
| --- | --- |
| 320 px | Celular estreito: nenhum texto, card ou botão cortado; sem rolagem horizontal da página |
| 390 px | Celular: leitura, toque, espaçamentos e acesso a todas as ações |
| 768 px | Transição de layout: colunas, cabeçalho e elementos laterais sem sobreposição |
| 1280 px | Desktop: preservar o alinhamento e a apresentação existentes |

Confira também o entorno dos pontos de quebra afetados, uma tela baixa em orientação horizontal e zoom de 200% em uma largura de desktop. A matriz é uma referência mínima; ajuste a cobertura quando o problema ocorrer em outra dimensão.

Na área alterada, verifique conforme o componente:

- **Navegação:** abrir e fechar o menu móvel, seguir um link, alternar tema e navegar por teclado com foco visível. O menu não pode bloquear permanentemente a rolagem.
- **Cards:** testar textos curtos e longos, fotos e logos de proporções diferentes e links de redes sociais. Manter o alinhamento dos botões sem criar grandes espaços vazios entre linhas.
- **Formulários:** alcançar campos e envio com o teclado virtual aberto; conferir mensagens de erro e confirmação sem estouro de largura.
- **Galeria:** conferir filtros, acordeões, abertura e fechamento de fotos e controles do lightbox por toque e teclado, quando afetados.

Após mudanças em estilos ou comportamentos compartilhados, confira a página inicial e todas as páginas que usam o componente alterado. Em uma mudança local, confira a inicial e a página modificada. Inspecione também o console e o carregamento dos recursos.

Execute `node --test` para detectar regressões funcionais, mas não trate esses testes como validação visual. Na entrega, informe quais telas e larguras foram realmente conferidas. Se não houver navegador disponível, declare essa limitação e não afirme que a responsividade foi validada. Emulação de viewport ajuda a avaliar o layout; só afirme ter testado toque ou teclado virtual real quando isso tiver sido observado.

## Manutenção

Use nomes de classes e arquivos em kebab-case, funções JavaScript em camelCase e textos da interface em português. O `.editorconfig` define UTF-8, LF e indentação de dois espaços (quatro no Python). Preserve a formatação das áreas não alteradas.

Antes de concluir uma mudança no frontend, execute `node --test`. Use `SITE_URL` para incluir os testes HTTP com o servidor local ativo. O validador Python e o empacotamento são executados no GitHub Actions; para editar e visualizar o frontend localmente, Python é opcional. Confira as telas afetadas nos dois temas, em desktop e celular, e teste teclado, menu e formulários. Testes com respostas simuladas não comprovam entrega real de e-mail.
