# ADR 0001 — Dinheiro como inteiros na menor unidade da moeda

- **Status:** Aceita
- **Contexto:** O rateio exige soma exata das partes. Ponto flutuante gera erros como `0.1 + 0.2 ≠ 0.3`, e o invariante "soma dos saldos = 0" quebraria. Além disso, o produto é multi-moeda e nem toda moeda tem 2 casas decimais (JPY e KRW têm 0).
- **Decisão:** Todo valor monetário é um inteiro na **menor unidade da moeda** (`amountMinor`): centavos em BRL, USD e EUR; ienes em JPY. O número de casas vem do catálogo de moedas (`minorUnits`, ISO 4217). Porcentagens são inteiros em basis points (1% = 100 bp). Taxas de câmbio são texto decimal com até 8 casas, convertidas com `BigInt` (ADR 0006). A formatação (`R$ 1.234,56`, `¥ 5.000`) acontece apenas na apresentação, via `Intl.NumberFormat` com a moeda e as casas do catálogo.
- **Alternativas consideradas:**
  - `Decimal` (Prisma/`decimal.js`): exato, mas exige conversões constantes e permite frações da menor unidade por engano.
  - `number` com arredondamento a cada operação: erros acumulam.
  - Assumir sempre 2 casas decimais: erra por fator 100 em JPY/KRW.
- **Consequências:**
  - Toda divisão e conversão precisa tratar o **resto** e o **arredondamento** explicitamente (regra única de alocação proporcional em `specs/03-expenses.md`; conversão meio-para-cima em `specs/06-currencies.md`).
  - `Int` de 32 bits cobre até ≈ 2,1 bilhões de unidades mínimas; o limite de negócio é 1 bilhão por despesa.
  - Nomes de campos usam o sufixo `Minor` (`amountMinor`, `netMinor`), nunca `Cents`.
