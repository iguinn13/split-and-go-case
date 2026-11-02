# ADR 0002 — Algoritmo de simplificação de dívidas

- **Status:** Aceita
- **Contexto:** Dado o saldo líquido de cada participante (soma zero), queremos o plano com o **menor número de transferências**. Minimizar transferências é equivalente a particionar os participantes no maior número de subgrupos cuja soma de saldos é zero (cada subgrupo de `k` pessoas se resolve com `k − 1` transferências; total `n − g`). O problema é NP-difícil no caso geral.
- **Decisão:** Estratégia em duas etapas, em funções puras (`debt-simplifier.ts`):
  1. **Exato para `n ≤ 16`** (saldos diferentes de zero). DP por bitmask: `dp[mask] = max_i dp[mask \ {i}] + (soma(mask) == 0 ? 1 : 0)`. O valor `dp[todos]` é `g`. Reconstrói-se a ordem de remoção e os subgrupos são os trechos entre somas parciais iguais a zero. Complexidade `O(2ⁿ · n)`; para `n = 16` são ≈ 1 milhão de operações. Cada subgrupo é liquidado por guloso interno.
  2. **Heurística gulosa para `n > 16`:** casa o maior credor com o maior devedor repetidamente. No máximo `n − 1` transferências e `O(n log n)`.
- **Constante:** `EXACT_SOLVER_MAX_PARTICIPANTS = 16`, em um único lugar, facilmente ajustável.
- **Determinismo:** ordenar participantes por `memberId` antes de qualquer etapa; desempates sempre por `memberId` crescente. A mesma entrada gera o mesmo plano.
- **Alternativas consideradas:**
  - Apenas guloso: simples, mas não é mínimo (ex.: `+5, −3, −2, +4, −4` gera 4 transferências; o ótimo é 3).
  - Fluxo máximo / programação linear inteira: complexidade e dependências sem ganho para o tamanho do problema.
- **Consequências:**
  - Para grupos reais (≤ 16 pessoas com saldo diferente de zero), o resultado é ótimo e a spec `RN-BAL-07` é atendida integralmente.
  - Para grupos maiores, a garantia é "no máximo `n − 1`" e está documentada.
  - Testes de propriedade garantem: plano zera todos os saldos; `|transferências| ≤ n − 1`; no caminho exato, `|transferências| ≤ guloso`; resultado idêntico em chamadas repetidas.
