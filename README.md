# Split&Go

Gestão e rateio inteligente de despesas em grupo. Lance os gastos de uma viagem, de uma república ou de um evento, divida cada um como quiser e receba o **menor número possível de transferências** para zerar todas as dívidas.

> **Estado do projeto:** MVP implementado (API, interface web, testes automatizados e CI) e documentado. **Não implementado:** a publicação da aplicação (deploy, task #22); por isso **não há URL pública** e o produto só roda localmente. Veja [Limitações conhecidas e decisões pendentes](#limitações-conhecidas-e-decisões-pendentes).

## Sumário

- [O que o produto faz](#o-que-o-produto-faz)
- [Arquitetura](#arquitetura)
- [Stack e justificativas](#stack-e-justificativas)
- [Demonstração](#demonstração)
- [Como rodar localmente](#como-rodar-localmente)
- [Algoritmo de simplificação de saldo](#algoritmo-de-simplificação-de-saldo)
- [Edge cases](#edge-cases)
- [Limitações conhecidas e decisões pendentes](#limitações-conhecidas-e-decisões-pendentes)
- [Evolução do produto (V2)](#evolução-do-produto-v2)
- [Gestão do projeto](#gestão-do-projeto)
- [Documentação](#documentação)

## O que o produto faz

1. **Grupos e participantes:** crie um grupo com vários participantes (com ou sem conta).
2. **Despesas flexíveis:** uma pessoa paga, N pessoas dividem. Rateio **igualitário** (ex.: R$ 100 / 4), por **porcentagem** ou por **valor fixo**.
3. **Moedas diferentes:** cada grupo tem uma moeda-base; cada despesa pode ser lançada em outra moeda, com a taxa sugerida automaticamente (e editável) e registrada na despesa.
4. **Simplificação de saldo:** o sistema calcula quem deve a quem e minimiza as transferências. Se A deve 50 a B e B deve 50 a C, o plano sugere que A pague 50 direto a C.
5. **Painel de quitação:** extrato individual de cada participante e plano final de liquidação, com fechamento do grupo e acompanhamento dos pagamentos.

Escopo do MVP: **multi-moeda** (moeda-base por grupo, despesas em 10 moedas com taxa de câmbio registrada) e login por e-mail e senha. Ver [`docs/specs/00-product-overview.md`](docs/specs/00-product-overview.md).

## Arquitetura

### Visão da aplicação

```mermaid
flowchart LR
    user([Usuário<br/>navegador / celular])

    subgraph web["apps/web — Next.js (App Router)"]
        proxy["proxy.ts<br/>exige cookie de sessão"]
        pages["Server Components<br/>(leitura via serverApi)"]
        bff["Route Handlers /api/*<br/>login · logout · grupos · despesas · câmbio · quitação"]
    end

    subgraph api["apps/api — NestJS (monolito modular)"]
        direction TB
        guard["JwtAuthGuard global<br/>(@Public: health, register, login)"]
        ctrl["Controllers<br/>validação Zod"]
        uc["Use Cases"]
        calc["Funções puras<br/>split · balance · settlement-plan · debt-simplifier<br/>common/money"]
        repo["Repositories / Services"]
        prisma["Prisma Client"]
        provider["ExchangeRateProvider<br/>(Frankfurter)"]
        cache["Cache em memória<br/>(1 h, no use case)"]
        guard --> ctrl --> uc
        uc --> calc
        uc --> repo
        uc --> cache --> provider
        repo --> prisma
    end

    db[("PostgreSQL")]
    fx(["Frankfurter<br/>taxas do BCE"])
    provider -->|"GET /{data}?base&symbols<br/>timeout 3 s"| fx

    user -->|HTTP| proxy --> pages
    user -->|"fetch (mesma origem)"| bff
    pages -->|"Authorization: Bearer"| guard
    bff -->|"Authorization: Bearer"| guard
    prisma --> db
```

Fluxo de autenticação: o navegador envia e-mail e senha ao Route Handler `POST /api/auth/login`, que chama `POST /auth/login` na API e grava o `accessToken` (JWT, 24 h) no cookie `sg_session` (`httpOnly`, `SameSite=Lax`, `Secure` em produção). O navegador nunca lê o token: Server Components e Route Handlers o leem do cookie e o repassam à API como `Authorization: Bearer`. Sem cookie, `proxy.ts` redireciona para `/login`; uma resposta `401` da API leva a `/api/auth/expired`, que apaga o cookie. Mutações do navegador passam pelos Route Handlers (nunca falam direto com a API). O CORS da API (`CORS_ORIGIN`) existe, mas o fluxo da interface não depende dele. Ver [ADR 0003](docs/architecture/decisions/0003-jwt-httpOnly-cookie.md).

### Infraestrutura e CI

```mermaid
flowchart TB
    subgraph local["Execução local — docker compose"]
        w["web :3000"]
        a["api :3001<br/>prisma migrate deploy na subida"]
        p[("postgres :5432<br/>volume postgres-data")]
        w -->|"API_URL=http://api:3001"| a --> p
    end

    subgraph ci["GitHub Actions (.github/workflows/ci.yml)"]
        t["pr-title<br/>commitlint no título do PR"]
        v["verify<br/>lint · typecheck · test · build<br/>(Postgres 17 como service)"]
        e["e2e<br/>Playwright contra o stack Docker Compose<br/>(projeto splitgo-e2e, portas 13000/13001/15432,<br/>fx-stub no lugar do Frankfurter)"]
    end

    subgraph prod["Publicação (NÃO implementada, task #22)"]
        d["sem ambiente publicado"]
    end
    ci -.->|"deploy não existe"| prod
```

Os testes e2e usam `apps/web/e2e/docker-compose.e2e.yml`, que troca o provedor de câmbio real por um stub local (`fx-stub`), de modo que nenhum teste depende da internet.

### Estilo arquitetural

**Monolito modular em camadas tradicionais, separado por domínio, sem DDD:**

```
Controller  →  Use Case  →  Repository / Service
 (HTTP/Zod)    (orquestra)    (dados / integrações)
```

- Módulos em `apps/api/src/modules/`: `auth` (inclui o repositório de usuários), `groups`, `currencies`, `exchange-rates`, `expenses`, `balances`, `settlements` e `health`. Infraestrutura transversal em `common/` (zod, errors, auth, money), `config/` e `prisma/`. O pacote `packages/shared` existe no workspace, mas é só um placeholder sem código.
- As regras complexas (rateio com resto de centavos, saldo e simplificação de dívidas) ficam em **funções puras e testáveis** (`*.calculator.ts`, `debt-simplifier.ts`), sem acesso a banco. Os use cases apenas orquestram.
- Interfaces só quando há necessidade real; hoje apenas `ExchangeRateProvider` (fronteira externa do câmbio): `FrankfurterExchangeRateProvider` em produção e `FakeExchangeRateProvider` (`apps/api/test/support/`) nos testes.
- Dinheiro sempre em **inteiros na menor unidade da moeda** (centavos em BRL, ienes em JPY); porcentagem em **basis points**; taxa de câmbio em texto decimal convertido com `BigInt`. Nunca ponto flutuante.

### Endpoints da API

22 rotas; todas exigem JWT, exceto `GET /health`, `POST /auth/register` e `POST /auth/login`. Contrato completo (payloads e erros) em [`docs/architecture/api-contract.md`](docs/architecture/api-contract.md).

| Domínio | Rotas |
|---|---|
| Saúde | `GET /health` |
| Auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` |
| Moedas e câmbio | `GET /currencies`, `GET /exchange-rates?from&to&date` |
| Grupos | `POST /groups`, `GET /groups`, `GET /groups/:groupId`, `PATCH /groups/:groupId`, `POST /groups/:groupId/members`, `DELETE /groups/:groupId/members/:memberId` |
| Despesas | `POST`, `GET` (paginado), `GET :expenseId`, `PUT :expenseId`, `DELETE :expenseId` em `/groups/:groupId/expenses` |
| Saldos | `GET /groups/:groupId/balances`, `GET /groups/:groupId/members/:memberId/statement` |
| Liquidação | `GET /groups/:groupId/settlement-plan`, `POST /groups/:groupId/close`, `PATCH /groups/:groupId/transfers/:transferId/pay` |

Detalhes: [`docs/architecture/plan.md`](docs/architecture/plan.md), [`data-model.md`](docs/architecture/data-model.md), [`api-contract.md`](docs/architecture/api-contract.md) e os [ADRs](docs/architecture/decisions/).

## Stack e justificativas

| Camada | Tecnologia | Por quê |
|---|---|---|
| Back-end | **NestJS** (LTS) + TypeScript | Módulos nativos que mapeiam o monolito modular por domínio; injeção de dependência; ecossistema maduro. |
| Validação | **Zod** | Valida a entrada nos controllers e gera os tipos TypeScript. |
| ORM | **Prisma** | Schema declarativo, migrations versionadas, client tipado. |
| Banco | **PostgreSQL** | Dados relacionais, transações ACID para fechamento de grupo e integridade dos saldos. |
| Front-end | **Next.js** (App Router) + Tailwind | SSR, Route Handlers para guardar o JWT em cookie `httpOnly`, mesma linguagem do back-end. |
| Qualidade | **ESLint + Prettier**, Vitest (API e web), Playwright (e2e na interface) | Padronização e testes em todos os níveis. |
| Infra local | **Docker Compose** | Um comando sobe banco, API e web. |
| CI | **GitHub Actions** | Três jobs a cada PR: título do PR (commitlint), `verify` (lint, typecheck, testes e build) e `e2e` (Playwright). |
| Câmbio | Frankfurter (taxas do BCE) | Sugestão gratuita de taxa por data; o usuário confirma ou edita (ADR 0006). |
| Fila / cache | Sem fila; cache em memória só para taxas (TTL de 1 h) | Os cálculos levam milissegundos (ADR 0005). |

## Demonstração

A aplicação **não está publicada** (task #22 pendente); as capturas abaixo vêm da aplicação real rodando localmente com os dados do seed (`pnpm --filter @split-and-go/api db:seed`), todos fictícios. Cada tela existe em desktop (1280 px) e celular (360 px).

**Credenciais do seed** (criadas por [`apps/api/prisma/seed.ts`](apps/api/prisma/seed.ts); uso exclusivo em ambiente local, nunca em produção):

| E-mail | Senha |
|---|---|
| `demo@splitandgo.dev` | `demo-password-123` |

O seed cria o grupo **Weekend Trip** (moeda-base BRL) com Demo User, Ana e Bruno e quatro despesas (igualitária, por porcentagem, por valor fixo e uma em **USD**, com taxa 5,4325). É idempotente: pode ser executado de novo.

| Tela | Desktop | Celular (360 px) |
|---|---|---|
| Login | ![Login](docs/assets/login-desktop.png) | ![Login no celular](docs/assets/login-mobile.png) |
| Cadastro | ![Cadastro](docs/assets/register-desktop.png) | ![Cadastro no celular](docs/assets/register-mobile.png) |
| Lista de grupos | ![Grupos](docs/assets/groups-desktop.png) | ![Grupos no celular](docs/assets/groups-mobile.png) |
| Despesas (inclui a despesa em USD) | ![Despesas](docs/assets/expenses-desktop.png) | ![Despesas no celular](docs/assets/expenses-mobile.png) |
| Saldos | ![Saldos](docs/assets/balances-desktop.png) | ![Saldos no celular](docs/assets/balances-mobile.png) |
| Extrato do participante | ![Extrato](docs/assets/statement-desktop.png) | ![Extrato no celular](docs/assets/statement-mobile.png) |
| Quitação (plano de transferências) | ![Quitação](docs/assets/settlement-desktop.png) | ![Quitação no celular](docs/assets/settlement-mobile.png) |
| Confirmação de fechamento do grupo | ![Fechar grupo](docs/assets/close-dialog-desktop.png) | ![Fechar grupo no celular](docs/assets/close-dialog-mobile.png) |

## Como rodar localmente

Requisitos:

- **Com Docker:** Docker e Docker Compose v2.
- **Sem Docker:** Node.js 24 (ver `.nvmrc`; `engines` exige `>=24 <25`), pnpm 12 (versão do campo `packageManager` do `package.json`) e um PostgreSQL acessível (o `docker compose up -d postgres` abaixo fornece um).

Primeiro clone o repositório:

```bash
git clone https://github.com/iguinn13/split-and-go-case.git
cd split-and-go-case
```

### Com Docker Compose

```bash
cp .env.example .env     # opcional: os padrões já funcionam em ambiente local
docker compose up --build
```

Sobe `postgres` (volume `postgres-data` e healthcheck), `api` e `web`. A API só inicia depois que o banco está saudável e executa `prisma migrate deploy` antes de subir; as migrations são aplicadas automaticamente. Use `docker compose up --build --wait -d` para rodar em segundo plano e esperar os healthchecks. Para parar: `docker compose down` (adicione `-v` para apagar os dados).

O banco sobe **vazio**: crie uma conta em `/register` ou carregue os dados de demonstração com o seed (ver "Seed" abaixo).

| Serviço | URL |
|---|---|
| Aplicação (web) | http://localhost:3000 |
| API | http://localhost:3001 (`GET /health`) |
| PostgreSQL | `localhost:5432` |

Variáveis (em `.env`, modelo em `.env.example`):

| Variável | Padrão | Uso |
|---|---|---|
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | `splitgo` | Credenciais do Postgres |
| `JWT_SECRET` | `change-me-in-development-only` | Assinatura do JWT (mínimo 8 caracteres; troque fora do ambiente local) |
| `CORS_ORIGIN` | `http://localhost:3000` | Origem permitida pelo CORS da API; ao mudar `WEB_PORT`, ajuste junto |
| `FX_PROVIDER_URL` | `https://api.frankfurter.dev/v1` | Provedor de câmbio (precisa de internet; sem ele o usuário informa a taxa manualmente) |
| `POSTGRES_PORT`, `API_PORT`, `WEB_PORT` | `5432`, `3001`, `3000` | Portas publicadas no host |

`DATABASE_URL` e `API_URL` são definidas pelo `docker-compose.yml`. **Se a porta 5432 (ou outra) já estiver em uso**, defina `POSTGRES_PORT`, `API_PORT` e/ou `WEB_PORT` no `.env` (por exemplo `POSTGRES_PORT=25432`, `API_PORT=23001`, `WEB_PORT=23000` e `CORS_ORIGIN=http://localhost:23000`); para isolar do resto da máquina use também `docker compose -p outro-nome ...`.

### Sem Docker (desenvolvimento)

```bash
pnpm install
cp apps/api/.env.example apps/api/.env      # ajuste DATABASE_URL e JWT_SECRET
cp apps/web/.env.example apps/web/.env      # API_URL aponta para a API
docker compose up -d postgres               # apenas o banco (ou use um Postgres seu e ajuste DATABASE_URL)
pnpm --filter @split-and-go/api exec prisma generate         # gera o Prisma Client (obrigatório antes do seed e de `start:dev` em clone novo)
pnpm --filter @split-and-go/api exec prisma migrate deploy   # aplica as migrations
pnpm --filter @split-and-go/api db:seed                      # dados de demonstração (opcional)
pnpm --filter @split-and-go/api start:dev                    # API em :3001 (terminal 1)
pnpm --filter @split-and-go/web dev                          # web em :3000 (terminal 2)
```

Alternativa para a web sem modo de desenvolvimento: `pnpm --filter @split-and-go/web build && pnpm --filter @split-and-go/web start` (também em `:3000`).

Notas: `apps/api/.env` e `apps/web/.env` são lidos automaticamente; `DATABASE_URL` precisa apontar para o Postgres escolhido (a porta muda se você alterou `POSTGRES_PORT`).

### Seed

Com a API configurada (`apps/api/.env` com `DATABASE_URL`) e o Prisma Client gerado:

```bash
pnpm --filter @split-and-go/api db:seed
```

Cria o usuário demo e o grupo **Weekend Trip** descritos em [Demonstração](#demonstração). Para ambiente Docker, rode o comando no host apontando `DATABASE_URL` para a porta publicada do Postgres (`POSTGRES_PORT`).

### Qualidade e testes

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

- Os testes da API (`pnpm test`) usam um PostgreSQL real e **exigem `DATABASE_URL` explícito** (não há valor padrão): a preparação global roda `prisma migrate deploy` e os testes apagam linhas, então a execução é recusada se a URL não for de aparência local/de teste (host `localhost`, `127.0.0.1`, `::1`, `postgres` ou `db`, e nome de banco que não pareça produção: `prod`, `production`, `live`, `staging`, `main`; na query string só `schema`, `sslmode`, `connection_limit`, `pool_timeout` e `connect_timeout`, pois `host`, `hostaddr`, `dbname`, `port` etc. sobrescreveriam o host da URL). Não existe variável para contornar a regra. Exemplo: `docker compose up -d postgres` e depois `DATABASE_URL=postgresql://splitgo:splitgo@localhost:5432/splitgo pnpm test` (ou aponte para um banco descartável, ajustando a porta se mudou `POSTGRES_PORT`). A regra vive em `apps/api/test/support/test-database.ts`.
- **E2E com Playwright** (caminho feliz na interface; precisa de Docker e do Chromium do Playwright): `pnpm --filter @split-and-go/web exec playwright install chromium` e depois `pnpm --filter @split-and-go/web test:e2e`. O teste sobe a própria stack Docker Compose isolada (projeto `splitgo-e2e`, portas 13000, 13001 e 15432, com o stub de câmbio) e a derruba ao final. Variáveis opcionais: `E2E_COMPOSE_PROJECT`, `E2E_WEB_PORT`, `E2E_API_PORT`, `E2E_POSTGRES_PORT`, `E2E_EXTERNAL_STACK=1` (usa uma stack já em execução, como na CI).

## Algoritmo de simplificação de saldo

1. **Saldo de cada pessoa** = total que pagou − total que deve (soma sempre `0`).
2. Minimizar transferências equivale a **dividir o grupo no maior número de subgrupos cuja soma de saldos é zero**: cada subgrupo de `k` pessoas se resolve com `k − 1` transferências.
3. Até 16 saldos diferentes de zero, o resultado é **exato** (programação dinâmica por bitmask). Acima disso, uma heurística gulosa garante no máximo `n − 1` transferências.
4. O resultado é determinístico.

Exemplo: saldos `A=+5, B=−3, C=−2, D=+4, E=−4` geram **3** transferências (`B→A 3`, `C→A 2`, `E→D 4`); a abordagem gulosa pura geraria 4. Detalhes no [ADR 0002](docs/architecture/decisions/0002-debt-simplification.md).

## Edge cases

Os principais cenários de borda e como são tratados (lista completa em [`docs/engineering/edge-cases.md`](docs/engineering/edge-cases.md)):

| Cenário | Tratamento |
|---|---|
| **Resto de centavos** (R$ 100 / 3) | Divisão em centavos inteiros; o resto é distribuído 1 centavo por vez em ordem determinística: 33,34 · 33,33 · 33,33. A soma é sempre o total. |
| **Porcentagens ou valores fixos que não fecham** | Rejeitados com `422` (`SPLIT_PERCENTAGE_SUM_INVALID`, `SPLIT_FIXED_SUM_INVALID`); a interface mostra quanto falta. |
| **Pagador fora do rateio** | Permitido. O saldo é `pago − devido`, então ele fica com o crédito integral. |
| **Moedas diferentes** (US$ 100 em grupo BRL) | A despesa guarda moeda, valor original, taxa e valor convertido (snapshot imutável, em `BigInt`, meio para cima). O rateio é feito nas duas moedas com a mesma regra de maior resto, então as somas fecham exato. A taxa é sugerida pelo BCE e editável; se o provedor cair, o usuário informa a taxa. |
| **Moedas sem casas decimais** (JPY, KRW) | O catálogo de moedas define as casas decimais; os valores são inteiros na menor unidade (5.000 ienes = `5000`) e a interface não aceita decimais nelas. |
| **Dívidas circulares** | O plano parte do saldo líquido, então o ciclo A→B→C→A se anula e o plano é vazio. |
| **Fechamento concorrente** | Fechar o grupo e lançar despesa travam a linha do grupo na transação: uma despesa entra no plano ou é rejeitada. |

## Limitações conhecidas e decisões pendentes

O que **não** está implementado e o que ainda aguarda decisão humana. Os pontos abaixo descrevem o comportamento real do código. Já decididos e documentados nas specs e no contrato: `403 FORBIDDEN` ao remover o dono (RN-GRP-08) e `exchangeRate` sempre com 8 casas (`"1.00000000"` na moeda-base).

**Não implementado**

- **Publicação (task #22):** sem deploy e sem URL pública. A hospedagem sugerida em [`docs/architecture/plan.md`](docs/architecture/plan.md) (seção 10) é apenas uma proposta.
- **Logs estruturados com `requestId`:** proposto no plano, mas a API usa apenas o `Logger` padrão do Nest (ver `apps/api/src/common/errors/all-exceptions.filter.ts`).
- **Pacote `packages/shared`:** declarado no workspace, sem código; web e API definem seus próprios schemas Zod.
- Itens do [roadmap V2](#evolução-do-produto-v2): convites, notificações, Pix, OCR, recorrência e relatórios.

**Decisões pendentes (aguardam decisão humana)**

| # | Tema | Comportamento atual | Onde ver |
|---|---|---|---|
| c | `GroupSummary` (`GET /groups`) e `baseCurrency` | API pronta: cada item da lista traz `baseCurrency`. Web pendente (#50): a lista ainda faz um `GET /groups/:id` por grupo (N+1). | `apps/web/src/app/groups/page.tsx`, `apps/api/src/modules/groups/list-groups.use-case.ts` |
| d | RF-UI-12: extrato com valor convertido | API pronta: a linha do extrato traz `amountMinor` (total convertido da despesa, valor persistido). Web pendente (#50): hoje só mostra o total convertido para quem pagou. | `apps/api/src/modules/balances/`, `apps/web/src/components/balances/` |
| e | Entrada de valor no formulário web | Um único separador é lido como decimal: colar `1.234` em moeda de 2 casas vira 1,23 e digitar `1.234,56` vira R$ 12.356,00. Limitação conhecida. | `apps/web/src/lib/expenses/money-input.ts` |
| h | Guarda dos Route Handlers da web | `guardMutation`/`guardUuids` (origem e UUID) só protegem os handlers de despesas e quitação, não os de grupos, participantes e auth. | `apps/web/src/lib/http/guard.ts` |
| i | Formatação do iene | A interface mostra `JP¥ 5.000`; AC-UI-10 diz `¥ 5.000`. | `apps/web/src/lib/money/format-money.ts`, `docs/specs/05-settlement-dashboard.md` |
| j | Títulos de PR e escopos do commitlint | O escopo `exchange-rates` não está no `scope-enum`; por isso o título da T-23 usa o escopo `api` e o da T-16 foi encurtado para caber em 72 caracteres (backlog já atualizado). | `commitlint.config.mjs`, `docs/tasks/backlog.md` |
| k | Deploy (task #22) | Pendente; ver acima. | `docs/tasks/backlog.md` (T-22) |

## Evolução do produto (V2)

**Melhorias de negócio**

1. **Liquidação em múltiplas moedas e câmbio no dia do pagamento:** o plano passa a respeitar a moeda em que cada pessoa prefere pagar, reduzindo perdas de câmbio.
2. **Convites por link e notificações:** aumenta ativação e retenção com loop viral e acelera a quitação com lembretes.
3. **Pagamento integrado (Pix) e conciliação:** fecha o ciclo do produto e abre uma linha de receita.

**Novas funcionalidades**

- **Recibos com OCR:** reduz o esforço de lançamento, principal causa de abandono em apps de rateio.
- **Despesas recorrentes e categorias com relatórios:** leva o uso de viagens (esporádico) para repúblicas e casais (mensal), aumentando retenção e receita recorrente.

Impacto detalhado em [`docs/engineering/roadmap-v2.md`](docs/engineering/roadmap-v2.md).

## Gestão do projeto

O trabalho é planejado e acompanhado no board público **[GitHub Projects — Split and Go Case](https://github.com/users/iguinn13/projects/5)**, com as colunas:

`Backlog → In Progress → In Review/Testing → Done`

- Repositório: <https://github.com/iguinn13/split-and-go-case>. Aplicação publicada: **não existe** (task #22 pendente).
- Cada task tem história de usuário e critérios de aceite ([`docs/tasks/backlog.md`](docs/tasks/backlog.md)).
- **Commits semânticos** (Conventional Commits) ligados às issues (`Refs #n`); PRs com `Closes #n` e merge por squash ([`docs/engineering/git-workflow.md`](docs/engineering/git-workflow.md)).
- **Desenvolvimento assistido por IA com revisão obrigatória:** três agentes (back-end, front-end e revisor de código) e o fluxo `/run-task <issue>` levam a task de Backlog até Done, com revisão contra os critérios de aceite ([`docs/ai/`](docs/ai/)).

## Documentação

| Pasta | Conteúdo |
|---|---|
| [`docs/constitution.md`](docs/constitution.md) | Princípios inegociáveis |
| [`docs/specs/`](docs/specs/) | Especificações: visão, auth, grupos, despesas, saldos, painel, moedas |
| [`docs/architecture/`](docs/architecture/) | Plano, modelo de dados, contrato da API, ADRs |
| [`docs/engineering/`](docs/engineering/) | Padrões de código, git, testes, edge cases, roadmap V2 |
| [`docs/tasks/`](docs/tasks/) | Backlog (espelhado no board) |
| [`docs/ai/`](docs/ai/) | Agentes, fluxo automatizado e configuração do board |
| [`docs/assets/`](docs/assets/) | Capturas de tela usadas neste README |
