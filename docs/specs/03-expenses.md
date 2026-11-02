# Spec 03 — Despesas e Rateio

## Contexto

Uma despesa é paga por **1 participante** e dividida entre **N participantes**. O rateio pode ser igualitário, por porcentagem ou por valor fixo. Todos os valores são inteiros em centavos de BRL.

## User stories

- **US-EXP-01** — Como participante, quero lançar uma despesa informando quem pagou e entre quem ela é dividida.
- **US-EXP-02** — Como participante, quero dividir igualmente (ex.: R$ 100 / 4) sem me preocupar com centavos.
- **US-EXP-03** — Como participante, quero dividir por porcentagem ou por valor fixo quando o consumo foi desigual.
- **US-EXP-04** — Como participante, quero ver, editar e excluir despesas enquanto o grupo está aberto.

## Requisitos funcionais

| ID | Requisito |
|---|---|
| RF-EXP-01 | `POST /groups/:id/expenses` cria uma despesa com rateio. |
| RF-EXP-02 | `GET /groups/:id/expenses` lista as despesas do grupo, da mais recente para a mais antiga, com paginação. |
| RF-EXP-03 | `GET /groups/:id/expenses/:expenseId` retorna a despesa com as partes calculadas. |
| RF-EXP-04 | `PUT /groups/:id/expenses/:expenseId` substitui a despesa e recalcula as partes. |
| RF-EXP-05 | `DELETE /groups/:id/expenses/:expenseId` exclui a despesa. |
| RF-EXP-06 | As partes (`shares`) são calculadas pelo servidor e persistidas junto da despesa. O cliente nunca envia partes calculadas para `EQUAL`. |

## Modelo de entrada

```jsonc
{
  "description": "Jantar",
  "amountCents": 10000,            // inteiro > 0
  "paidByMemberId": "uuid",
  "occurredOn": "2026-07-10",      // YYYY-MM-DD
  "split": {
    "type": "EQUAL",               // EQUAL | PERCENTAGE | FIXED
    "participantIds": ["uuid", "uuid", "uuid"]          // EQUAL
    // "shares": [{ "memberId": "uuid", "basisPoints": 5000 }]   // PERCENTAGE
    // "shares": [{ "memberId": "uuid", "amountCents": 4000 }]   // FIXED
  }
}
```

## Regras de negócio

| ID | Regra |
|---|---|
| RN-EXP-01 | `amountCents` é inteiro, `> 0` e `≤ 100.000.000` (R$ 1.000.000,00). |
| RN-EXP-02 | `description`: 1 a 120 caracteres após trim. |
| RN-EXP-03 | O pagador e todos os participantes do rateio precisam ser participantes ativos do grupo. |
| RN-EXP-04 | O pagador **pode** não participar do rateio (ex.: pagou um presente para os outros). |
| RN-EXP-05 | O rateio tem no mínimo 1 participante e nenhum participante repetido. |
| RN-EXP-06 | **EQUAL:** `base = floor(total / n)`; `resto = total mod n`. Os `resto` primeiros participantes, ordenados por `memberId` crescente, recebem `base + 1`; os demais, `base`. |
| RN-EXP-07 | **PERCENTAGE:** cada `basisPoints` é inteiro `≥ 1` e a soma é exatamente `10000`. A parte base é `floor(total × bp / 10000)`. O resto de centavos vai um a um para os maiores restos fracionários (`total × bp mod 10000`); empate desfaz por `memberId` crescente. |
| RN-EXP-08 | **FIXED:** cada `amountCents` é inteiro `≥ 1` e a soma é exatamente `amountCents` da despesa. |
| RN-EXP-09 | Invariante: a soma das partes calculadas é sempre igual a `amountCents`. |
| RN-EXP-10 | Somente o criador da despesa ou o dono do grupo pode editar/excluir. Qualquer participante vinculado pode criar. |
| RN-EXP-11 | Grupo `CLOSED` não aceita criar, editar nem excluir despesas (`409 GROUP_CLOSED`). |
| RN-EXP-12 | Moeda é sempre BRL. Valores com fração de centavo são rejeitados na validação (o campo é inteiro). |
| RN-EXP-13 | Grupo com menos de 2 participantes não aceita despesas (`409 GROUP_NEEDS_MORE_MEMBERS`). |

## Exemplos de cálculo

| Cenário | Entrada | Partes |
|---|---|---|
| Igualitário exato | R$ 100,00 / 4 | 2500 · 2500 · 2500 · 2500 |
| Igualitário com resto | R$ 100,00 / 3 | 3334 · 3333 · 3333 (o 1º por `memberId` leva o centavo) |
| Porcentagem | R$ 100,00 · 50% / 30% / 20% | 5000 · 3000 · 2000 |
| Porcentagem com resto | R$ 10,01 · 50% / 50% | 501 · 500 (empate no resto, desempata por `memberId`) |
| Valor fixo | R$ 100,00 · 60,00 / 40,00 | 6000 · 4000 |

## Critérios de aceite

### AC-EXP-01 — Rateio igualitário exato
- **Dado** um grupo com 4 participantes
- **Quando** lanço R$ 100,00 pago por Ana, dividido igualmente entre os 4
- **Então** cada parte é 2500 centavos e a despesa é criada com `201`.

### AC-EXP-02 — Rateio igualitário com resto
- **Quando** lanço R$ 100,00 dividido igualmente entre 3
- **Então** as partes são 3334, 3333 e 3333 e somam 10000.

### AC-EXP-03 — Rateio por porcentagem
- **Quando** lanço R$ 100,00 com 50%, 30% e 20% (`5000`, `3000`, `2000` bp)
- **Então** as partes são 5000, 3000 e 2000 centavos.

### AC-EXP-04 — Porcentagem inválida
- **Quando** a soma dos `basisPoints` é diferente de `10000`
- **Então** recebo `422` com código `SPLIT_PERCENTAGE_SUM_INVALID`.

### AC-EXP-05 — Valor fixo
- **Quando** lanço R$ 100,00 com valores fixos 6000 e 4000
- **Então** as partes são 6000 e 4000.

### AC-EXP-06 — Valor fixo inválido
- **Quando** a soma dos valores fixos é diferente do total
- **Então** recebo `422` com código `SPLIT_FIXED_SUM_INVALID`.

### AC-EXP-07 — Pagador fora do rateio
- **Quando** Ana paga R$ 60,00 dividido entre Bia e Caio, sem incluir Ana
- **Então** a despesa é aceita e Ana passa a ter saldo positivo de 6000.

### AC-EXP-08 — Participante inválido
- **Quando** o pagador ou algum participante do rateio não pertence ao grupo, ou há participante repetido
- **Então** recebo `422` com código `INVALID_SPLIT_PARTICIPANTS`.

### AC-EXP-09 — Valor inválido
- **Quando** `amountCents` é `0`, negativo, decimal ou maior que `100000000`
- **Então** recebo `422 VALIDATION_ERROR`.

### AC-EXP-10 — Editar despesa
- **Dado** uma despesa que criei
- **Quando** altero o valor e o tipo de rateio via `PUT`
- **Então** as partes são recalculadas e os saldos refletem a mudança.

### AC-EXP-11 — Permissão de edição
- **Dado** uma despesa criada por outra pessoa e que não sou dono do grupo
- **Quando** tento editá-la ou excluí-la
- **Então** recebo `403 FORBIDDEN`.

### AC-EXP-12 — Excluir despesa
- **Quando** o criador (ou o dono) exclui a despesa
- **Então** recebo `204` e ela deixa de contar nos saldos.

### AC-EXP-13 — Grupo fechado
- **Dado** um grupo `CLOSED`
- **Quando** tento criar, editar ou excluir uma despesa
- **Então** recebo `409 GROUP_CLOSED`.

### AC-EXP-14 — Listagem
- **Quando** chamo `GET /groups/:id/expenses?page=1&pageSize=20`
- **Então** recebo as despesas ordenadas por `occurredOn` desc e `createdAt` desc, com o total de itens.
