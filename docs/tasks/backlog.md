# Backlog de Tasks

Fonte de verdade das tasks do Split&Go. Cada seção `### T-NN` é espelhada em uma issue do GitHub, **em português**, e adicionada ao board **Split and Go Case** pelo script `scripts/board/create-issues.sh`. **O número da task é o número da issue** (`T-07` → `#7`).

## Como ler

- **Título da issue** em português (o que será entregue).
- **Título do PR** em inglês, no formato Conventional Commits. É o título do PR e do commit de squash; o nome da branch sai dele.
- **Área** vira a label da issue (`backend`, `frontend`, `infra`, `docs`) e define qual agente executa a task.
- **Spec** aponta onde estão as regras e os critérios completos. Os critérios de aceite abaixo são o contrato do PR.
- **Depende de** lista issues que devem estar em `Done` antes de começar.
- Escopo extra durante a implementação vira nova task, não entra no PR.

## Fluxo no board

`Backlog → In Progress → In Review/Testing → Done` (ver `docs/ai/automation-workflow.md`).

## Épicos

| Épico | Tasks |
|---|---|
| Fundação | T-01 a T-06 |
| Autenticação | T-07, T-08 |
| Moedas e câmbio | T-11, T-23 |
| Grupos e participantes | T-09, T-10 |
| Despesas e rateio | T-11 a T-13 |
| Saldos e liquidação | T-14 a T-18 |
| Qualidade e entrega | T-19 a T-22 |

---

### T-01 · Configurar a base do monorepo (pnpm, ESLint, Prettier, commitlint)

- **Área:** infra
- **Título do PR:** `chore: bootstrap monorepo tooling`
- **Spec:** `docs/architecture/plan.md` (seção 8), `docs/engineering/coding-standards.md`
- **Depende de:** —

**História:** Como desenvolvedor, quero um monorepo configurado com padrões de código e de commits para começar a implementar com qualidade desde o primeiro commit.

**Critérios de aceite:**

- [ ] Workspace pnpm com `apps/api`, `apps/web` e (opcional) `packages/shared` declarados em `pnpm-workspace.yaml`.
- [ ] `package.json` raiz com scripts `lint`, `format`, `typecheck`, `test` e `build` que delegam aos workspaces.
- [ ] ESLint e Prettier configurados na raiz conforme `coding-standards.md`, e `pnpm lint` roda sem erros.
- [ ] `tsconfig.base.json` com `strict` e `noUncheckedIndexedAccess`.
- [ ] husky + lint-staged no `pre-commit` e commitlint (Conventional Commits) no `commit-msg`; um commit fora do padrão é rejeitado.
- [ ] Versão do Node fixada (`.nvmrc` e `engines`) na LTS atual.

---

### T-02 · Criar a base da API NestJS com validação Zod e tratamento de erros

- **Área:** backend
- **Título do PR:** `chore(api): scaffold nestjs app with validation and error handling`
- **Spec:** `docs/architecture/plan.md` (seções 2, 6 e 9), `docs/architecture/api-contract.md` (formato de erro)
- **Depende de:** #1

**História:** Como desenvolvedor, quero a base da API NestJS (LTS) com validação Zod e erros padronizados para que todos os módulos sigam o mesmo contrato.

**Critérios de aceite:**

- [ ] `apps/api` criado com NestJS na versão estável atual, TypeScript estrito, rodando em `:3001`.
- [ ] Estrutura `common/` (zod, errors, auth, money) e `modules/` conforme o plano.
- [ ] `ZodValidationPipe` retorna `422 VALIDATION_ERROR` com `details[{ path, message }]`.
- [ ] `AppError` e filtro global produzem o formato `{ statusCode, code, message, details? }`; erros desconhecidos viram `500 INTERNAL_ERROR` sem vazar detalhes.
- [ ] Configuração via variáveis de ambiente validadas por Zod (inclui `FX_PROVIDER_URL`); a aplicação não sobe com configuração inválida.
- [ ] `GET /health` responde `200 { status: "ok" }` (a checagem do banco entra na task #4).
- [ ] Framework de testes configurado e um teste de exemplo passando; `lint` e `build` verdes.

---

### T-03 · Configurar Docker Compose, Dockerfiles e exemplo de variáveis de ambiente

- **Área:** infra
- **Título do PR:** `chore(infra): add docker compose, dockerfiles and env example`
- **Spec:** `docs/specs/00-product-overview.md` (RNF-01), `docs/architecture/plan.md` (seção 1)
- **Depende de:** #2, #5

**História:** Como desenvolvedor, quero subir o ambiente completo com um comando para rodar e demonstrar o produto sem configuração manual.

**Critérios de aceite:**

- [ ] `docker-compose.yml` com serviços `postgres` (volume nomeado e healthcheck), `api` e `web`.
- [ ] `docker compose up --build` sobe tudo; web em `:3000`, API em `:3001`, Postgres em `:5432`.
- [ ] A API aplica as migrations (`prisma migrate deploy`) na inicialização, depois que o banco está saudável.
- [ ] Dockerfiles multi-stage para `api` e `web` (imagens de produção enxutas, usuário não root).
- [ ] `.env.example` na raiz e em cada app documenta todas as variáveis (`DATABASE_URL`, `JWT_SECRET`, `API_URL`, `CORS_ORIGIN`, `FX_PROVIDER_URL`).
- [ ] README tem a seção "Como rodar" validada de ponta a ponta.

---

### T-04 · Modelar o banco com Prisma (schema, migration e seed)

- **Área:** backend
- **Título do PR:** `feat(api): add prisma schema, migration and seed`
- **Spec:** `docs/architecture/data-model.md`
- **Depende de:** #2

**História:** Como desenvolvedor, quero o modelo de dados versionado no Prisma para persistir grupos, despesas e transferências com integridade.

**Critérios de aceite:**

- [ ] `schema.prisma` implementa todos os modelos, enums, relações e índices de `data-model.md`, incluindo `baseCurrency` no grupo e `currency`, `originalAmountMinor` e `exchangeRate` (`Decimal(18,8)`) na despesa.
- [ ] Migration inicial inclui as constraints SQL: `CHECK` de valores (`> 0`), `from <> to` e índice único em `lower(name)` por grupo.
- [ ] `PrismaModule` / `PrismaService` globais, com encerramento limpo da conexão.
- [ ] `GET /health` passa a verificar o banco (`{ status: "ok", database: "up" }`).
- [ ] Seed idempotente cria um usuário demo e um grupo de exemplo com despesas dos três tipos de rateio, inclusive uma em moeda estrangeira.
- [ ] `pnpm --filter api prisma migrate dev` e o seed funcionam em um banco limpo.

---

### T-05 · Criar a base do front-end Next.js (layout, cliente de API e componentes)

- **Área:** frontend
- **Título do PR:** `chore(web): scaffold next.js app with layout and api client`
- **Spec:** `docs/architecture/plan.md` (seção 7), `docs/specs/05-settlement-dashboard.md` (princípios de UX)
- **Depende de:** #1

**História:** Como desenvolvedor, quero a base do front-end Next.js com layout e cliente de API tipado para construir as telas sobre uma fundação consistente.

**Critérios de aceite:**

- [ ] `apps/web` criado com Next.js (App Router), TypeScript estrito e Tailwind CSS, rodando em `:3000`.
- [ ] Layout base responsivo (360 px+) com cabeçalho, área de conteúdo e tema (cores e espaçamentos centralizados).
- [ ] Utilitário `formatMoney(minor, currency)` com `Intl.NumberFormat('pt-BR')`, respeitando as casas decimais da moeda (inclusive JPY/KRW sem decimais), com testes unitários.
- [ ] Cliente de API tipado em `src/lib/api` que lê `API_URL` e converte erros no formato do contrato em um tipo de erro da aplicação.
- [ ] Componentes base: botão, input com label, card, estado vazio, estado de erro, skeleton de carregamento.
- [ ] `lint`, `typecheck` e `build` verdes.

---

### T-06 · Configurar o pipeline de CI no GitHub Actions

- **Área:** infra
- **Título do PR:** `ci: add github actions pipeline`
- **Spec:** `docs/engineering/testing-strategy.md` (seção CI)
- **Depende de:** #1

**História:** Como desenvolvedor, quero um pipeline de CI para garantir que nenhum PR quebre lint, testes ou build.

**Critérios de aceite:**

- [ ] `.github/workflows/ci.yml` roda em `pull_request` e em `push` para `main`.
- [ ] Etapas: instalar com pnpm (com cache), `lint`, `typecheck`, `test` e `build`.
- [ ] Serviço PostgreSQL disponível para testes de integração.
- [ ] Um PR com erro de lint falha no CI; um PR correto passa.
- [ ] O workflow valida o título do PR no formato Conventional Commits.

---

### T-07 · Implementar cadastro de usuário e login com JWT

- **Área:** backend
- **Título do PR:** `feat(auth): add user registration and jwt login`
- **Spec:** `docs/specs/01-auth.md`
- **Depende de:** #4

**História:** Como visitante, quero criar uma conta e entrar com e-mail e senha para acessar meus grupos.

**Critérios de aceite:**

- [ ] AC-AUTH-01 a AC-AUTH-07 atendidos (cadastro, e-mail duplicado, validação, login, credenciais inválidas, rota protegida, vínculo de participantes pendentes).
- [ ] Hash de senha com argon2id ou bcrypt (custo ≥ 12); `passwordHash` nunca é retornado.
- [ ] `JwtAuthGuard` global e decorators `@Public()` e `@CurrentUser()`.
- [ ] `GET /auth/me` retorna o usuário autenticado.
- [ ] Testes unitários dos use cases e e2e de `register` e `login`.

---

### T-08 · Criar as telas de login e cadastro com sessão segura

- **Área:** frontend
- **Título do PR:** `feat(web): add login and register screens with session handling`
- **Spec:** `docs/specs/01-auth.md` (AC-AUTH-08), `docs/architecture/decisions/0003-jwt-httpOnly-cookie.md`
- **Depende de:** #5, #7

**História:** Como usuário, quero me cadastrar e entrar pela interface, mantendo a sessão de forma segura.

**Critérios de aceite:**

- [ ] Telas `/register` e `/login` com validação Zod em tempo real e mensagens de erro em pt-BR.
- [ ] Route Handlers de login/logout gravam e removem o JWT em cookie `httpOnly`, `SameSite=Lax` (e `Secure` em produção).
- [ ] O token nunca é acessível por JavaScript do navegador.
- [ ] `middleware` redireciona rotas protegidas sem sessão para `/login`, e usuário logado em `/login` vai para `/groups`.
- [ ] Botão "Sair" encerra a sessão.
- [ ] Estados de carregamento e erro tratados; funciona em 360 px.

---

### T-09 · Implementar grupos e participantes na API (com moeda-base)

- **Área:** backend
- **Título do PR:** `feat(groups): add groups and members management`
- **Spec:** `docs/specs/02-groups-and-members.md`, `docs/specs/06-currencies.md` (moedas suportadas)
- **Depende de:** #7, #11

**História:** Como organizador, quero criar grupos com vários participantes e escolher a moeda-base para dividir despesas com meus amigos.

**Critérios de aceite:**

- [ ] AC-GRP-01 a AC-GRP-10 atendidos.
- [ ] `baseCurrency` validada contra o catálogo de moedas (padrão `BRL`) e imutável após a criação.
- [ ] `GroupAccessService` com `assertCanRead` e `assertIsOwner`, reutilizável por outros módulos; acesso sem vínculo retorna `404 GROUP_NOT_FOUND`.
- [ ] O criador é incluído automaticamente como participante vinculado.
- [ ] Participante com e-mail de usuário existente é vinculado automaticamente.
- [ ] Remoção de participante com despesas retorna `409 MEMBER_HAS_EXPENSES` (a verificação usa o service de despesas quando existir, ou consulta mínima até lá).
- [ ] Testes de autorização (dono, participante, estranho) e e2e dos endpoints.

---

### T-10 · Criar as telas de grupos, criação de grupo e participantes

- **Área:** frontend
- **Título do PR:** `feat(web): add groups list, creation and members screens`
- **Spec:** `docs/specs/02-groups-and-members.md`, `docs/specs/05-settlement-dashboard.md` (telas, AC-UI-12)
- **Depende de:** #8, #9, #23

**História:** Como organizador, quero ver meus grupos, criar um novo com vários participantes e moeda-base e gerenciar a lista de participantes pela interface.

**Critérios de aceite:**

- [ ] `/groups` lista grupos com nome, moeda-base, status e número de participantes; estados vazio (com chamada para criar), carregando e erro.
- [ ] `/groups/new` permite informar nome, descrição, moeda-base (lista vinda de `GET /currencies`, padrão BRL) e uma lista dinâmica de participantes (nome e e-mail opcional), com validação.
- [ ] `/groups/[id]` tem a estrutura de abas (Despesas, Saldos, Participantes, Quitação); a aba Participantes permite adicionar e remover (somente dono).
- [ ] Erro `MEMBER_HAS_EXPENSES` exibe mensagem amigável.
- [ ] Em grupo fechado, ações de edição ficam ocultas e um aviso é mostrado.
- [ ] Funciona em 360 px.

---

### T-11 · Implementar as calculadoras de moeda, câmbio e rateio

- **Área:** backend
- **Título do PR:** `feat(expenses): add money, currency conversion and split calculators`
- **Spec:** `docs/specs/03-expenses.md` (RN-EXP-06 a RN-EXP-09a), `docs/specs/06-currencies.md`, `docs/engineering/edge-cases.md` (1 a 7, 13, 19 a 22, 24 a 26), `docs/architecture/decisions/0001-money-as-integer-minor-units.md`, `docs/architecture/decisions/0006-multi-currency-conversion.md`
- **Depende de:** #2

**História:** Como participante, quero que a conversão e o rateio sejam exatos até a menor unidade da moeda, para que ninguém pague ou receba a mais.

**Critérios de aceite:**

- [ ] Catálogo de moedas em `common/money/currencies.ts` com as 10 moedas da spec (`code`, `name`, `minorUnits`) e validadores Zod reutilizáveis (`currencySchema`, `exchangeRateSchema` com `^\d{1,10}(\.\d{1,8})?$` e `> 0`).
- [ ] `convertAmount` é função pura em `BigInt` (taxa escalada por 10⁸, meio para cima, respeitando as casas das duas moedas); os exemplos de `06-currencies.md` passam, inclusive JPY e `1572,5 → 1573`.
- [ ] `allocateProportionally(total, weights)` distribui o resto por maior resto, com desempate por `memberId` crescente, e a soma é sempre `total`.
- [ ] `calculateShares` cobre `EQUAL`, `PERCENTAGE` (basis points) e `FIXED`, devolvendo partes originais e convertidas com somas exatas nas duas moedas; nunca muta a entrada e não importa Nest nem Prisma.
- [ ] Erros tipados para soma de porcentagem inválida, soma fixa inválida, participantes inválidos/duplicados, taxa inválida e valor fora do limite (`AMOUNT_OUT_OF_RANGE`).
- [ ] Exemplos de `03-expenses.md` passam: 100/4, 100/3, 50/30/20, 10,01 com 50/50, fixo 60/40 e US$ 100 / 3 a 5.4325 (`18109 · 18108 · 18108`).
- [ ] Testes de propriedade (`fast-check`): soma das partes = total (original e convertido); `EQUAL` com diferença máxima de 1 unidade mínima; determinismo.
- [ ] Cobertura de 100% das ramificações dos módulos.

---

### T-12 · Implementar o CRUD de despesas na API (com moeda e taxa)

- **Área:** backend
- **Título do PR:** `feat(expenses): add expense crud endpoints`
- **Spec:** `docs/specs/03-expenses.md`, `docs/specs/06-currencies.md`, `docs/architecture/api-contract.md`
- **Depende de:** #9, #11

**História:** Como participante, quero lançar, consultar, editar e excluir despesas do grupo, em qualquer moeda suportada.

**Critérios de aceite:**

- [ ] AC-EXP-01 a AC-EXP-17 e AC-CUR-02 a AC-CUR-11 atendidos.
- [ ] Schema Zod com `z.discriminatedUnion('type', ...)` para o rateio e com `currency` e `exchangeRate` conforme RN-CUR-03 e RN-CUR-04 (taxa obrigatória só quando a moeda difere da base; `1` quando igual).
- [ ] O snapshot (moeda, valor original, taxa, valor convertido) e as partes originais e convertidas são calculados pelos calculators e persistidos em transação.
- [ ] Criação e edição travam a linha do grupo (`FOR UPDATE`) e conferem `status = OPEN`.
- [ ] Permissões: qualquer participante vinculado cria; só o criador ou o dono edita e exclui.
- [ ] Listagem paginada, ordenada por `occurredOn` desc e `createdAt` desc, com os dados de moeda.
- [ ] Testes de integração e e2e cobrindo os três tipos de rateio, despesa em moeda estrangeira e as regras de permissão.

---

### T-13 · Criar o formulário e a lista de despesas (com moeda e taxa)

- **Área:** frontend
- **Título do PR:** `feat(web): add expense form and list with currency support`
- **Spec:** `docs/specs/03-expenses.md`, `docs/specs/06-currencies.md`, `docs/specs/05-settlement-dashboard.md` (RF-UI-07, RF-UI-09 a RF-UI-12, AC-UI-06, AC-UI-09 a AC-UI-11)
- **Depende de:** #10, #12, #23

**História:** Como participante, quero lançar despesas escolhendo moeda, quem pagou e como dividir, vendo a taxa e a prévia do rateio antes de salvar.

**Critérios de aceite:**

- [ ] Formulário com descrição, moeda (padrão: moeda-base), valor (máscara que respeita as casas da moeda → unidades mínimas), pagador, data, tipo de rateio e seleção de participantes.
- [ ] Ao escolher outra moeda, aparece o campo de taxa pré-preenchido com a sugestão do dia da despesa e editável; a prévia mostra o valor convertido e as partes na moeda-base.
- [ ] Falha na sugestão exibe o aviso e permite informar a taxa manualmente e salvar.
- [ ] Prévia das partes em tempo real, espelhando `allocateProportionally`; botão "Salvar" desabilitado enquanto a soma for inválida, mostrando o que falta.
- [ ] Aba Despesas lista as despesas com valor, pagador e data; em moeda estrangeira, mostra valor original, taxa e valor convertido; ações de editar e excluir conforme a permissão.
- [ ] Erros da API traduzidos por `code` para mensagens em pt-BR.
- [ ] Em grupo fechado, criação, edição e exclusão ficam indisponíveis.
- [ ] Estados vazio, carregando e erro; funciona em 360 px.

---

### T-14 · Implementar o cálculo de saldo e o extrato individual na API

- **Área:** backend
- **Título do PR:** `feat(balances): add balance calculation and member statement`
- **Spec:** `docs/specs/04-balances-and-settlement.md` (RN-BAL-01 a RN-BAL-03, AC-BAL-01 a AC-BAL-03, AC-BAL-15)
- **Depende de:** #12

**História:** Como participante, quero ver o saldo de cada pessoa e o extrato detalhado para entender de onde vem cada valor.

**Critérios de aceite:**

- [ ] `calculateBalances` e `buildStatement` são funções puras com testes unitários e de propriedade (soma dos saldos = 0).
- [ ] `GET /groups/:id/balances` retorna `currency` (moeda-base) e `paidMinor`, `owedMinor` e `netMinor` por participante, usando os valores convertidos.
- [ ] `GET /groups/:id/members/:memberId/statement` retorna as linhas em ordem cronológica com `runningBalanceMinor` e, em despesas em moeda estrangeira, os dados originais (`original`); o último valor é igual ao saldo.
- [ ] Se o invariante de soma zero for violado, responde `500 INTERNAL_ERROR` e registra o erro.
- [ ] `ExpensesService.listForBalance` é a única porta de leitura de despesas para `balances` (sem importar o repository de outro módulo).
- [ ] Testes e2e de AC-BAL-01 a AC-BAL-03 e AC-BAL-15 (despesas em moedas diferentes).

---

### T-15 · Implementar o algoritmo de simplificação de dívidas

- **Área:** backend
- **Título do PR:** `feat(settlements): add debt simplification algorithm`
- **Spec:** `docs/specs/04-balances-and-settlement.md` (RN-BAL-04 a RN-BAL-09), `docs/architecture/decisions/0002-debt-simplification.md`
- **Depende de:** #2

**História:** Como participante, quero o menor número possível de transferências para quitar o grupo.

**Critérios de aceite:**

- [ ] `simplifyDebts(balances)` é uma função pura, sem acesso a banco, retornando `[{ from, to, amountMinor }]`.
- [ ] Para até 16 saldos não nulos, o resultado é o mínimo (DP de bitmask); acima disso, usa o guloso com no máximo `n − 1` transferências. Constante `EXACT_SOLVER_MAX_PARTICIPANTS` em um só lugar.
- [ ] Exemplos passam: cadeia (A→B→C vira A→C), ciclo (plano vazio), `+5, −3, −2, +4, −4` (3 transferências) e saldos todos zerados.
- [ ] Determinístico: mesma entrada gera o mesmo plano, independentemente da ordem de entrada.
- [ ] Testes de propriedade: zera todos os saldos; nenhuma transferência `≤ 0`, para si mesmo ou repetida; `≤ n − 1` transferências; o caminho exato nunca é pior que o guloso.
- [ ] Desempenho: 16 saldos não nulos em menos de 200 ms; 50 participantes em menos de 1 s.

---

### T-16 · Implementar plano de liquidação, fechamento do grupo e pagamento de transferências

- **Área:** backend
- **Título do PR:** `feat(settlements): add plan, group closing and transfer payment`
- **Spec:** `docs/specs/04-balances-and-settlement.md` (RN-BAL-10 a RN-BAL-17, AC-BAL-09 a AC-BAL-14)
- **Depende de:** #14, #15

**História:** Como organizador, quero fechar o grupo e congelar o plano final, e como participante quero marcar o que já foi pago.

**Critérios de aceite:**

- [ ] `GET /groups/:id/settlement-plan` calcula o plano (na moeda-base) em grupo `OPEN` e retorna o persistido em grupo `CLOSED`.
- [ ] `POST /groups/:id/close` (somente dono) fecha o grupo e persiste as transferências como `PENDING`, tudo em uma transação com lock da linha do grupo.
- [ ] Fechamento sem dívidas é permitido e gera plano vazio; fechar de novo retorna `409 GROUP_CLOSED`.
- [ ] `PATCH /groups/:id/transfers/:transferId/pay` é idempotente (`paidAt` da primeira chamada) e retorna `409 GROUP_NOT_CLOSED` se o grupo estiver aberto.
- [ ] Teste de concorrência: despesa criada durante o fechamento entra no plano ou é rejeitada com `GROUP_CLOSED`.
- [ ] Testes e2e de AC-BAL-09 a AC-BAL-14.

---

### T-17 · Criar as telas de saldos e extrato individual

- **Área:** frontend
- **Título do PR:** `feat(web): add balances and member statement screens`
- **Spec:** `docs/specs/05-settlement-dashboard.md` (RF-UI-01, RF-UI-02, RF-UI-12, AC-UI-01, AC-UI-02)
- **Depende de:** #13, #14

**História:** Como participante, quero ver quanto cada pessoa deve ou tem a receber e abrir o extrato para entender o cálculo.

**Critérios de aceite:**

- [ ] Aba Saldos mostra um cartão por participante com valor na moeda-base, rótulo textual ("recebe", "deve", "quitado") e cor correspondente (nunca só cor).
- [ ] Clicar no participante abre o extrato com descrição, data, pago, devido e saldo acumulado por linha; despesas em moeda estrangeira mostram valor original e taxa.
- [ ] O total do extrato é igual ao saldo exibido na aba Saldos.
- [ ] Estados vazio, carregando e erro (com "Tentar novamente"); funciona em 360 px.

---

### T-18 · Criar o painel de quitação e o fechamento do grupo

- **Área:** frontend
- **Título do PR:** `feat(web): add settlement dashboard and group closing`
- **Spec:** `docs/specs/05-settlement-dashboard.md` (RF-UI-03 a RF-UI-06, AC-UI-03 a AC-UI-05)
- **Depende de:** #16, #17

**História:** Como grupo, queremos ver claramente quem paga quem, fechar o acerto e acompanhar os pagamentos.

**Critérios de aceite:**

- [ ] Aba Quitação mostra o plano em frases claras ("Duda paga R$ 50,00 para Ana"), na moeda-base do grupo, o número de transferências e o total movimentado.
- [ ] Sem dívidas: mensagem "Tudo certo! Ninguém deve nada."
- [ ] Botão "Fechar grupo" (somente dono, somente grupo aberto) com diálogo de confirmação; após fechar, o status muda e as ações de edição somem.
- [ ] Em grupo fechado, cada transferência tem "Marcar como paga", com indicador de status e resumo "x de y pagas".
- [ ] Erros tratados com mensagens amigáveis; funciona em 360 px.

---

### T-19 · Escrever testes e2e da API para os fluxos principais

- **Área:** backend
- **Título do PR:** `test(api): add end-to-end tests for the main flows`
- **Spec:** `docs/engineering/testing-strategy.md`
- **Depende de:** #16

**História:** Como time, queremos testes e2e que protejam os fluxos críticos de regressões.

**Critérios de aceite:**

- [ ] Fluxo completo: cadastro → login → criar grupo → despesas dos três tipos (inclusive em moeda estrangeira) → saldos → plano → fechar → marcar transferência como paga.
- [ ] Cenário de cada edge case de `docs/engineering/edge-cases.md` verificável via API (12 a 17 e 19 a 27), com `FakeExchangeRateProvider` para o câmbio.
- [ ] Testes de autorização (dono, participante, estranho) para todas as rotas de grupo.
- [ ] Banco de teste isolado, com migrations aplicadas e limpeza entre testes; os testes rodam no CI.

---

### T-20 · Escrever o teste e2e do caminho feliz na interface (Playwright)

- **Área:** frontend
- **Título do PR:** `test(web): add playwright happy path test`
- **Spec:** `docs/engineering/testing-strategy.md`
- **Depende de:** #18

**História:** Como time, queremos um teste de interface que valide o caminho feliz de ponta a ponta.

**Critérios de aceite:**

- [ ] Playwright configurado em `apps/web/e2e/` e rodando contra o ambiente do Docker Compose.
- [ ] O teste cobre: cadastro, criação de grupo com 3 participantes, despesas igualitária, por porcentagem e por valor fixo, uma despesa em moeda estrangeira com taxa editada, conferência de saldos, plano de liquidação e fechamento.
- [ ] Os valores esperados dos saldos e do plano são verificados na tela.
- [ ] O câmbio é simulado no teste (sem depender do provedor real).
- [ ] Executa no CI (ou em job separado) e gera relatório em caso de falha.

---

### T-21 · Sincronizar o README com o estado final do produto

- **Área:** docs
- **Título do PR:** `docs: sync readme with the final state`
- **Spec:** `README.md`, `docs/`
- **Depende de:** #20

**História:** Como pessoa que chega ao projeto, quero um README fiel ao que foi entregue para entender o produto e rodá-lo sem surpresas.

**Critérios de aceite:**

- [ ] Instruções de "Como rodar" testadas em um clone limpo.
- [ ] Diagramas de arquitetura conferidos com o código real.
- [ ] Seção de demonstração com capturas de tela das principais telas e credenciais do seed.
- [ ] Links do board e (se existir) da aplicação publicada.
- [ ] Specs, ADRs e contrato da API atualizados com qualquer decisão que tenha mudado.
- [ ] Nenhuma seção marcada como "planejado" que já esteja implementada.

---

### T-22 · Publicar a aplicação (deploy)

- **Área:** infra
- **Título do PR:** `chore: deploy the application`
- **Spec:** `docs/architecture/plan.md` (seção 10)
- **Depende de:** #3, #19, #48, #49, #50, #51, #52, #53, #54, #55

**História:** Como pessoa interessada, quero acessar o produto no ar sem precisar rodá-lo localmente.

**Critérios de aceite:**

- [ ] Web publicada (Vercel ou similar) e API + PostgreSQL publicados (Render, Railway ou similar).
- [ ] Migrations aplicadas por `prisma migrate deploy` no release; segredos configurados fora do repositório.
- [ ] CORS, `API_URL` e `FX_PROVIDER_URL` configurados; cookie com `Secure` em produção.
- [ ] Smoke test manual do fluxo completo em produção, incluindo uma despesa em moeda estrangeira.
- [ ] URL pública registrada no README.

---

### T-23 · Implementar o catálogo de moedas e a sugestão de taxa de câmbio na API

- **Área:** backend
- **Título do PR:** `feat(api): add currency catalog and exchange rate suggestion`
- **Spec:** `docs/specs/06-currencies.md` (RF-CUR-01, RF-CUR-02, RN-CUR-10, RN-CUR-11, AC-CUR-01, AC-CUR-12, AC-CUR-13), `docs/architecture/decisions/0006-multi-currency-conversion.md`
- **Depende de:** #11

**História:** Como participante, quero que o sistema sugira a taxa de câmbio do dia da despesa para eu não precisar pesquisá-la, mantendo a possibilidade de ajustá-la.

**Critérios de aceite:**

- [ ] `GET /currencies` retorna o catálogo (`code`, `name`, `minorUnits`) e exige JWT.
- [ ] `GET /exchange-rates?from&to&date` retorna `{ from, to, rate, date, source }` com `rate` em texto decimal; `date` é opcional (padrão hoje); parâmetros validados com Zod.
- [ ] `ExchangeRateProvider` é a única interface criada, com justificativa no PR (fronteira externa, falsa nos testes), implementada por `FrankfurterExchangeRateProvider` (URL em `FX_PROVIDER_URL`) e por `FakeExchangeRateProvider` nos testes.
- [ ] Mesma moeda devolve `"1"` sem chamar o provedor.
- [ ] Cache em memória por par e data (TTL de 1 h) e timeout curto na chamada externa.
- [ ] Falha, timeout ou moeda desconhecida pelo provedor retornam `503 EXCHANGE_RATE_UNAVAILABLE`, sem vazar detalhes.
- [ ] Testes de integração com o provedor falso (sucesso, cache, falha) e e2e dos dois endpoints; nenhum teste depende da internet.

---

### T-48 · Endurecer o harness de testes da API e o provedor de câmbio

- **Área:** backend
- **Título do PR:** `fix(api): guard test db and harden the exchange rate provider`
- **Spec:** `docs/engineering/testing-strategy.md`, `docs/specs/06-currencies.md`, `docs/architecture/decisions/0006-multi-currency-conversion.md`
- **Depende de:** —

**História:** Como time, quero que os testes nunca toquem um banco que não seja de teste e que a sugestão de câmbio seja robusta a respostas inesperadas do provedor.

**Critérios de aceite:**

- [ ] O setup global dos testes da API recusa rodar sem `DATABASE_URL` explícito e com host/nome de aparência local ou de teste; a URL padrão é definida em um só lugar e nada de `prisma migrate deploy` é executado contra outro banco.
- [ ] O parser da taxa usa `JSON.parse` com reviver e `ctx.source` (Node 24) no lugar de regex: `rates` aninhado, chaves duplicadas e JSON inválido resultam em `503 EXCHANGE_RATE_UNAVAILABLE`, nunca em taxa errada; testes de regressão para esses casos.
- [ ] `fetch` do provedor com `redirect: 'error'` e limite de tamanho do corpo; timeout atual mantido.
- [ ] Cache de taxas com limite de tamanho e varredura de entradas expiradas; data limitada a uma faixa sensata; requisições simultâneas da mesma chave compartilham uma só chamada ao provedor.
- [ ] Testes sem internet (provedor falso e servidor local) cobrindo cada item; nenhuma regressão nos testes existentes.

---

### T-49 · Expor moeda-base na lista de grupos e valor convertido no extrato

- **Área:** backend
- **Título do PR:** `feat(api): expose base currency and converted amount in responses`
- **Spec:** `docs/specs/02-groups-and-members.md`, `docs/specs/03-expenses.md`, `docs/specs/05-settlement-dashboard.md` (RF-UI-12), `docs/architecture/api-contract.md`
- **Depende de:** #48

**História:** Como participante, quero ver a moeda-base de cada grupo na lista e o valor convertido em todas as linhas do extrato, sem requisições extras.

**Critérios de aceite:**

- [ ] `GET /groups` devolve `baseCurrency` em cada `GroupSummary`; mudança aditiva, sem quebrar clientes existentes.
- [ ] A linha do extrato (`GET /groups/:id/members/:memberId/statement`) devolve `amountMinor`, o total convertido da despesa, calculado sem divergência de arredondamento em relação ao valor persistido; mudança aditiva.
- [ ] `docs/architecture/api-contract.md` atualizado com os dois campos; testes e2e atualizados.
- [ ] Spec atualizada com as decisões tomadas: RN/AC do dono do grupo não removível retornando `403 FORBIDDEN` (RN-GRP-08), AC-EXP-01 com `exchangeRate = "1.00000000"` (8 casas) e ADR 0003 mencionando `proxy.ts` no lugar de `middleware`.
- [ ] A matriz de autorização ganha linhas de IDOR entre grupos (despesa, participante e transferência de outro grupo acessados pela URL do seu grupo).
- [ ] Seção "Limitações conhecidas e decisões pendentes" do README atualizada para refletir o que foi resolvido.

---

### T-50 · Endurecer os Route Handlers da web e remover o N+1 da lista de grupos

- **Área:** frontend
- **Título do PR:** `fix(web): harden route handlers and remove groups list n+1`
- **Spec:** `docs/architecture/decisions/0003-jwt-httpOnly-cookie.md`, `docs/specs/05-settlement-dashboard.md` (RF-UI-12)
- **Depende de:** #49

**História:** Como time, quero que todas as rotas de mutação da web tenham as mesmas defesas e que a interface use os novos campos da API.

**Critérios de aceite:**

- [ ] `guardMutation` e `guardUuids` (`apps/web/src/lib/http/guard.ts`) aplicados a todos os Route Handlers de mutação e de proxy (grupos, participantes, login, cadastro, logout, taxa de câmbio), com testes por handler.
- [ ] `GET /api/auth/expired` não altera estado em GET (limpeza do cookie por método seguro ou página intermediária); sem logout forçado por link externo.
- [ ] A lista de grupos usa `baseCurrency` do `GroupSummary` e não faz mais uma requisição por grupo.
- [ ] Todas as linhas do extrato de despesas em moeda estrangeira mostram "original · taxa · convertido" usando `amountMinor` (RF-UI-12).
- [ ] Campos do `Input` com `id` explícito, sem espaços, e `aria-describedby` correto nos erros.
- [ ] Playwright e testes unitários atualizados e verdes.

---

### T-51 · Corrigir a leitura de separadores no campo de valor

- **Área:** frontend
- **Título do PR:** `fix(web): stop misreading thousands separators in amount input`
- **Spec:** `docs/specs/03-expenses.md`, `docs/specs/06-currencies.md`, `docs/constitution.md` (dinheiro)
- **Depende de:** #49

**História:** Como participante, quero que o campo de valor nunca interprete errado o que digito ou colo, para não lançar uma despesa com valor 10 ou 1000 vezes menor ou maior.

**Critérios de aceite:**

- [ ] Em moeda de N casas decimais, um único separador seguido de mais de N dígitos é lido como separador de milhar; `1.234` e `25.000` em BRL/USD valem 1234 e 25000, nunca 1,23 nem 25,00.
- [ ] Digitar tecla a tecla `1.234,56` resulta em R$ 1.234,56 (não R$ 12.356,00); a reformatação do campo não reinterpreta o valor já formatado.
- [ ] Quando a entrada for ambígua ou tiver mais casas que a moeda permite, o campo mostra um aviso visível em vez de descartar dígitos em silêncio.
- [ ] JPY e KRW continuam sem casas decimais; `1.234` vale 1234.
- [ ] Testes unitários exatos (digitação e colagem: `1.234`, `1.234,56`, `1,234.56`, `1.000`, `25.000`, `1.234.567,89`) e mutações que os façam falhar; teste para valor original de exatamente 1e9 e 1e9+1 na mesma moeda.
- [ ] Verificação no navegador a 360 px e 1280 px, comparando a prévia com o valor persistido.

---

### T-52 · Criar a fundação do novo design (shadcn/ui, tokens e componentes)

- **Área:** frontend
- **Título do PR:** `feat(web): add design system foundation with shadcn ui`
- **Spec:** `docs/specs/05-settlement-dashboard.md` (princípios de UX), `docs/architecture/plan.md` (seção 7)
- **Depende de:** #50, #51

**História:** Como time, quero um sistema de design moderno e acessível, no padrão de mercado, para construir as telas sobre uma base consistente.

**Critérios de aceite:**

- [ ] shadcn/ui com Radix, `class-variance-authority` e `lucide-react` instalados em `apps/web`, com cada dependência justificada no PR.
- [ ] Tokens no estilo Splitwise (paleta verde, tipografia, espaçamento, raios, sombras, estados de foco e erro) centralizados em `globals.css`; contraste mínimo AA verificado.
- [ ] Componentes base reconstruídos em `apps/web/src/components/ui/`: botão, input com rótulo, select, cartão, diálogo, abas, toast, badge, avatar, skeleton, estado vazio e estado de erro; os `data-testid` e as props usados pelos testes e2e são mantidos.
- [ ] Layout base responsivo (360 px+) com cabeçalho, navegação e área de conteúdo; foco visível e navegação por teclado em todos os componentes.
- [ ] Nenhuma regra de negócio alterada; testes unitários, Playwright, lint, typecheck e build verdes.

---

### T-53 · Redesenhar autenticação, layout e telas de grupos

- **Área:** frontend
- **Título do PR:** `feat(web): redesign auth, layout and groups screens`
- **Spec:** `docs/specs/01-auth.md`, `docs/specs/02-groups-and-members.md`, `docs/specs/05-settlement-dashboard.md`
- **Depende de:** #52

**História:** Como usuário, quero telas de entrada e de grupos modernas e intuitivas, no padrão de apps de divisão de despesas.

**Critérios de aceite:**

- [ ] Telas de login e cadastro redesenhadas (formulário claro, mensagens de erro em pt-BR, estado de carregamento), mantendo a sessão em cookie `httpOnly`.
- [ ] Lista de grupos com cartões de resumo (nome, moeda-base, participantes, situação), estado vazio com chamada para criar e estado de erro com nova tentativa.
- [ ] Criação de grupo e gestão de participantes redesenhadas, com avatar/iniciais, validação em tempo real e mensagem amigável para `MEMBER_HAS_EXPENSES`.
- [ ] Funciona em 360 px e em desktop, com teclado e leitor de tela; capturas de tela revisadas.
- [ ] Teste Playwright e capturas do README atualizados; nenhuma regra de negócio alterada.

---

### T-54 · Redesenhar o detalhe do grupo, a lista e o formulário de despesas

- **Área:** frontend
- **Título do PR:** `feat(web): redesign group detail, expenses list and form`
- **Spec:** `docs/specs/03-expenses.md`, `docs/specs/05-settlement-dashboard.md`, `docs/specs/06-currencies.md`
- **Depende de:** #53

**História:** Como participante, quero ver o grupo e lançar despesas de forma rápida e clara, com a lista densa e o valor em destaque.

**Critérios de aceite:**

- [ ] Detalhe do grupo com resumo no topo (moeda-base, situação, total) e abas visíveis em 360 px, incluindo a aba Quitação sem corte.
- [ ] Lista de despesas com avatar, descrição, "quem pagou" e valor à direita; despesas em moeda estrangeira mostram original, taxa e convertido; paginação e estados vazio, carregando e erro.
- [ ] Formulário de despesa redesenhado (mobile-first, botão de nova despesa em destaque), mantendo a máscara, a prévia em tempo real, a taxa sugerida e o aviso quando falha, e a proteção contra envio duplo.
- [ ] Retry do erro do grupo volta para a aba em que o usuário estava; mensagens informativas sem o prefixo "Erro:".
- [ ] Funciona em 360 px e em desktop; Playwright e capturas atualizados; valores na tela conferidos contra o banco.

---

### T-55 · Redesenhar saldos, extrato e quitação

- **Área:** frontend
- **Título do PR:** `feat(web): redesign balances, statement and settlement screens`
- **Spec:** `docs/specs/04-balances-and-settlement.md`, `docs/specs/05-settlement-dashboard.md`
- **Depende de:** #54

**História:** Como grupo, queremos ver com clareza quem recebe, quem deve e quem paga quem, e fechar o acerto com segurança.

**Critérios de aceite:**

- [ ] Saldos com destaque "você recebe / você deve / quitado" (texto, sinal e cor), cartões por participante e acesso ao extrato.
- [ ] Extrato individual com linhas legíveis, saldo acumulado e valor convertido em todas as linhas de moeda estrangeira.
- [ ] Quitação com frases claras do plano, resumo "x de y pagas", diálogo de confirmação ao fechar, indicadores de status com texto e ícone.
- [ ] O foco do teclado é movido para um destino útil depois de fechar o grupo ou marcar uma transferência como paga, com anúncio para leitores de tela.
- [ ] Funciona em 360 px e em desktop; Playwright e capturas do README atualizados; valores conferidos contra recomputação independente.
