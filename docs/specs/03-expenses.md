# Spec 03 — Despesas e Rateio

## Contexto

Uma despesa é paga por **1 participante** e dividida entre **N participantes**. O rateio pode ser igualitário, por porcentagem ou por valor fixo. A despesa pode ser lançada em **qualquer moeda suportada**; o sistema converte para a **moeda-base do grupo** e guarda a taxa usada (ver `06-currencies.md`). Todos os valores são inteiros na menor unidade da moeda (centavos em BRL).

## User stories

- **US-EXP-01** — Como participante, quero lançar uma despesa informando quem pagou e entre quem ela é dividida.
- **US-EXP-02** — Como participante, quero dividir igualmente (ex.: R$ 100 / 4) sem me preocupar com centavos.
- **US-EXP-03** — Como participante, quero dividir por porcentagem ou por valor fixo quando o consumo foi desigual.
- **US-EXP-04** — Como participante, quero ver, editar e excluir despesas enquanto o grupo está aberto.
- **US-EXP-05** — Como participante, quero lançar uma despesa na moeda em que paguei e ver quanto ela vale na moeda do grupo.

## Requisitos funcionais

| ID | Requisito |
|---|---|
| RF-EXP-01 | `POST /groups/:id/expenses` cria uma despesa com rateio. |
| RF-EXP-02 | `GET /groups/:id/expenses` lista as despesas do grupo, da mais recente para a mais antiga, com paginação. |
| RF-EXP-03 | `GET /groups/:id/expenses/:expenseId` retorna a despesa com moeda, valor original, taxa, valor convertido e as partes calculadas. |
| RF-EXP-04 | `PUT /groups/:id/expenses/:expenseId` substitui a despesa e recalcula as partes. |
| RF-EXP-05 | `DELETE /groups/:id/expenses/:expenseId` exclui a despesa. |
| RF-EXP-06 | As partes (`shares`) são calculadas pelo servidor e persistidas junto da despesa. O cliente nunca envia partes calculadas para `EQUAL` ou `PERCENTAGE`. |

## Modelo de entrada

```jsonc
{
  "description": "Jantar",
  "currency": "USD",                 // moeda suportada; omitido = moeda-base do grupo
  "originalAmountMinor": 10000,      // inteiro > 0, na menor unidade de "currency" (US$ 100,00)
  "exchangeRate": "5.4325",          // obrigatório se currency != moeda-base; veja 06-currencies.md
  "paidByMemberId": "uuid",
  "occurredOn": "2026-07-10",        // YYYY-MM-DD
  "split": {
    "type": "EQUAL",                 // EQUAL | PERCENTAGE | FIXED
    "participantIds": ["uuid", "uuid", "uuid"]                          // EQUAL
    // "shares": [{ "memberId": "uuid", "basisPoints": 5000 }]            // PERCENTAGE
    // "shares": [{ "memberId": "uuid", "originalAmountMinor": 4000 }]    // FIXED (na moeda da despesa)
  }
}
```

O servidor devolve também `amountMinor` (valor convertido, na moeda-base) e, em cada parte, `originalAmountMinor` e `amountMinor`.

## Regras de negócio

| ID | Regra |
|---|---|
| RN-EXP-01 | `originalAmountMinor` é inteiro, `> 0` e `≤ 1.000.000.000` unidades mínimas da moeda da despesa. O valor convertido tem o mesmo limite e mínimo `1` (`AMOUNT_OUT_OF_RANGE`). |
| RN-EXP-02 | `description`: 1 a 120 caracteres após trim. |
| RN-EXP-03 | O pagador e todos os participantes do rateio precisam ser participantes ativos do grupo. |
| RN-EXP-04 | O pagador **pode** não participar do rateio (ex.: pagou um presente para os outros). |
| RN-EXP-05 | O rateio tem no mínimo 1 participante e nenhum participante repetido. |
| RN-EXP-06 | **Alocação proporcional por maior resto** (única regra de distribuição, usada por todos os tipos de rateio): dado um `total` e pesos `w_i` (soma `W`), `base_i = floor(total × w_i / W)`; o que sobra (`total − Σ base_i`) é distribuído 1 unidade por vez aos maiores restos `(total × w_i) mod W`; empate desfaz por `memberId` crescente. A soma é sempre `total`. |
| RN-EXP-07 | **EQUAL:** pesos iguais (`w_i = 1`). Resulta em `floor(total / n)` para todos e as unidades que sobram vão para os primeiros `memberId` em ordem crescente. |
| RN-EXP-08 | **PERCENTAGE:** cada `basisPoints` é inteiro `≥ 1` e a soma é exatamente `10000`; pesos = `basisPoints`. |
| RN-EXP-09 | **FIXED:** cada `originalAmountMinor` da parte é inteiro `≥ 1` e a soma é exatamente o `originalAmountMinor` da despesa; pesos = valores fixos. |
| RN-EXP-09a | **Duas alocações por despesa:** (1) o valor original é alocado entre os participantes (partes na moeda da despesa) e (2) o valor convertido (`amountMinor`) é alocado com os **mesmos pesos** (partes na moeda-base). As duas somas são exatas. Com moeda igual à base, as duas alocações coincidem e `FIXED` devolve exatamente os valores informados. |
| RN-EXP-10 | Somente o criador da despesa ou o dono do grupo pode editar/excluir. Qualquer participante vinculado pode criar. |
| RN-EXP-11 | Grupo `CLOSED` não aceita criar, editar nem excluir despesas (`409 GROUP_CLOSED`). |
| RN-EXP-12 | `currency` precisa ser uma moeda suportada; valores com fração da menor unidade são rejeitados (o campo é inteiro). Regras de taxa e conversão em `06-currencies.md`. |
| RN-EXP-13 | Grupo com menos de 2 participantes não aceita despesas (`409 GROUP_NEEDS_MORE_MEMBERS`). |

## Exemplos de cálculo

Grupo em BRL, despesa em BRL (partes em centavos):

| Cenário | Entrada | Partes |
|---|---|---|
| Igualitário exato | R$ 100,00 / 4 | 2500 · 2500 · 2500 · 2500 |
| Igualitário com resto | R$ 100,00 / 3 | 3334 · 3333 · 3333 (o 1º por `memberId` leva o centavo) |
| Porcentagem | R$ 100,00 · 50% / 30% / 20% | 5000 · 3000 · 2000 |
| Porcentagem com resto | R$ 10,01 · 50% / 50% | 501 · 500 (empate no resto, desempata por `memberId`) |
| Valor fixo | R$ 100,00 · 60,00 / 40,00 | 6000 · 4000 |

Despesa em moeda estrangeira (grupo BRL):

| Cenário | Entrada | Partes originais | Partes convertidas (BRL) |
|---|---|---|---|
| Igualitário em USD | US$ 100,00 / 3, taxa 5.4325 (total `54325`) | 3334 · 3333 · 3333 | 18109 · 18108 · 18108 |
| Valor fixo em USD | US$ 100,00 · 60,00 / 40,00, taxa 5.4325 | 6000 · 4000 | 32595 · 21730 |
| Porcentagem em JPY | ¥ 5.000 · 50% / 50%, taxa 0.0345 (total `17250`) | 2500 · 2500 | 8625 · 8625 |

## Critérios de aceite

### AC-EXP-01 — Rateio igualitário exato
- **Dado** um grupo com 4 participantes
- **Quando** lanço R$ 100,00 pago por Ana, dividido igualmente entre os 4
- **Então** cada parte é 2500 centavos e a despesa é criada com `201` (`currency = BRL`, `exchangeRate = "1"`).

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
- **Quando** lanço R$ 100,00 com valores fixos `originalAmountMinor` 6000 e 4000
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
- **Quando** `originalAmountMinor` é `0`, negativo, decimal ou maior que `1000000000`
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

### AC-EXP-15 — Rateio em moeda estrangeira
- **Dado** um grupo em BRL
- **Quando** lanço US$ 100,00 (taxa `5.4325`) dividido igualmente entre 3
- **Então** as partes originais são 3334, 3333 e 3333; as partes convertidas são 18109, 18108 e 18108; e a soma das convertidas é `54325`.

### AC-EXP-16 — Valor fixo em moeda estrangeira
- **Quando** lanço US$ 100,00 (taxa `5.4325`) com fixos US$ 60,00 e US$ 40,00
- **Então** as partes convertidas são 32595 e 21730 e somam `54325`.

### AC-EXP-17 — Edição altera moeda e taxa
- **Dado** uma despesa em BRL que criei
- **Quando** edito para USD com taxa `5.5000`
- **Então** valor convertido, partes e saldos são recalculados com o novo snapshot.
