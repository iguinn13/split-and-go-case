# Análise de Edge Cases

Cenários de borda no rateio, nos valores/moedas e na liquidação, e como o Split&Go lida com cada um. Todos viram casos de teste (ver `testing-strategy.md`).

| # | Cenário | Risco | Como a aplicação lida | Referência |
|---|---|---|---|---|
| 1 | **Divisão com resto de centavos** — R$ 100,00 entre 3 pessoas | `33,333…` não existe em centavos; somar as partes daria R$ 99,99 ou R$ 100,01 | Valores inteiros em centavos. `base = floor(total/n)` e o resto é distribuído 1 centavo por vez, em ordem determinística de `memberId`. Resultado: 3334 · 3333 · 3333. A soma é sempre o total. | RN-EXP-06, AC-EXP-02 |
| 2 | **Porcentagens que não fecham 100%** — 33,33% + 33,33% + 33,33% | Soma 99,99%: sobra ou falta dinheiro | Porcentagem em basis points e soma obrigatória de exatamente 10000; senão `422 SPLIT_PERCENTAGE_SUM_INVALID`. A UI mostra o quanto falta. Na divisão em partes, o resto vai para os maiores restos fracionários. | RN-EXP-07, AC-EXP-04 |
| 3 | **Valores fixos que não somam o total** | Despesa desbalanceada gera saldo que não zera | A soma dos valores fixos precisa ser igual ao total; senão `422 SPLIT_FIXED_SUM_INVALID`. Prévia na UI com a diferença restante. | RN-EXP-08, AC-EXP-06 |
| 4 | **Pagador que não participa do rateio** | Cálculo que assume "pagador sempre participa" erra o saldo | O pagador é independente da lista de participantes. Saldo = pago − devido, então ele fica com crédito integral. | RN-EXP-04, AC-EXP-07 |
| 5 | **Valor zero, negativo, fracionário ou gigante** | Valores inválidos corrompem saldos; `0.1 + 0.2` em float | `amountCents` é inteiro `> 0` e `≤ 100.000.000`, validado por Zod e `CHECK` no banco. Fração de centavo não existe no modelo. | RN-EXP-01, RN-EXP-12, AC-EXP-09 |
| 6 | **Moeda diferente de BRL** (ex.: USD, EUR) | Somar moedas diferentes sem conversão gera valores sem sentido | O MVP opera somente em BRL: `currency` é fixo no grupo e o payload não aceita outra moeda. O modelo guarda valores em centavos e o campo `currency` já existe, preparando a V2 (taxa de câmbio registrada por despesa). | ADR 0001, `roadmap-v2.md` |
| 7 | **Moedas com casas decimais diferentes** (JPY = 0, BHD = 3) — futuro | Assumir 2 casas erra por fator de 10 ou 1000 | Fora do MVP (BRL tem 2 casas). Na V2, o número de casas virá da moeda (ISO 4217) e o valor continuará inteiro na menor unidade. | `roadmap-v2.md` |
| 8 | **Dívidas circulares** — A→B, B→C, C→A com o mesmo valor | Plano ingênuo gera 3 transferências inúteis | O plano parte do saldo líquido, não das dívidas par a par: o ciclo se anula (todos com saldo 0) e o plano é vazio. | RN-BAL-06 |
| 9 | **Cadeia** — A deve 50 a B e B deve 50 a C | Duas transferências quando uma resolve | Saldos A = −50, B = 0, C = +50 → plano `A → C: 50`. | AC-BAL-04 |
| 10 | **Subgrupos independentes** — `+5, −3, −2, +4, −4` | Guloso gera 4 transferências; o mínimo é 3 | Solução exata por DP de bitmask (até 16 saldos não nulos) encontra o maior número de subgrupos de soma zero. | ADR 0002, AC-BAL-05 |
| 11 | **Grupo grande** (> 16 saldos não nulos) | A solução exata explode em tempo (2ⁿ) | Fallback guloso `O(n log n)` com no máximo `n − 1` transferências, ainda zerando todos os saldos. Limite em constante única. | ADR 0002, AC-BAL-08 |
| 12 | **Participante removido que já tem despesas** | Despesas órfãs, saldos que não fecham | Remoção bloqueada com `409 MEMBER_HAS_EXPENSES`. | RN-GRP-07, AC-GRP-07 |
| 13 | **Participante repetido na mesma despesa, ou de outro grupo** | Parte duplicada, vazamento entre grupos | Validação: sem repetição e todos precisam pertencer ao grupo; senão `422 INVALID_SPLIT_PARTICIPANTS`. `@@unique([expenseId, memberId])` no banco. | RN-EXP-03, RN-EXP-05, AC-EXP-08 |
| 14 | **Despesa lançada durante o fechamento** (concorrência) | Despesa fora do plano com o grupo já fechado | Fechamento e criação de despesa travam a linha do grupo na transação (`SELECT … FOR UPDATE`) e conferem o status. Uma das duas operações vence. | RN-BAL-12, AC-BAL-14 |
| 15 | **Fechar grupo sem dívidas** (sem despesas ou saldos zerados) | Erro por plano vazio | Fechamento permitido; plano com 0 transferências e mensagem amigável na UI. | RN-BAL-13, AC-BAL-13 |
| 16 | **Marcar transferência como paga duas vezes** (duplo clique, retry) | `paidAt` sobrescrito, erro espúrio | Operação idempotente: a primeira chamada grava `paidAt`; as demais retornam o mesmo estado. | RN-BAL-14, AC-BAL-12 |
| 17 | **Editar despesa depois do fechamento** | Plano congelado deixa de refletir os dados | Qualquer escrita em grupo `CLOSED` retorna `409 GROUP_CLOSED`. | RN-EXP-11, AC-EXP-13 |
| 18 | **Convidado que depois cria conta** | Histórico duplicado ou sem vínculo | Ao se cadastrar com o mesmo e-mail, os participantes pendentes são vinculados ao usuário; o histórico é preservado. | RN-GRP-05, AC-AUTH-07 |

## Como os cenários viram testes

- 1–5, 13: testes unitários de `calculateShares` + validação Zod + testes de propriedade.
- 8–11: testes unitários e de propriedade de `simplifyDebts`.
- 12, 14–17: testes de integração/e2e dos use cases e endpoints.
- 6–7: testes de validação que garantem que o payload com moeda diferente de BRL é rejeitado.
