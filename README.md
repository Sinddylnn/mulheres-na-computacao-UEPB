# Mulheres na Computação — MNC

Site institucional do projeto de extensão **Mulheres na Computação (MNC)** da Universidade Estadual da Paraíba (UEPB), Campus I. O projeto promove acolhimento, formação e protagonismo de meninas e mulheres na computação e é parceiro do Programa Meninas Digitais da Sociedade Brasileira de Computação.

## Rodar o site

O site usa HTML, CSS e JavaScript nativos. Não há framework, build nem pacotes npm para instalar. Abra a pasta no VS Code com **Live Server** ou, se tiver Node.js, execute:

```bash
node tools/serve_site.js
```

Acesse <http://127.0.0.1:8000>. Para encerrar o servidor, use `Ctrl+C`. Sirva o projeto por HTTP: abrir `index.html` diretamente com `file://` impede o carregamento confiável dos módulos, do cabeçalho, do rodapé e da galeria.

**Você não precisa instalar Python para criar páginas, editar estilos ou visualizar o site.**

## Páginas e arquivos

- `index.html`: página inicial.
- `paginas/`: Programa, Equipe, Galeria, Publicações, Parcerias e Quero participar, além da subpasta `area-da-equipe/` com as ferramentas internas (Enviar fotos e Cadastro da equipe), fora do menu.
- `header.html` e `footer.html`: menu e rodapé compartilhados por todas as páginas.
- `css/base.css`, `css/components.css` e `css/layout.css`: temas, componentes e layout comuns.
- `css/paginas/`: estilos específicos de cada página.
- `js/main.js`, `js/core/`, `js/features/` e `js/pages/`: inicialização e comportamentos.
- `data/timeline.json`, `imagens/galeria/` e `imagens/miniaturas/`: dados e fotos da galeria.
- `imagens/logos/`: símbolo do MNC, borboleta e ícone das abas do navegador.
- `pdfs/`: publicações para download.
- `docs/`: documentação do projeto, instruções para agentes e melhorias planejadas.

Para alterar o menu ou o rodapé, edite apenas `header.html` ou `footer.html`. Para adicionar uma página, crie seu HTML em `paginas/`, use os pontos de montagem `data-include` como nas outras páginas e registre o arquivo em `tools/build_site.py`. Consulte [os padrões do frontend](.claude/skills/frontend/SKILL.md) para componentes, cores por tema, acessibilidade e responsividade.

## Testar

Com Node.js instalado:

```bash
node --test
```

Os testes de arquivos e JavaScript rodam sem servidor. Para incluir os testes HTTP, mantenha `node tools/serve_site.js` aberto em um terminal e, em outro terminal PowerShell, execute:

```powershell
$env:SITE_URL = 'http://127.0.0.1:8000'
node --test
Remove-Item Env:SITE_URL
```

Antes de publicar, confira também o tema claro e escuro, o menu, o formulário e a galeria em desktop e celular. Os testes automatizados não confirmam o envio real de e-mails.

## Atualizar fotos

### Pela página da equipe (recomendado)

Abra `paginas/area-da-equipe/` no site publicado e escolha **Enviar fotos**. A página não aparece no menu nem nos buscadores e só funciona para colaboradoras do repositório. O mesmo token serve para a [página de cadastro da equipe](#pela-página-de-cadastro-recomendado).

1. Na primeira vez, peça para ser adicionada como colaboradora do repositório e crie um token do GitHub com a permissão `public_repo`. O passo a passo está na própria página, em **Como criar o seu token**.
2. Cole o token e clique em **Entrar**.
3. Escolha a categoria, o ano (e a data, nos encontros) e as fotos. Clique em **Preparar fotos** e confira a prévia.
4. Clique em **Publicar no site**. O site é atualizado sozinho em alguns minutos.

As fotos são convertidas para WebP no navegador, sem dados de localização. Os originais não saem do computador, e nada fica guardado depois do envio. Fotos já cadastradas no mesmo evento são recusadas. As mesmas regras de tamanho e organização do importador local valem aqui, porque as duas ferramentas usam o mesmo módulo (`js/pages/upload/model.js`).

### Pelo importador local

Use o importador local com prévia. Requer **Node.js 22 ou superior**. Na primeira utilização, na raiz do projeto:

```bash
npm ci
npm run fotos
```

Abra <http://127.0.0.1:8001>. Selecione a categoria, o ano e as fotos; clique em **Gerar prévia**. Confira as imagens e os tamanhos, depois clique em **Adicionar à galeria**. O botão **Conferir a galeria** abre o site local na própria ferramenta.

- Aceita JPG, PNG e WebP estático: até 20 fotos por lote, 15 MB por foto e 60 MB no total.
- Fotos em WebP com até 1600 px no lado maior, qualidade 80; miniaturas com até 480 px, qualidade 72. Não recorta nem amplia imagens pequenas e corrige a orientação.
- Escolas são organizadas por ano; encontros podem usar somente o ano ou uma data opcional.
- Acrescenta somente o lote confirmado ao cadastro existente. Não reconstrói o acervo, não apaga nem substitui fotos.
- Originais ficam preservados localmente em `imagens/fotos_originais/`, fora do Git e da publicação.
- Cada lote guarda o cadastro anterior em `.mnc-fotos-backups/`, também fora do Git e da publicação.
- A ferramenta não oferece exclusão ou substituição. Essas ações exigem revisão separada.

O conversor Python e o workflow antigo foram desativados. Arquivos soltos nas pastas de originais não entram no site automaticamente. Você não precisa reunir o acervo completo para importar fotos novas.

Após conferir, envie apenas os arquivos da galeria, as miniaturas e o cadastro:

```bash
git add imagens/galeria imagens/miniaturas data/timeline.json
git commit -m "Adiciona fotos à galeria"
git push
```

A importação atualiza o computador; a publicação continua pelo fluxo da branch `main`. Se uma importação falhar, confira o terminal e `git diff`; o cadastro anterior fica guardado em `.mnc-fotos-backups/`.

## Atualizar a equipe

As fotos dos perfis ficam em `imagens/equipe/` e os textos em [paginas/equipe.html](paginas/equipe.html).

### Pela página de cadastro (recomendado)

Abra `paginas/area-da-equipe/` no site publicado e escolha **Cadastrar na equipe**. Como a página de envio de fotos, ela fica fora do menu e dos buscadores e usa o mesmo token do GitHub.

1. Cole o token e clique em **Entrar**.
2. Em **Card**, mantenha **Nova integrante** ou escolha um nome para editar o card existente.
3. Preencha nome, cargo (opcional), apresentação, redes sociais e foto. Na edição, deixe a foto em branco para manter a atual.
4. Clique em **Ver prévia**, confira o card e clique em **Publicar no site**.

A foto é convertida para WebP no navegador, com até 600 px, e ganha um nome novo, sem substituir arquivos. Os links das redes precisam ser `https://` do Instagram, LinkedIn ou GitHub. A página não exclui cards; para remover alguém, edite o HTML.

### Manualmente

Para cada integrante, localize seu bloco `<article class="team-member ...">`, atualize a foto e acrescente a apresentação em `<p class="member-bio">...</p>` abaixo do nome. Essa classe aplica texto justificado. Prefira uma foto com o rosto centralizado, pois o site usa um recorte circular.

Para adicionar redes sociais, use o bloco de Sonally como referência: os três quadradinhos ficam abaixo da descrição. Troque os links e os rótulos `aria-label` para os perfis da integrante e inclua somente as redes que ela enviar.

## Publicação

Um push na branch `main` aciona a [publicação no GitHub Pages](.github/workflows/publicar-site.yml). O GitHub Actions valida o projeto, monta `_site` com os arquivos públicos e publica o resultado. Esses workflows ainda usam Python internamente; ele não é necessário para o desenvolvimento local do frontend.

Na primeira publicação, configure **GitHub Actions** como origem em **Settings → Pages → Build and deployment**.

## Formulário de contato

A página [Quero participar](paginas/quero-participar.html) tem um formulário de contato com nome, telefone/WhatsApp e mensagem obrigatórios. Ele usa o FormSubmit para encaminhar mensagens a `mnc.uepb@gmail.com`. Após o primeiro envio pelo site publicado, a equipe precisa confirmar o e-mail de ativação do serviço. Veja as [instruções do FormSubmit](https://formsubmit.co/help). Para confirmar a entrega, faça um envio real e confira a caixa de entrada.

## Documentação e contato

Toda a documentação de desenvolvimento e manutenção do projeto deve ficar em `docs/`, incluindo arquivos `.md`, guias, instruções para agentes e novos documentos. O único Markdown mantido na raiz é este `README.md`, que serve como apresentação e ponto de entrada para a documentação. A pasta `.claude/` contém apenas o arquivo que carrega `docs/CLAUDE.md` no Claude Code e as skills do projeto.

- [Instruções do projeto](docs/CLAUDE.md): comandos, arquitetura, regras gerais e verificações para agentes e colaboradores.
- [Padrões do frontend](.claude/skills/frontend/SKILL.md): componentes CSS, tokens de cor por tema, acessibilidade, responsividade e checklist de verificação de interface.
Ao criar um novo documento, salve-o em `docs/` e acrescente seu link nesta seção.

- E-mail: [mnc.uepb@gmail.com](mailto:mnc.uepb@gmail.com)
- Instagram: [@mnc.uepb](https://www.instagram.com/mnc.uepb/)
- LinkedIn: [Mulheres na Computação — UEPB](https://br.linkedin.com/company/mulheres-na-computa%C3%A7%C3%A3o-uepb)

O projeto está disponível sob a [licença MIT](LICENSE).
