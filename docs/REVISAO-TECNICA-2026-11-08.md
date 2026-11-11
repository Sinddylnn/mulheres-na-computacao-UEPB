# Revisão técnica e melhorias do projeto MNC

Data: 08/11/2026. Base: árvore de trabalho local, incluindo as alterações ainda não commitadas do importador de fotos. Último commit: `a8686e0` — `excluindo fotos repetidas`.

## Parecer

A estrutura de site estático é adequada ao projeto. Não é necessário migrar para um framework nem reorganizar todas as páginas. As prioridades são corrigir as referências do acervo com revisão humana, alinhar a validação ao formato realmente utilizado e fortalecer o importador antes de ampliar seu uso.

Os testes existentes passam, mas não demonstram que todas as fotos publicadas existem. A validação completa do site falha. Foram encontrados problemas no código legado e também no importador recém-criado; estes últimos estão discriminados abaixo, com reprodução em diretórios temporários.

Nesta revisão não foram alterados código, dependências, cadastro, fotos ou originais. Foram criados este relatório e seu link no README. Testes de escrita e empacotamento ocorreram em pastas temporárias.

## Escopo e verificações executadas

| Verificação | Resultado |
| --- | --- |
| Ambiente de execução | Node.js `24.22.0`; npm `11.19.1`; projeto declara Node `>=22` |
| Dependências npm | Uma dependência direta de desenvolvimento: Sharp `0.35.5`; navegador sem dependências npm |
| `npm audit --json` | Zero vulnerabilidades conhecidas reportadas na consulta |
| `npm outdated --json` e `npm view sharp version engines --json` | Nenhuma atualização pendente; Sharp consultado exige Node `>=20.9.0`, compatível com o projeto |
| Testes Node com `SITE_URL` e servidor ativo | 25 aprovados, zero falhas, zero ignorados |
| Testes Python | 2 aprovados |
| `node --check` | 31 arquivos JavaScript em `js/`, `tools/` e `tests/`, sem erro de sintaxe |
| HTML e caminhos estáticos | 7 páginas, 130 referências HTML; sem erros pelo validador existente |
| CSS e módulos do site | 2 URLs CSS e 21 importações JavaScript verificadas; sem erros pelo validador existente |
| Âncoras internas estáticas | Nenhum destino inexistente encontrado entre as páginas analisadas; excluídos links externos e resolução dinâmica do navegador |
| Cadastro da galeria | 4 eventos, 34 fotos cadastradas; 5 imagens maiores ausentes; nenhuma miniatura cadastrada ausente |
| Validação completa | 22 erros: 21 rejeições de JPG e uma referência WebP ausente; há quatro JPGs ausentes que esse validador deixa de verificar |
| Empacotamento isolado | Concluído; os mesmos 22 erros persistem no artefato; cadastro copiado sem alteração |
| Separação de dados locais | Artefato testado sem `tools/`, `node_modules/`, `.mnc-fotos-backups/` e `imagens/fotos_originais/` |
| Referências de GitHub Actions | Tags `actions/checkout@v7`, `actions/setup-python@v7` e `actions/deploy-pages@v5` confirmadas nos repositórios oficiais |

Limites: esta revisão não executou validação visual em navegador, Lighthouse, leitura por tecnologia assistiva ou testes em dispositivo real. Não houve publicação, inspeção das configurações remotas de proteção de branches, envio real do formulário nem verificação de disponibilidade de todos os links externos. O resultado do npm audit não cobre Google Fonts, FormSubmit ou configurações de hospedagem.

## Melhorias prioritárias

Prioridades: **P1** bloqueia publicação ou pode comprometer a consistência do cadastro; **P2** afeta operação, recuperação ou cobertura; **P3** melhora manutenção, desempenho ou apresentação.

### 1. P1 — Corrigir cinco referências a fotos ausentes

Evidência: [cadastro da galeria](../data/timeline.json) e conferência direta dos caminhos usados pelo frontend. Os seguintes arquivos estão cadastrados, mas não existem:

```text
imagens/galeria/encontros/2026-05-11/encontro(11-05-2026) (4).webp
imagens/galeria/escolas/2025/escola(14-10-2025) (1).jpg
imagens/galeria/escolas/2025/escola(12-09-2025) (3).jpg
imagens/galeria/escolas/2024/escola(27-08-2024) (3).jpg
imagens/galeria/escolas/2024/escola(20-08-2024) (1).jpg
```

Impacto: a miniatura pode aparecer normalmente, mas abrir a foto ampliada resulta em um recurso inexistente. A reprodução da ausência não depende de cache.

Melhoria: revisar cada referência com a responsável pelo acervo. Se a exclusão foi intencional, retirar somente o registro correspondente; se não foi, recuperar o arquivo correto. **Não repovoar o site pela varredura dos originais nem executar limpeza geral.**

Aceite: todas as imagens maiores e miniaturas que permanecerem no cadastro existem e respondem com HTTP 200. A revisão não altera fotos sem relação com esses registros.

### 2. P1 — Alinhar o validador ao cadastro legado e conferir todos os arquivos

Evidência: [tools/validar_site.py](../tools/validar_site.py), linhas 300–324. O código rejeita nomes diferentes de `.webp` e executa `continue` antes da verificação do arquivo. Há 21 JPGs no cadastro. Além disso, ele exige miniatura com o mesmo nome da imagem maior, enquanto o legado usa nomes como `-miniatura.jpg`.

Impacto: a publicação é bloqueada por regras incompatíveis com o acervo atual, e quatro JPGs ausentes ficam sem diagnóstico de inexistência. [O workflow de publicação](../.github/workflows/publicar-site.yml) depende da validação.

Melhoria: separar validação de formato, estrutura e existência. Conferir o caminho real de `metadados[foto].miniatura`, inclusive nos registros legados. Definir uma política de compatibilidade: aceitar temporariamente os JPGs existentes ou migrar apenas um conjunto explicitamente selecionado, com prévia e revisão. Novas importações continuam em WebP.

Aceite: nenhuma regra de extensão impede a checagem de existência; há testes para JPG legado, miniatura com nome diferente, imagem maior ausente e miniatura ausente. O comando de validação e o artefato publicado passam após a revisão do acervo.

### 3. P1 — Validar o esquema completo antes de importar

Evidência: [tools/fotos/importer.js](../tools/fotos/importer.js), linhas 39–49 e 161–170. A checagem `typeof metadados === 'object'` também aceita um array.

Reprodução isolada: um evento com `metadados: []` foi aceito. A confirmação adicionou um nome em `fotos`, mas o JSON salvo manteve `metadados: []`, perdendo os metadados atribuídos como propriedades do array. Esse estado inválido não foi introduzido no acervo real.

Melhoria: definir um contrato de dados versionado e validar objetos comuns, categorias, datas, nomes, dimensões, caminhos, listas de fotos e correspondência dos metadados. Reutilizar o contrato nos testes do importador e do validador, evitando regras divergentes. Rejeitar o cadastro inválido antes de criar arquivos finais.

Aceite: `metadados: []`, tipos inválidos, eventos duplicados e caminhos inconsistentes são recusados sem alterar o cadastro ou gravar fotos no projeto.

### 4. P2 — Separar as prévias de abas diferentes

Evidência: [tools/fotos/importer.js](../tools/fotos/importer.js), linhas 65–68. Gerar uma prévia remove todas as prévias ainda não confirmadas do mesmo processo.

Reprodução isolada: gerar prévia A, gerar prévia B e tentar confirmar A retorna 404. A interface da primeira aba não é informada da invalidação.

Melhoria: associar cada prévia a uma sessão de aba ou permitir múltiplas prévias com prazo de expiração e limite de armazenamento. Cancelar ou renovar uma prévia deve afetar somente seu próprio identificador.

Aceite: duas abas conseguem gerar e cancelar suas prévias independentemente. Se uma confirmar primeiro, a outra recebe o aviso de cadastro alterado e pode refazer sua prévia.

### 5. P2 — Permitir recuperação previsível após uma confirmação falhar

Evidência: [tools/fotos/importer.js](../tools/fotos/importer.js), linhas 137–138. O backup usa criação exclusiva (`wx`), mas permanece quando a tentativa falha posteriormente.

Reprodução isolada: uma colisão de arquivo provocou `EEXIST`. Mesmo removendo a colisão do cenário de teste, confirmar novamente a mesma prévia falhou com `EEXIST` no backup.

Melhoria: tornar a preparação do backup idempotente, verificando seu conteúdo, ou invalidar explicitamente o lote após falha e orientar nova prévia. Preservar o backup e manter a proibição de sobrescrever fotos existentes. Separar o resultado da importação dos erros de liberação do lock, com recuperação documentada.

Aceite: simular falha depois do backup e antes de concluir. A repetição tem resultado definido, sem duplicar fotos, alterar arquivos anteriores ou retornar um erro genérico sem orientação.

### 6. P2 — Manter ordem cronológica ao adicionar eventos

Evidência: [tools/fotos/importer.js](../tools/fotos/importer.js), linha 159, e [renderização da galeria](../js/pages/gallery/render.js), função `renderTimeline`. Eventos novos entram com `unshift`; a renderização segue a ordem do cadastro.

Reprodução isolada: cadastrar um encontro de 2023 em um acervo com encontro de 2026 produziu a ordem `2023, 2026`.

Melhoria: ordenar uma cópia dos eventos na apresentação por data decrescente, com critério estável para empates. Assim é possível preservar a ordem física do cadastro quando isso for importante para revisão.

Aceite: importar um encontro antigo mantém o mais recente no início da linha do tempo. Escolas permanece agrupada por ano.

### 7. P2 — Cobrir caminhos reais e falhas de operação nos testes

Evidência: [tests/http-smoke.test.js](../tests/http-smoke.test.js) verifica páginas, fragmentos e poucos arquivos comuns. Não percorre as fotos do JSON. Por isso os 25 testes Node passam com cinco fotos ausentes.

Melhorias:

- Acrescentar teste de integridade que percorra todas as fotos e miniaturas cadastradas, sem modificar o acervo.
- Testar os quatro casos reproduzidos nos itens 3–6.
- Executar teste do site sob prefixo de URL, por exemplo `/MNC/`, além da raiz. Os smoke tests atuais usam caminhos iniciados por `/`; `new URL(path, baseUrl)` descarta um prefixo informado na base.
- Incluir a tela local nos testes de recursos e navegação por teclado. A sintaxe da UI deve ser conferida no CI, cujo comando atual percorre apenas `js/`.
- Disponibilizar um comando único que inicie um servidor de teste, execute os testes HTTP e o encerre, evitando que `npm test` omita dois testes quando `SITE_URL` estiver ausente.
- Separar as regras estruturais dos testes de conteúdo histórico: [tests/gallery-model.test.js](../tests/gallery-model.test.js) exige exatamente os anos 2024 e 2025 no acervo real. Uma atualização legítima deve ter revisão explícita desse teste; não deve falhar de forma surpreendente.

Aceite: caminho quebrado e prévia de outra aba são detectados automaticamente; a execução completa informa zero testes ignorados; o site funciona na raiz e sob prefixo.

### 8. P2 — Restringir o servidor local aos arquivos públicos

Evidência: [tools/serve_site.js](../tools/serve_site.js), linhas 20–46. A proteção impede sair da raiz, mas permite ler qualquer arquivo dentro dela. Uma consulta a `http://127.0.0.1:8000/.git/config` retornou HTTP 200. Seu conteúdo não foi exibido nem incluído neste relatório.

Impacto: `.git/`, backups, originais e arquivos internos não são diferenciados dos recursos públicos nesse servidor. Ele está limitado a `127.0.0.1`; isso **não demonstra exposição pública na internet**. O pacote de publicação testado exclui originais e backups corretamente.

Melhoria: permitir somente os recursos públicos conhecidos e rejeitar diretórios privados e arquivos ocultos. Reutilizar a mesma política no servidor de visualização do importador e no empacotamento. Conservar o bind local.

Aceite: páginas públicas retornam 200; `.git/`, originais, backups, temporários e código de ferramentas retornam 403 ou 404.

### 9. P3 — Planejar uma migração seletiva das imagens grandes

Evidência: as 29 imagens maiores cadastradas que existem somam `59.800.986` bytes, aproximadamente 57 MiB. As miniaturas cadastradas somam `1.545.375` bytes, aproximadamente 1,47 MiB. Uma foto JPG chega a `6.027.670` bytes.

Esses valores representam o acervo referenciado, **não uma medição de tráfego no carregamento inicial**. A galeria usa miniaturas e abertura da imagem maior sob interação; o custo dos arquivos grandes aparece principalmente nessa abertura.

Melhoria: selecionar e revisar os JPGs que devem permanecer, preparar WebP e miniaturas em paralelo e só depois atualizar suas referências. Preservar os originais e o backup. Medir qualidade e tamanho antes de definir o lote seguinte. O importador atual é de adição, não uma ferramenta pronta para essa migração.

Aceite: lista explícita de arquivos aprovados, comparação visual e de tamanho e nenhuma exclusão automática. Avaliar também dimensões HTML: 17 imagens estáticas analisadas não declaram simultaneamente `width` e `height`; verificar a reserva de espaço pelo CSS antes de concluir que existe deslocamento de layout.

### 10. P3 — Reduzir o acoplamento visual e concluir a validação da interface local

Evidência: [tools/fotos/server.js](../tools/fotos/server.js), linha 63, remove um `@import` do CSS compartilhado com expressão regular; a tela local também depende de estilos em `/site/css/layout.css` para componentes como o link de pular conteúdo.

Melhoria: separar os estilos compartilhados de acessibilidade e controles dos estilos específicos de layout público. Tornar o uso de fontes externas uma escolha explícita, evitando reescrever CSS ao servir o arquivo. Manter a UI local sem recursos externos obrigatórios.

Aceite: verificar os temas claro e escuro em 320, 390, 768 e 1280 px, teclado, zoom de 200%, prévia, erro, cancelamento e confirmação. Confirmar que o atalho de pular conteúdo aparece apenas quando focado. Não considerar os testes de HTTP como validação visual.

### 11. P3 — Melhorar a descoberta e o compartilhamento das páginas

Evidência: as sete páginas têm descrição, mas não têm canonical nem metadados Open Graph. Não foram encontrados `robots.txt` ou `sitemap.xml` na raiz.

Melhoria: definir o endereço oficial antes de adicionar canonical, imagem e descrição de compartilhamento. Gerar um sitemap somente das páginas públicas; manter ferramenta local, backups e originais fora dele. A ausência de `robots.txt` não impede, por si só, a indexação.

Aceite: metadados apontam para o domínio oficial correto e não para `localhost`; sitemap contém apenas páginas públicas existentes.

## Dependências e padrão do repositório

A separação atual é coerente e deve ser mantida:

| Área | Responsabilidade | Publicada |
| --- | --- | --- |
| `index.html`, `paginas/` | Páginas institucionais | Sim |
| `header.html`, `footer.html`, `css/`, `js/` | Estrutura e comportamento compartilhados | Sim |
| `data/timeline.json`, galeria e miniaturas | Cadastro aprovado e imagens do site | Sim |
| `tools/fotos/` | Ferramenta local de importação | Não |
| `tests/`, `docs/`, `.github/` | Verificação, documentação e automação | Não |
| Originais, backups e dependências locais | Acervo de segurança e ambiente de desenvolvimento | Não |

Recomendações de manutenção:

1. Entregar a nova funcionalidade em um conjunto completo de arquivos. No início desta revisão, `package-lock.json`, `tools/fotos/`, `tests/photo-importer.test.js` e `docs/FOTOS.md` ainda não eram rastreados pelo Git. Enviar somente arquivos já rastreados deixaria `npm ci` ou `npm run fotos` incompletos em um clone limpo. Nenhum commit foi criado nesta revisão.
2. Manter Sharp como dependência de desenvolvimento: o site publicado não precisa dele. Versionar o lockfile e usar `npm ci` no CI. Não há evidência que justifique trocar essa biblioteca nesta revisão.
3. Padronizar a versão de Node usada pela equipe e pelo CI com um arquivo de versão. Documentar a versão de Python necessária apenas às verificações e ao empacotamento. A `.venv/pyvenv.cfg` local referencia uma instalação de outro ambiente; não reutilizar nem versionar essa pasta.
4. Acrescentar padrões para `__pycache__/` e `*.pyc` ao `.gitignore`. O uso de Python nos testes pode gerar esses arquivos; nesta revisão foi utilizado `-B` para evitá-los.
5. Adicionar comandos de verificação documentados, por exemplo `check:js`, `test:http` e `check:site`. Evitar exigir que a pessoa memorize variáveis e comandos diferentes para obter uma validação completa.
6. Usar um contrato de arquivos públicos no empacotamento e na visualização. Atualmente são copiadas pastas públicas inteiras; manter testes que impeçam a inclusão acidental de originais, backups e temporários.
7. Documentar contribuição e revisão em `docs/`, conforme a convenção existente: branches, pequenos commits, revisão do acervo, validação e publicação. Verificar no GitHub proteção de `main` e checks obrigatórios; essas configurações não foram consultadas nesta auditoria.
8. Avaliar pinagem dos Actions por SHA e atualização automatizada de dependências. As tags conferidas existem; não foi encontrada referência inexistente entre as três verificadas.
9. Não adicionar framework, banco de dados ou serviço de upload remoto apenas para padronizar o repositório. A ferramenta local pode continuar isolada em `tools/`.

## Plano de execução sugerido

| Etapa | Entrega | Critério de conclusão |
| --- | --- | --- |
| 1 | Revisão das cinco referências ausentes e compatibilidade do validador | Fotos aprovadas acessíveis; nenhuma exclusão ampla; validação completa passa |
| 2 | Contrato de dados e correção das falhas do importador | Reproduções dos itens 3–6 viram regressões automatizadas e passam |
| 3 | Comando único de testes e verificação dos caminhos reais | Testes sem ignorados, integridade do acervo e prefixo de URL cobertos |
| 4 | Política pública de arquivos, ambiente e entrega completa no Git | Clone limpo instala, testa e abre site e importador; dados privados fora do artefato |
| 5 | Revisão visual, migração seletiva de imagens e metadados públicos | Qualidade aprovada e desempenho medido, sem regressão do conteúdo |

## Referências consultadas

- [Cadastro de dependências do projeto](../package.json) e [lockfile local](../package-lock.json).
- [Metadados oficiais do Sharp no npm](https://registry.npmjs.org/sharp/latest), consultados pelo comando `npm view`.
- [Checkout v7](https://github.com/actions/checkout/tree/v7), [Setup Python v7](https://github.com/actions/setup-python/tree/v7) e [Deploy Pages v5](https://github.com/actions/deploy-pages/tree/v5), cujas tags foram verificadas com `git ls-remote`.
- [Diretrizes do projeto](AGENTS.md), [padrões do frontend](FRONTEND.md) e [guia do importador](FOTOS.md).
