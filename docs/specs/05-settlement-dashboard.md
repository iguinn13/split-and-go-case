# Spec 05 — Painel de Quitação (Interface)

## Contexto

O painel é a tela em que o grupo enxerga **quem deve a quem** e conclui o acerto. Esta spec cobre a experiência de uso das telas principais do MVP. O comportamento da API está nas specs 01 a 04.

## Princípios de UX

1. **Clareza antes de tudo:** valores formatados na moeda correta (`R$ 1.234,56`, `US$ 100.00`, `¥ 5.000`), com cor e rótulo textual (nunca só cor) para quem recebe (`+`, verde) e quem deve (`−`, vermelho).
2. **Mobile first:** todas as telas funcionam bem em 360 px de largura.
3. **Feedback imediato:** estados de carregamento, vazio e erro em todas as telas; mensagens de erro em português claro.
4. **Prevenção de erro:** o formulário de despesa mostra, antes de salvar, a prévia das partes calculadas e a diferença restante (porcentagem e valor fixo).
5. **Acessibilidade básica:** campos com `label`, foco visível, contraste AA, navegação por teclado.

## Telas

| Tela | Rota | Conteúdo |
|---|---|---|
| Cadastro / Login | `/register`, `/login` | Formulários com validação em tempo real. |
| Meus grupos | `/groups` | Lista de grupos (nome, status, nº de participantes), botão "Novo grupo". |
| Novo grupo | `/groups/new` | Nome, descrição, **moeda-base** (padrão BRL) e lista dinâmica de participantes (nome, e-mail opcional). |
| Detalhe do grupo | `/groups/[id]` | Abas: **Despesas**, **Saldos**, **Participantes**, **Quitação**. |
| Nova/editar despesa | modal ou `/groups/[id]/expenses/new` | Descrição, **moeda**, valor, **taxa de câmbio**, pagador, data, tipo de rateio, participantes e prévia. |
| Extrato do participante | `/groups/[id]/members/[memberId]` | Linhas despesa a despesa com saldo acumulado. |
| Painel de quitação | aba **Quitação** | Resumo, plano de liquidação e botão "Fechar grupo". |

## Requisitos funcionais

| ID | Requisito |
|---|---|
| RF-UI-01 | A aba **Saldos** mostra um cartão por participante com o saldo (a receber / a pagar / quitado). |
| RF-UI-02 | Ao clicar em um participante, abre o **extrato individual** com todas as linhas e o saldo acumulado. |
| RF-UI-03 | A aba **Quitação** mostra o plano de liquidação como lista de frases claras (ex.: "**Duda** paga **R$ 50,00** para **Ana**"), o total movimentado e o número de transferências. |
| RF-UI-04 | O botão **Fechar grupo** (somente dono, somente grupo `OPEN`) abre confirmação explicando que o grupo será congelado. |
| RF-UI-05 | Em grupo `CLOSED`, cada transferência tem o botão **Marcar como paga** e um indicador de status; um resumo mostra "x de y pagas". |
| RF-UI-06 | Em grupo `CLOSED`, ações de edição (despesas, participantes) ficam ocultas ou desabilitadas e um aviso informa que o grupo está fechado. |
| RF-UI-07 | O formulário de despesa tem os três modos de rateio, com prévia das partes e validação visual da soma (100% ou total). |
| RF-UI-08 | Erros da API são traduzidos para mensagens amigáveis a partir do código de erro (`code`). |
| RF-UI-09 | O formulário de despesa tem seletor de **moeda** (padrão: moeda-base). Ao escolher outra moeda, aparece o campo **taxa**, pré-preenchido com a sugestão do dia da despesa (`GET /exchange-rates`) e editável, e a prévia mostra o valor convertido ("≈ R$ 543,25"). |
| RF-UI-10 | O campo de valor respeita as casas decimais da moeda (JPY e KRW sem decimais). |
| RF-UI-11 | Se a sugestão de taxa falhar, a interface avisa ("Não foi possível buscar a taxa. Informe manualmente.") e o formulário continua utilizável. |
| RF-UI-12 | A lista e o extrato mostram, em despesas em moeda estrangeira, o valor original, a taxa e o valor convertido (ex.: "US$ 100,00 · taxa 5,4325 · R$ 543,25"). |

## Critérios de aceite

### AC-UI-01 — Saldos legíveis
- **Dado** um grupo com despesas
- **Quando** abro a aba Saldos
- **Então** vejo cada participante com valor formatado em BRL, rótulo ("recebe" / "deve" / "quitado") e cor correspondente.

### AC-UI-02 — Extrato individual
- **Quando** abro o extrato de um participante
- **Então** vejo cada despesa com descrição, data, quanto pagou, quanto devia e o saldo acumulado, e o total final é igual ao saldo exibido na aba Saldos.

### AC-UI-03 — Plano final
- **Quando** abro a aba Quitação
- **Então** vejo o plano em frases claras ("X paga R$ Y para Z"), o número de transferências e o total movimentado.
- **E** se não houver dívidas, vejo a mensagem "Tudo certo! Ninguém deve nada."

### AC-UI-04 — Fechar grupo
- **Dado** que sou dono de um grupo aberto
- **Quando** clico em "Fechar grupo" e confirmo
- **Então** o status muda para "Fechado", o plano fica congelado e as ações de edição somem.

### AC-UI-05 — Marcar transferência como paga
- **Dado** um grupo fechado com transferências pendentes
- **Quando** clico em "Marcar como paga"
- **Então** o item passa a "Paga" e o resumo ("x de y pagas") é atualizado.

### AC-UI-06 — Prévia do rateio
- **Quando** preencho o valor e escolho o tipo de rateio
- **Então** vejo a prévia das partes por participante em tempo real e o botão "Salvar" fica desabilitado enquanto a soma for inválida.

### AC-UI-07 — Estados vazio, carregando e erro
- **Para** cada lista ou painel
- **Então** existem estados distintos de carregamento, vazio (com chamada para ação) e erro (com botão "Tentar novamente").

### AC-UI-08 — Responsividade
- **Quando** acesso qualquer tela com 360 px de largura
- **Então** não há rolagem horizontal e todos os controles são utilizáveis.

### AC-UI-09 — Despesa em moeda estrangeira
- **Dado** um grupo em BRL
- **Quando** escolho USD no formulário e informo US$ 100,00
- **Então** vejo a taxa sugerida (editável), a prévia "≈ R$ 543,25" e a prévia das partes em reais; ao salvar, a despesa aparece na lista com valor original, taxa e valor convertido.

### AC-UI-10 — Moeda sem casas decimais
- **Quando** escolho JPY
- **Então** o campo de valor não aceita casas decimais e exibe `¥ 5.000`.

### AC-UI-11 — Falha na sugestão de taxa
- **Dado** que o provedor de câmbio está indisponível
- **Quando** escolho uma moeda estrangeira
- **Então** vejo o aviso de indisponibilidade e consigo digitar a taxa e salvar a despesa normalmente.

### AC-UI-12 — Moeda-base na criação do grupo
- **Quando** crio um grupo escolhendo USD como moeda-base
- **Então** saldos, extratos e plano de liquidação aparecem em dólares.
