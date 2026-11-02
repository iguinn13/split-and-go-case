# Spec 04 — Saldos e Simplificação de Dívidas

## Contexto

A partir das despesas, o sistema calcula o **saldo** de cada participante e propõe o **menor número de transferências** para zerar todos. No fechamento, o plano é persistido e cada transferência pode ser marcada como paga.

## User stories

- **US-BAL-01** — Como participante, quero ver quanto devo ou tenho a receber.
- **US-BAL-02** — Como participante, quero ver o extrato detalhado de um participante, despesa por despesa.
- **US-BAL-03** — Como participante, quero um plano de pagamentos com o mínimo de transferências.
- **US-BAL-04** — Como organizador, quero fechar o grupo e congelar o plano final.
- **US-BAL-05** — Como participante, quero marcar uma transferência como paga.

## Requisitos funcionais

| ID | Requisito |
|---|---|
| RF-BAL-01 | `GET /groups/:id/balances` retorna o saldo de cada participante. |
| RF-BAL-02 | `GET /groups/:id/members/:memberId/statement` retorna o extrato do participante. |
| RF-BAL-03 | `GET /groups/:id/settlement-plan` retorna o plano de liquidação. Em grupo `OPEN` é calculado na hora; em grupo `CLOSED` retorna o plano persistido. |
| RF-BAL-04 | `POST /groups/:id/close` fecha o grupo e persiste o plano (somente dono). |
| RF-BAL-05 | `PATCH /groups/:id/transfers/:transferId/pay` marca uma transferência como paga. |

## Regras de negócio

### Saldo

| ID | Regra |
|---|---|
| RN-BAL-01 | `saldo = Σ(despesas pagas pelo participante) − Σ(partes do participante)`. Positivo: tem a receber. Negativo: deve. |
| RN-BAL-02 | **Invariante:** a soma dos saldos de um grupo é `0`. Se não for, o sistema responde `500` e registra erro (nunca mascara). |
| RN-BAL-03 | O **extrato** lista, em ordem cronológica, cada despesa em que o participante pagou e/ou tem parte, com `pago`, `devido`, `efeito no saldo` e `saldo acumulado`. O último saldo acumulado é igual ao saldo do participante. |

### Simplificação

| ID | Regra |
|---|---|
| RN-BAL-04 | O plano é uma lista de transferências `from → to → amountCents` com `amountCents > 0`, `from` com saldo negativo e `to` com saldo positivo. |
| RN-BAL-05 | Aplicar todas as transferências zera o saldo de todos os participantes. |
| RN-BAL-06 | Participantes com saldo `0` não aparecem no plano. |
| RN-BAL-07 | **Minimização:** com até 16 participantes de saldo diferente de zero, o número de transferências é o **mínimo possível** (`n − g`, onde `g` é o maior número de subgrupos disjuntos cuja soma de saldos é zero). Acima disso, usa-se a heurística gulosa (maior credor × maior devedor), que gera no máximo `n − 1` transferências. Ver ADR 0002. |
| RN-BAL-08 | O algoritmo é **determinístico**: mesma entrada gera o mesmo plano (desempates por `memberId` crescente). |
| RN-BAL-09 | O plano nunca transfere de um participante para ele mesmo e nunca repete o par `from → to`. |

### Fechamento e quitação

| ID | Regra |
|---|---|
| RN-BAL-10 | Só o dono fecha o grupo. Fechar um grupo já `CLOSED` retorna `409 GROUP_CLOSED`. |
| RN-BAL-11 | O fechamento é transacional: muda o status para `CLOSED`, grava `closedAt` e persiste as transferências com status `PENDING`. Se qualquer passo falhar, nada é gravado. |
| RN-BAL-12 | O fechamento é protegido contra concorrência: uma despesa criada ao mesmo tempo ou entra antes do fechamento (e no plano) ou é rejeitada com `GROUP_CLOSED`. |
| RN-BAL-13 | Fechar um grupo com todos os saldos zerados (ou sem despesas) é permitido e gera um plano vazio. |
| RN-BAL-14 | Qualquer participante vinculado pode marcar uma transferência como `PAID`; a operação é idempotente e grava `paidAt` na primeira vez. |
| RN-BAL-15 | Transferências só podem ser marcadas como pagas em grupo `CLOSED` (`409 GROUP_NOT_CLOSED`). |
| RN-BAL-16 | Um grupo `CLOSED` não reabre no MVP. |

## Exemplos

**Cadeia (exemplo canônico):** A deve 50 a B e B deve 50 a C. Saldos: A = −50, B = 0, C = +50. Plano: `A → C: 50`. (1 transferência em vez de 2.)

**Ciclo:** A deve 30 a B, B deve 30 a C, C deve 30 a A. Todos os saldos são 0. Plano vazio.

**Subgrupos independentes (onde o guloso erra):** saldos `A=+5, B=−3, C=−2, D=+4, E=−4` (em reais). Existem dois subgrupos que fecham zero sozinhos: `{A, B, C}` e `{D, E}`. Mínimo: **3** transferências (`B→A 3`, `C→A 2`, `E→D 4`). A heurística gulosa pura (maior credor × maior devedor) gera **4**.

## Critérios de aceite

### AC-BAL-01 — Saldo básico
- **Dado** que Ana pagou R$ 100,00 dividido igualmente entre Ana, Bia, Caio e Duda
- **Quando** chamo `GET /groups/:id/balances`
- **Então** Ana tem `+7500` e Bia, Caio e Duda têm `−2500` cada; a soma é `0`.

### AC-BAL-02 — Saldo com várias despesas
- **Dado** várias despesas de pagadores diferentes e rateios mistos
- **Quando** consulto os saldos
- **Então** cada saldo é `pago − devido` e a soma é `0`.

### AC-BAL-03 — Extrato individual
- **Quando** chamo `GET /groups/:id/members/:memberId/statement`
- **Então** recebo as linhas em ordem cronológica, cada uma com `paidCents`, `owedCents`, `netCents` e `runningBalanceCents`, e o último `runningBalanceCents` é igual ao saldo do participante.

### AC-BAL-04 — Cadeia simplificada
- **Dado** saldos A = −5000, B = 0, C = +5000
- **Quando** consulto o plano
- **Então** recebo exatamente 1 transferência: `A → C: 5000`.

### AC-BAL-05 — Mínimo de transferências
- **Dado** saldos (em centavos) `A=+500, B=−300, C=−200, D=+400, E=−400`
- **Quando** consulto o plano
- **Então** recebo exatamente 3 transferências (a heurística gulosa geraria 4).

### AC-BAL-06 — Plano zera tudo
- **Para** qualquer conjunto de despesas válido
- **Então** aplicar as transferências do plano aos saldos resulta em `0` para todos, e nenhum valor é `≤ 0`.

### AC-BAL-07 — Determinismo
- **Quando** consulto o plano duas vezes sem alterar despesas
- **Então** as duas respostas são idênticas.

### AC-BAL-08 — Grupo grande
- **Dado** um grupo com mais de 16 participantes de saldo diferente de zero
- **Quando** consulto o plano
- **Então** recebo um plano válido (zera tudo) com no máximo `n − 1` transferências, em menos de 1 segundo.

### AC-BAL-09 — Fechar grupo
- **Dado** um grupo `OPEN` do qual sou dono
- **Quando** chamo `POST /groups/:id/close`
- **Então** o status vira `CLOSED`, `closedAt` é preenchido e as transferências são persistidas como `PENDING`.

### AC-BAL-10 — Fechar sem permissão
- **Dado** que sou participante, mas não dono
- **Quando** tento fechar
- **Então** recebo `403 FORBIDDEN` e nada muda.

### AC-BAL-11 — Plano congelado
- **Dado** um grupo `CLOSED`
- **Quando** consulto o plano
- **Então** recebo o plano persistido, com o status de cada transferência.

### AC-BAL-12 — Marcar como paga
- **Dado** uma transferência `PENDING` em grupo `CLOSED`
- **Quando** marco como paga (duas vezes seguidas)
- **Então** o status é `PAID` e `paidAt` mantém a data da primeira chamada.

### AC-BAL-13 — Fechamento sem dívidas
- **Dado** um grupo sem despesas ou com todos os saldos zerados
- **Quando** o dono fecha
- **Então** o grupo fecha com plano vazio.

### AC-BAL-14 — Concorrência no fechamento
- **Dado** um fechamento e a criação de uma despesa simultâneos
- **Então** a despesa ou é incluída no plano ou é rejeitada com `GROUP_CLOSED`; nunca fica fora do plano com o grupo fechado.
