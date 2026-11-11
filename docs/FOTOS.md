# Importar fotos com prévia

Requer Node.js 22 ou superior. Execute `npm ci` na primeira utilização e `npm run fotos` para abrir a ferramenta em <http://127.0.0.1:8001>. Ela funciona somente no computador, sem conta ou serviço externo. Para encerrar, use `Ctrl+C`.

1. Escolha **Escolas** ou **Encontros** e informe o ano. Escolas usa somente o ano; encontros permite uma data opcional do mesmo ano.
2. Selecione até 20 fotos JPG, PNG ou WebP estático: 15 MB por foto, 60 MB por lote e 40 megapixels por imagem.
3. Clique em **Gerar prévia**. Confira imagens, destino, dimensões e tamanhos. Fotos ainda não foram adicionadas ao site.
4. Clique em **Adicionar à galeria**. **Cancelar prévia** descarta somente os arquivos temporários.
5. Use **Conferir a galeria** para abrir a página local atualizada na própria ferramenta. Para atualizar o site online, envie o cadastro, as fotos e as miniaturas pelo fluxo normal do Git.

## O que é salvo

| Destino | Conteúdo |
| --- | --- |
| `imagens/galeria/<categoria>/<ano-ou-data>/` | WebP com até 1600 px no lado maior, qualidade 80 |
| `imagens/miniaturas/<categoria>/<ano-ou-data>/` | WebP com até 480 px no lado maior, qualidade 72 |
| `imagens/fotos_originais/<categoria>/<ano-ou-data>/` | Cópia intacta de cada original selecionado |
| `data/timeline.json` | Cadastro existente acrescido do lote confirmado |
| `.mnc-fotos-backups/<lote>/timeline.json` | Cópia exata do cadastro anterior à importação |

As fotos mantêm a proporção, sem recorte ou ampliação, com orientação corrigida. Os nomes gerados são exclusivos: não substituem arquivos existentes e evitam reutilizar uma URL antiga no navegador. Os nomes de entrada podem conter espaços e acentos.

Originais e backups são locais, ignorados pelo Git e ficam fora do pacote publicado. Guarde uma cópia externa dos originais se precisar compartilhá-los com a equipe. A ferramenta e sua dependência Sharp também ficam fora do site publicado. O servidor oferece uma visualização das páginas públicas em `/site/`, sem disponibilizar originais ou backups.

## Preservação do acervo

- A prévia usa uma pasta temporária do sistema. Não executa varredura de originais nem altera as fotos cadastradas.
- A confirmação acrescenta somente as fotos escolhidas. Os eventos, metadados e arquivos anteriores permanecem intactos.
- Fotos idênticas no mesmo lote ou já cadastradas por este importador no mesmo evento são recusadas. Imagens antigas sem identificação de conteúdo não são comparadas automaticamente.
- Duplo clique ou repetição da mesma confirmação não duplica o lote.
- Se o cadastro mudar entre a prévia e a confirmação, a importação para e solicita nova prévia.
- Se a gravação falhar, somente os novos arquivos criados pela tentativa são revertidos. Não há comando de limpeza do acervo.
- Exclusão e substituição não fazem parte desta ferramenta. Essas ações exigem uma revisão explícita dos arquivos e do cadastro.

O conversor `tools/converter_fotos.py` não realiza mais alterações. O workflow antigo não é acionado por push e sua execução manual mostra apenas a orientação para usar o importador local. Não reative a reconstrução da timeline a partir dos originais: um acervo parcial ou fotos antigas arquivadas não representa necessariamente a galeria publicada.

## Se aparecer um erro

**Foto inválida ou repetida:** corrija a seleção e gere outra prévia. Nenhuma foto do lote foi adicionada.

**O cadastro mudou:** gere outra prévia para usar a versão mais recente. Uma importação não substitui mudanças feitas por outra pessoa.

**Outra importação está em andamento:** espere a outra operação terminar. Se o processo foi interrompido abruptamente, feche todos os importadores, confira `git diff` e os arquivos do último lote antes de remover manualmente `data/.fotos-import.lock`. Não remova esse bloqueio com uma importação ativa.

**Falha ou interrupção durante a confirmação:** confira o terminal e `git diff`. O cadastro anterior está no backup do lote; os novos nomes contêm o identificador do lote. Uma interrupção forçada pode deixar arquivos novos sem cadastro. Revise esses arquivos individualmente; não execute limpeza geral.

**Precisa desfazer um lote:** pare o importador e compare o cadastro atual com a cópia do lote em `.mnc-fotos-backups/`. Restaure o cadastro anterior somente se não houver importações posteriores que devam permanecer. A restauração do cadastro não apaga fotos ou originais. Revise qualquer exclusão separadamente.

## Testes

`npm ci` instala o Sharp usado na conversão e nos testes. `npm test` testa o fluxo em diretórios temporários, incluindo preservação de arquivos, falhas, cancelamento e importações concorrentes. Para incluir os testes HTTP do site, mantenha `npm start` ativo e defina `SITE_URL=http://127.0.0.1:8000` no terminal dos testes.
