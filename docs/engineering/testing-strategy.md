# Estratégia de Testes

## Pirâmide

| Nível | O que cobre | Ferramenta | Onde |
|---|---|---|---|
| **Unitário (funções puras)** | `convertAmount`, `allocateProportionally`, `split.calculator`, `balance.calculator`, `debt-simplifier`, catálogo de moedas | Vitest ou Jest (definido na task #2) + `fast-check` | `*.spec.ts` ao lado do arquivo |
| **Integração (use cases)** | Use cases com Prisma contra um PostgreSQL de teste (Docker); câmbio com `FakeExchangeRateProvider` | Jest/Vitest | `*.integration.spec.ts` |
| **E2E da API** | Rotas HTTP completas: auth, grupos, despesas, saldo, fechamento | Jest + Supertest | `apps/api/test/` |
| **E2E da interface** | Caminho feliz: cadastro → grupo → despesas → saldos → fechamento | Playwright | `apps/web/e2e/` |

## Prioridades

1. **Funções puras:** cobertura de 100% das ramificações. É onde está o risco matemático.
2. **Regras de autorização** (dono vs. participante vs. estranho).
3. **Fluxo de fechamento** com concorrência (transação + lock).
4. **Caminho feliz da UI.**

## Testes de propriedade (`fast-check`)

Para `convertAmount`:

- Resultado inteiro, `≥ 0` e monotônico em relação ao valor original e à taxa.
- Taxa `1` com a mesma moeda devolve o valor original.
- Os exemplos de `specs/06-currencies.md` (inclusive meio para cima e moedas sem decimais) passam.
- Nunca usa `number` fracionário (o teste compara com o cálculo `BigInt` de referência).

Para `allocateProportionally` e `calculateShares`:

- A soma das partes é sempre igual ao total, **no valor original e no convertido**.
- Toda parte é inteira e `≥ 0` (e `≥ 1` quando houver base suficiente).
- `EQUAL`: a diferença entre a maior e a menor parte é no máximo 1 unidade mínima.
- Mesmo input → mesmo output.

Para `simplifyDebts`:

- Aplicar as transferências zera todos os saldos.
- Nenhuma transferência é `≤ 0`, para si mesmo ou repetida no par `from → to`.
- `|transferências| ≤ n − 1`, onde `n` é o número de saldos diferentes de zero.
- No caminho exato (`n ≤ 16`), o resultado nunca é maior que o do guloso.
- Mesmo input → mesmo output, independentemente da ordem de entrada.

Para `calculateBalances`: a soma dos saldos é sempre `0`.

## Casos obrigatórios (unitários)

Todos os cenários de `docs/engineering/edge-cases.md` viram caso de teste, além dos exemplos das specs (`03` e `04`).

## Dados de teste

- Factories simples em `test/factories/` (sem biblioteca extra).
- Banco de integração e2e: PostgreSQL via Docker Compose (`docker-compose.test.yml` ou perfil `test`), com migrations aplicadas e tabelas truncadas entre testes.

## Critérios para uma task ir para Done

1. Lint, typecheck e build sem erros.
2. Testes novos e existentes verdes.
3. Todos os critérios de aceite da issue verificados (e cobertos por teste quando aplicável).
4. Revisão do `code-reviewer` aprovada.

## CI

Workflow `.github/workflows/ci.yml` (task #6): instala com pnpm (com cache), roda `lint`, `typecheck`, `test` e `build`, com serviço PostgreSQL para testes de integração.

## E2E da interface (Playwright)

- Código em `apps/web/e2e/`; rode com `pnpm --filter @split-and-go/web test:e2e` (fora do `pnpm test`, que continua sem banco). Requer Docker e `pnpm --filter @split-and-go/web exec playwright install chromium`.
- O teste sobe o Docker Compose em um projeto isolado (`splitgo-e2e`, portas 13000/13001/15432; configurável por `E2E_*`) com o override `apps/web/e2e/docker-compose.e2e.yml`, que troca o provedor de câmbio por um stub local (`fx-stub`, compatível com Frankfurter). Ao final executa `down -v` apenas nesse projeto.
- Os valores esperados são calculados no próprio teste com `BigInt` (`e2e/support/expected.ts`), sem importar o código da aplicação.
- No CI, o job `E2E (Playwright)` sobe a stack, roda o teste e publica o relatório e os traces como artefato em caso de falha.
