# ADR 0001 — Dinheiro como inteiros em centavos

- **Status:** Aceita
- **Contexto:** O rateio exige soma exata das partes. Ponto flutuante gera erros como `0.1 + 0.2 ≠ 0.3`, e o invariante "soma dos saldos = 0" quebraria.
- **Decisão:** Todo valor monetário é um inteiro em centavos de BRL (`amountCents`). Porcentagens são inteiros em basis points (1% = 100 bp). A conversão para texto (`R$ 1.234,56`) acontece apenas na camada de apresentação.
- **Alternativas consideradas:**
  - `Decimal` (Prisma/`decimal.js`): exato, mas exige conversões constantes e permite frações de centavo por engano.
  - `number` com arredondamento a cada operação: erros acumulam.
- **Consequências:**
  - Toda divisão precisa tratar o **resto** explicitamente (regras `RN-EXP-06` e `RN-EXP-07`).
  - `Int` de 32 bits cobre até ≈ R$ 21,4 milhões; o limite de negócio por despesa é R$ 1 milhão.
  - O campo `currency` existe no grupo (`BRL`) para permitir multi-moeda na V2 sem migração destrutiva; a conversão futura usará taxa registrada por despesa.
