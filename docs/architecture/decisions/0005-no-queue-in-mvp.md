# ADR 0005 — Sem fila e sem cache no MVP

- **Status:** Aceita
- **Contexto:** Filas e caches só se justificam quando há trabalho assíncrono, picos de carga ou leituras caras. O MVP calcula saldo e plano sob demanda.
- **Decisão:** Não usar fila de mensagens nem cache distribuído. Saldos e plano são calculados na requisição a partir das despesas; o plano é persistido apenas no fechamento do grupo.
- **Análise de custo:**
  - Saldo: leitura de até ~1.000 despesas e suas partes, uma passada `O(partes)`.
  - Plano: `O(2ⁿ · n)` com `n ≤ 16` (≈ 1 milhão de operações) ou `O(n log n)` acima disso.
  - Ambos executam em milissegundos, dentro do requisito `RNF-03`.
- **Alternativas consideradas:**
  - Fila para notificações e recálculo assíncrono: não há notificações no MVP.
  - Cache de saldos em Redis: invalidação complexa (qualquer despesa afeta o saldo) para ganho irrelevante.
- **Consequências:**
  - Infraestrutura mínima: web, API e PostgreSQL.
  - Reavaliar com a V2: notificações (e-mail/push), lembretes de pagamento e recibos com anexo (armazenamento de objetos) são os primeiros candidatos a trabalho assíncrono.
