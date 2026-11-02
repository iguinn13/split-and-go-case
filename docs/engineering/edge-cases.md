# Análise de Edge Cases

Cenários de borda no rateio, nos valores e nas moedas e na liquidação, e como o Split&Go lida com cada um. Todos viram casos de teste (ver `testing-strategy.md`).

| # | Cenário | Risco | Como a aplicação lida | Referência |
|---|---|---|---|---|
| 1 | **Divisão com resto de centavos** — R$ 100,00 entre 3 pessoas | `33,333…` não existe em centavos; somar as partes daria R$ 99,99 ou R$ 100,01 | Valores inteiros na menor unidade. Alocação proporcional por maior resto: `floor` para todos e as unidades que sobram vão uma a uma aos maiores restos, com desempate por `memberId`. Resultado: 3334 · 3333 · 3333. A soma é sempre o total. | RN-EXP-06, RN-EXP-07, AC-EXP-02 |
| 2 | **Porcentagens que não fecham 100%** — 33,33% + 33,33% + 33,33% | Soma 99,99%: sobra ou falta dinheiro | Porcentagem em basis points e soma obrigatória de exatamente 10000; senão `422 SPLIT_PERCENTAGE_SUM_INVALID`. A UI mostra o quanto falta. Na divisão em partes, o resto vai para os maiores restos fracionários. | RN-EXP-08, AC-EXP-04 |
| 3 | **Valores fixos que não somam o total** | Despesa desbalanceada gera saldo que não zera | A soma dos valores fixos precisa ser igual ao total; senão `422 SPLIT_FIXED_SUM_INVALID`. Prévia na UI com a diferença restante. | RN-EXP-09, AC-EXP-06 |
| 4 | **Pagador que não participa do rateio** | Cálculo que assume "pagador sempre participa" erra o saldo | O pagador é independente da lista de participantes. Saldo = pago − devido, então ele fica com crédito integral. | RN-EXP-04, AC-EXP-07 |
| 5 | **Valor zero, negativo, fracionário ou gigante** | Valores inválidos corrompem saldos; `0.1 + 0.2` em float | `originalAmountMinor` é inteiro `> 0` e `≤ 1.000.000.000`, validado por Zod e `CHECK` no banco. Fração da menor unidade não existe no modelo. | RN-EXP-01, RN-EXP-12, AC-EXP-09 |
| 6 | **Despesa em moeda diferente da base** — US$ 100,00 em grupo BRL | Somar moedas diferentes sem conversão gera valores sem sentido; mudar o câmbio depois alteraria o histórico | A despesa guarda moeda, valor original, taxa e valor convertido (snapshot imutável). Saldos usam apenas o valor convertido; a taxa só muda se a despesa for editada. | RN-CUR-03, RN-CUR-07, AC-CUR-02, AC-CUR-10 |
| 7 | **Moedas com casas decimais diferentes** (JPY e KRW = 0) | Assumir 2 casas erra por fator 100 | O catálogo define `minorUnits` por moeda. A conversão usa `10^(casasBase − casasOrigem)`; a UI não aceita decimais em JPY/KRW. Ex.: ¥ 5.000 a 0,0345 = R$ 172,50. | RN-CUR-05, AC-CUR-03, AC-UI-10 |
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
| 19 | **Arredondamento da conversão** — 10 × 157,25 = 1572,5 ienes | Arredondar de forma inconsistente quebra a reprodutibilidade | Meio para cima, em `BigInt` (sem `float`), igual em toda execução: `1573`. | RN-CUR-05, AC-CUR-04 |
| 20 | **Soma das partes convertidas diferente do total convertido** — US$ 100 / 3 a 5,4325 | Converter cada parte separadamente gera centavos de diferença e saldo que não zera | O total é convertido uma única vez e depois alocado com os mesmos pesos (maior resto): 18109 · 18108 · 18108 = 54325. | RN-EXP-09a, RN-CUR-08, AC-CUR-09, AC-EXP-15 |
| 21 | **Taxa ausente, zero, negativa, com mais de 8 casas ou em notação científica** | Valor convertido absurdo ou erro de cálculo | Validação do formato `^\d{1,10}(\.\d{1,8})?$` e `> 0`; senão `422 EXCHANGE_RATE_INVALID`. Obrigatória quando a moeda difere da base. | RN-CUR-02, RN-CUR-04, AC-CUR-05, AC-CUR-06 |
| 22 | **Mesma moeda da base com taxa diferente de 1** | Dupla conversão silenciosa | `422 EXCHANGE_RATE_INVALID`; sem taxa, o servidor registra `1`. | RN-CUR-03, AC-CUR-07 |
| 23 | **Provedor de câmbio fora do ar ou lento** | Usuário não consegue lançar despesa | A sugestão falha com `503 EXCHANGE_RATE_UNAVAILABLE` (timeout curto, cache de 1 h); a interface avisa e o usuário informa a taxa manualmente. O lançamento não depende do provedor. | RN-CUR-10, RN-CUR-11, AC-CUR-13, AC-UI-11 |
| 24 | **Valor minúsculo que converte para zero** — ¥ 1 com taxa muito baixa | Despesa de R$ 0,00 com partes zeradas | Valor convertido `< 1` é rejeitado com `422 AMOUNT_OUT_OF_RANGE`. | RN-CUR-06, AC-CUR-11 |
| 25 | **Moeda não suportada** (ex.: `XYZ`) | Casas decimais desconhecidas | Zod valida contra o catálogo; senão `422 VALIDATION_ERROR`. | AC-CUR-08 |
| 26 | **Grupo com moeda-base de 0 casas** (JPY) e despesa em USD | Perda de precisão ao arredondar na base | Conversão e alocação usam as casas da base; `10 USD × 157,25 = ¥ 1.573`. Saldos e plano em ienes inteiros. | AC-CUR-14, RN-CUR-05 |
| 27 | **Troca da moeda-base depois de lançar despesas** | Todo o histórico perderia o sentido | A moeda-base é imutável após a criação. | RN-CUR-09, AC-GRP-10 |

## Como os cenários viram testes

- 1–5, 13: testes unitários de `calculateShares` + validação Zod + testes de propriedade.
- 8–11: testes unitários e de propriedade de `simplifyDebts`.
- 12, 14–17: testes de integração/e2e dos use cases e endpoints.
- 6–7, 19–22, 24–27: testes unitários de `convertAmount`, `allocateProportionally` e dos schemas Zod, mais e2e de despesas em moeda estrangeira.
- 23: teste do `GET /exchange-rates` com `FakeExchangeRateProvider` falhando, e e2e da UI com a sugestão indisponível.
