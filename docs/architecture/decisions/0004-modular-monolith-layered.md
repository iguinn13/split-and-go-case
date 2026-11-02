# ADR 0004 — Monolito modular em camadas, sem DDD, interfaces sob demanda

- **Status:** Aceita
- **Contexto:** O domínio é pequeno (8 módulos), com quatro regras matemáticas complexas (câmbio, rateio, saldo e simplificação) e o restante CRUD. A equipe quer simplicidade e legibilidade.
- **Decisão:**
  - **Monolito modular** por domínio (`auth`, `users`, `groups`, `currencies`, `exchange-rates`, `expenses`, `balances`, `settlements`) em um único deploy.
  - **Camadas tradicionais:** `Controller → Use Case → Repository/Service`.
  - **Sem DDD:** sem entidades ricas, agregados, value objects formais ou eventos de domínio.
  - **Regras complexas em funções puras** (`*.calculator.ts`, `debt-simplifier.ts`), chamadas pelos use cases.
  - **Interfaces apenas com necessidade real:** hoje uma, `ExchangeRateProvider` (fronteira externa com implementação real e falsa para testes; ADR 0006). Todo o resto usa classes concretas injetadas pelo DI do Nest. Critério para criar uma interface: existem duas ou mais implementações, ou há uma fronteira externa a ser trocada ou simulada em teste.
- **Alternativas consideradas:**
  - DDD tático: custo de cerimônia sem benefício proporcional.
  - Microsserviços: complexidade operacional injustificada.
  - Lógica de negócio nos services genéricos: mistura orquestração e regra, e dificulta testes exaustivos.
- **Consequências:**
  - Um use case por ação, com nome explícito (`CloseGroupUseCase`).
  - Módulos se comunicam por services exportados; nunca importam o repository de outro módulo.
  - Futuros provedores (pagamento Pix, notificações, OCR) seguirão o mesmo critério: interface só na fronteira externa.
