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
- `paginas/`: Programa, Equipe, Galeria, Publicações, Parcerias e Quero participar.
- `header.html` e `footer.html`: menu e rodapé compartilhados por todas as páginas.
- `css/base.css`, `css/components.css` e `css/layout.css`: temas, componentes e layout comuns.
- `css/paginas/`: estilos específicos de cada página.
- `js/main.js`, `js/core/`, `js/features/` e `js/pages/`: inicialização e comportamentos.
- `data/timeline.json`, `imagens/galeria/` e `imagens/miniaturas/`: dados e fotos da galeria.
- `imagens/logos/`: símbolo do MNC, borboleta e ícone das abas do navegador.
- `pdfs/`: publicações para download.
- `docs/`: documentação do projeto, diretrizes para agentes e padrões do frontend.

Para alterar o menu ou o rodapé, edite apenas `header.html` ou `footer.html`. Para adicionar uma página, crie seu HTML em `paginas/`, use os pontos de montagem `data-include` como nas outras páginas e registre o arquivo em `tools/build_site.py`. Consulte [os padrões do frontend](docs/FRONTEND.md) para botões, formulários, temas e acessibilidade.

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

A importação atualiza o computador; a publicação continua pelo fluxo da branch `main`. Veja o [guia do importador](docs/FOTOS.md) para limites, cópias de segurança e recuperação de erros.

## Atualizar a equipe

As fotos dos perfis ficam em `imagens/equipe/` e os textos em [paginas/equipe.html](paginas/equipe.html). Essa parte é editada manualmente e não usa o conversor da galeria.

Para cada integrante, localize seu bloco `<article class="team-member ...">`, atualize a foto e acrescente a apresentação em `<p class="member-bio">...</p>` abaixo do nome. Essa classe aplica texto justificado. Prefira uma foto com o rosto centralizado, pois o site usa um recorte circular.

Para adicionar redes sociais, use o bloco de Sonally como referência: os três quadradinhos ficam abaixo da descrição. Troque os links e os rótulos `aria-label` para os perfis da integrante e inclua somente as redes que ela enviar.

## Publicação

Um push na branch `main` aciona a [publicação no GitHub Pages](.github/workflows/publicar-site.yml). O GitHub Actions valida o projeto, monta `_site` com os arquivos públicos e publica o resultado. Esses workflows ainda usam Python internamente; ele não é necessário para o desenvolvimento local do frontend.

Na primeira publicação, configure **GitHub Actions** como origem em **Settings → Pages → Build and deployment**.

## Formulário de contato

A página [Quero participar](paginas/quero-participar.html) tem um formulário de contato com nome, telefone/WhatsApp e mensagem obrigatórios. Ele usa o FormSubmit para encaminhar mensagens a `mnc.uepb@gmail.com`. Após o primeiro envio pelo site publicado, a equipe precisa confirmar o e-mail de ativação do serviço. Veja as [instruções do FormSubmit](https://formsubmit.co/help). Para confirmar a entrega, faça um envio real e confira a caixa de entrada.

## Documentação e contato

Toda a documentação de desenvolvimento e manutenção do projeto deve ficar em `docs/`, incluindo arquivos `.md`, guias, instruções para agentes e novos documentos. O único Markdown mantido na raiz é este `README.md`, que serve como apresentação e ponto de entrada para a documentação. Não crie cópias de `AGENTS.md` ou de outros documentos fora de `docs/`.

- [Diretrizes do projeto](docs/AGENTS.md): arquitetura, regras de implementação e verificações para agentes e colaboradores.
- [Padrões do frontend](docs/FRONTEND.md): componentes, acessibilidade e requisitos de responsividade no celular, incluindo as larguras e os cenários que devem ser conferidos em alterações visuais.
- [Revisão técnica e melhorias — 08/11/2026](docs/REVISAO-TECNICA-2026-11-08.md): diagnóstico de dependências, caminhos, acervo, importador, testes e publicação, com prioridades e critérios de aceite.

Ao criar um novo documento, salve-o em `docs/` e acrescente seu link nesta seção.

- E-mail: [mnc.uepb@gmail.com](mailto:mnc.uepb@gmail.com)
- Instagram: [@mnc.uepb](https://www.instagram.com/mnc.uepb/)
- LinkedIn: [Mulheres na Computação — UEPB](https://br.linkedin.com/company/mulheres-na-computa%C3%A7%C3%A3o-uepb)

O projeto está disponível sob a [licença MIT](LICENSE).
