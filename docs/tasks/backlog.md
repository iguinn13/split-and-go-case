# Backlog de Tasks

Fonte de verdade das tasks do Split&Go. Cada seção `### T-NN` é espelhada em uma issue do GitHub e adicionada ao board **Split and Go Case** pelo script `scripts/board/create-issues.sh`. **O número da task é o número da issue** (`T-07` → `#7`).

## Como ler

- **Título da issue** (em inglês) já segue Conventional Commits e será o título do PR.
- **Area** vira a label da issue (`backend`, `frontend`, `infra`, `docs`) e define qual agente executa a task.
- **Spec** aponta onde estão as regras e os critérios completos. Os critérios de aceite abaixo são o contrato do PR.
- **Depends on** lista issues que devem estar em `Done` antes de começar.
- Escopo extra durante a implementação vira nova task, não entra no PR.

## Fluxo no board

`Backlog → In Progress → In Review/Testing → Done` (ver `docs/ai/automation-workflow.md`).

## Épicos

| Épico | Tasks |
|---|---|
| Fundação | T-01 a T-06 |
| Autenticação | T-07, T-08 |
| Grupos e participantes | T-09, T-10 |
| Despesas e rateio | T-11 a T-13 |
| Saldos e liquidação | T-14 a T-18 |
| Qualidade e entrega | T-19 a T-22 |

---

### T-01 · chore: bootstrap monorepo tooling

- **Area:** infra
- **Spec:** `docs/architecture/plan.md` (seção 8), `docs/engineering/coding-standards.md`
- **Depends on:** —

**História:** Como desenvolvedor, quero um monorepo configurado com padrões de código e commits para começar a implementar com qualidade desde o primeiro commit.

**Critérios de aceite:**

- [ ] Workspace pnpm com `apps/api`, `apps/web` e (opcional) `packages/shared` declarados em `pnpm-workspace.yaml`.
- [ ] `package.json` raiz com scripts `lint`, `format`, `typecheck`, `test` e `build` que delegam aos workspaces.
- [ ] ESLint e Prettier configurados na raiz conforme `coding-standards.md`, e `pnpm lint` roda sem erros.
- [ ] `tsconfig.base.json` com `strict` e `noUncheckedIndexedAccess`.
- [ ] husky + lint-staged no `pre-commit` e commitlint (Conventional Commits) no `commit-msg`; um commit fora do padrão é rejeitado.
- [ ] Versão do Node fixada (`.nvmrc` e `engines`) na LTS atual.

---

### T-02 · chore(api): scaffold NestJS app with validation and error handling

- **Area:** backend
- **Spec:** `docs/architecture/plan.md` (seções 2, 6 e 9), `docs/architecture/api-contract.md` (formato de erro)
- **Depends on:** #1

**História:** Como desenvolvedor, quero a base da API NestJS (LTS) com validação Zod e tratamento de erros padronizado para que todos os módulos sigam o mesmo contrato.

**Critérios de aceite:**

- [ ] `apps/api` criado com NestJS na versão estável atual, TypeScript estrito, rodando em `:3001`.
- [ ] Estrutura `common/` (zod, errors, auth, money) e `modules/` conforme o plano.
- [ ] `ZodValidationPipe` retorna `422 VALIDATION_ERROR` com `details[{ path, message }]`.
- [ ] `AppError` e filtro global produzem o formato `{ statusCode, code, message, details? }`; erros desconhecidos viram `500 INTERNAL_ERROR` sem vazar detalhes.
- [ ] Configuração via variáveis de ambiente validadas por Zod; a aplicação não sobe com configuração inválida.
- [ ] `GET /health` responde `200 { status: "ok" }` (a checagem do banco entra na task #4).
- [ ] Framework de testes configurado e um teste de exemplo passando; `lint` e `build` verdes.

---

### T-03 · chore(infra): add docker compose, dockerfiles and env example

- **Area:** infra
- **Spec:** `docs/specs/00-product-overview.md` (RNF-01), `docs/architecture/plan.md` (seção 1)
- **Depends on:** #2, #5

**História:** Como desenvolvedor, quero subir o ambiente completo com um comando para rodar e demonstrar o produto sem configuração manual.

**Critérios de aceite:**

- [ ] `docker-compose.yml` com serviços `postgres` (volume nomeado e healthcheck), `api` e `web`.
- [ ] `docker compose up --build` sobe tudo; web em `:3000`, API em `:3001`, Postgres em `:5432`.
- [ ] A API aplica as migrations (`prisma migrate deploy`) na inicialização, depois que o banco está saudável.
- [ ] Dockerfiles multi-stage para `api` e `web` (imagens de produção enxutas, usuário não root).
- [ ] `.env.example` na raiz e em cada app documenta todas as variáveis (`DATABASE_URL`, `JWT_SECRET`, `API_URL`, `CORS_ORIGIN`).
- [ ] README tem a seção "Como rodar" validada de ponta a ponta.

---

### T-04 · feat(api): add prisma schema, migration and seed

- **Area:** backend
- **Spec:** `docs/architecture/data-model.md`
- **Depends on:** #2

**História:** Como desenvolvedor, quero o modelo de dados versionado no Prisma para persistir grupos, despesas e transferências com integridade.

**Critérios de aceite:**

- [ ] `schema.prisma` implementa todos os modelos, enums, relações e índices de `data-model.md`.
- [ ] Migration inicial inclui as constraints SQL: `CHECK` de valores, `from <> to` e índice único em `lower(name)` por grupo.
- [ ] `PrismaModule` / `PrismaService` globais, com encerramento limpo da conexão.
- [ ] `GET /health` passa a verificar o banco (`{ status: "ok", database: "up" }`).
- [ ] Seed idempotente cria um usuário demo e um grupo de exemplo com despesas dos três tipos de rateio.
- [ ] `pnpm --filter api prisma migrate dev` e o seed funcionam em um banco limpo.

---

### T-05 · chore(web): scaffold Next.js app with layout and api client

- **Area:** frontend
- **Spec:** `docs/architecture/plan.md` (seção 7), `docs/specs/05-settlement-dashboard.md` (princípios de UX)
- **Depends on:** #1

**História:** Como desenvolvedor, quero a base do front-end Next.js com layout e cliente de API tipado para construir as telas sobre uma fundação consistente.

**Critérios de aceite:**

- [ ] `apps/web` criado com Next.js (App Router), TypeScript estrito e Tailwind CSS, rodando em `:3000`.
- [ ] Layout base responsivo (360 px+) com cabeçalho, área de conteúdo e tema (cores e espaçamentos centralizados).
- [ ] Utilitário `formatBRL(cents)` com `Intl.NumberFormat('pt-BR')` e testes unitários.
- [ ] Cliente de API tipado em `src/lib/api` que lê `API_URL` e converte erros no formato do contrato em um tipo de erro da aplicação.
- [ ] Componentes base: botão, input com label, card, estado vazio, estado de erro, skeleton de carregamento.
- [ ] `lint`, `typecheck` e `build` verdes.

---

### T-06 · ci: add github actions pipeline

- **Area:** infra
- **Spec:** `docs/engineering/testing-strategy.md` (seção CI)
- **Depends on:** #1

**História:** Como desenvolvedor, quero um pipeline de CI para garantir que nenhum PR quebre lint, testes ou build.

**Critérios de aceite:**

- [ ] `.github/workflows/ci.yml` roda em `pull_request` e em `push` para `main`.
- [ ] Etapas: instalar com pnpm (com cache), `lint`, `typecheck`, `test` e `build`.
- [ ] Serviço PostgreSQL disponível para testes de integração.
- [ ] Um PR com erro de lint falha no CI; um PR correto passa.
- [ ] O workflow valida o título do PR no formato Conventional Commits.

---

### T-07 · feat(api): add user registration and jwt login

- **Area:** backend
- **Spec:** `docs/specs/01-auth.md`
- **Depends on:** #4

**História:** Como visitante, quero criar uma conta e entrar com e-mail e senha para acessar meus grupos.

**Critérios de aceite:**

- [ ] AC-AUTH-01 a AC-AUTH-07 atendidos (cadastro, e-mail duplicado, validação, login, credenciais inválidas, rota protegida, vínculo de participantes pendentes).
- [ ] Hash de senha com argon2id ou bcrypt (custo ≥ 12); `passwordHash` nunca é retornado.
- [ ] `JwtAuthGuard` global e decorators `@Public()` e `@CurrentUser()`.
- [ ] `GET /auth/me` retorna o usuário autenticado.
- [ ] Testes unitários dos use cases e e2e de `register` e `login`.

---

### T-08 · feat(web): add login and register screens with session handling

- **Area:** frontend
- **Spec:** `docs/specs/01-auth.md` (AC-AUTH-08), `docs/architecture/decisions/0003-jwt-httpOnly-cookie.md`
- **Depends on:** #5, #7

**História:** Como usuário, quero me cadastrar e entrar pela interface, mantendo a sessão de forma segura.

**Critérios de aceite:**

- [ ] Telas `/register` e `/login` com validação Zod em tempo real e mensagens de erro em pt-BR.
- [ ] Route Handlers de login/logout gravam e removem o JWT em cookie `httpOnly`, `SameSite=Lax` (e `Secure` em produção).
- [ ] O token nunca é acessível por JavaScript do navegador.
- [ ] `middleware` redireciona rotas protegidas sem sessão para `/login`, e usuário logado em `/login` vai para `/groups`.
- [ ] Botão "Sair" encerra a sessão.
- [ ] Estados de carregamento e erro tratados; funciona em 360 px.

---

### T-09 · feat(api): add groups and members management

- **Area:** backend
- **Spec:** `docs/specs/02-groups-and-members.md`
- **Depends on:** #7

**História:** Como organizador, quero criar grupos com vários participantes e gerenciá-los para dividir despesas com meus amigos.

**Critérios de aceite:**

- [ ] AC-GRP-01 a AC-GRP-09 atendidos.
- [ ] `GroupAccessService` com `assertCanRead` e `assertIsOwner`, reutilizável por outros módulos; acesso sem vínculo retorna `404 GROUP_NOT_FOUND`.
- [ ] O criador é incluído automaticamente como participante vinculado.
- [ ] Participante com e-mail de usuário existente é vinculado automaticamente.
- [ ] Remoção de participante com despesas retorna `409 MEMBER_HAS_EXPENSES` (a verificação usa o service de despesas quando existir, ou consulta mínima até lá).
- [ ] Testes de autorização (dono, participante, estranho) e e2e dos endpoints.

---

### T-10 · feat(web): add groups list, creation and members screens

- **Area:** frontend
- **Spec:** `docs/specs/02-groups-and-members.md`, `docs/specs/05-settlement-dashboard.md` (telas)
- **Depends on:** #8, #9

**História:** Como organizador, quero ver meus grupos, criar um novo com vários participantes e gerenciar a lista de participantes pela interface.

**Critérios de aceite:**

- [ ] `/groups` lista grupos com nome, status e número de participantes; estados vazio (com chamada para criar), carregando e erro.
- [ ] `/groups/new` permite informar nome, descrição e uma lista dinâmica de participantes (nome e e-mail opcional), com validação.
- [ ] `/groups/[id]` tem a estrutura de abas (Despesas, Saldos, Participantes, Quitação); a aba Participantes permite adicionar e remover (somente dono).
- [ ] Erro `MEMBER_HAS_EXPENSES` exibe mensagem amigável.
- [ ] Em grupo fechado, ações de edição ficam ocultas e um aviso é mostrado.
- [ ] Funciona em 360 px.

---

### T-11 · feat(api): add money and split calculators

- **Area:** backend
- **Spec:** `docs/specs/03-expenses.md` (RN-EXP-06 a RN-EXP-09), `docs/engineering/edge-cases.md` (1 a 5, 13), `docs/architecture/decisions/0001-money-as-integer-cents.md`
- **Depends on:** #2

**História:** Como participante, quero que o rateio seja exato ao centavo, para que ninguém pague ou receba a mais.

**Critérios de aceite:**

- [ ] `calculateShares(total, split)` é uma função pura, sem imports de Nest ou Prisma, nunca muta a entrada e cobre `EQUAL`, `PERCENTAGE` (basis points) e `FIXED`.
- [ ] Resto de centavos distribuído conforme RN-EXP-06 e RN-EXP-07, com desempate por `memberId` crescente.
- [ ] Erros tipados para soma de porcentagem inválida, soma fixa inválida e participantes inválidos/duplicados.
- [ ] Os exemplos da spec passam: 100/4, 100/3, 50/30/20, 10,01 com 50/50 e fixo 60/40.
- [ ] Testes de propriedade (`fast-check`): soma das partes = total; para `EQUAL`, diferença máxima de 1 centavo; determinismo.
- [ ] Cobertura de 100% das ramificações do módulo.

---

### T-12 · feat(api): add expense crud endpoints

- **Area:** backend
- **Spec:** `docs/specs/03-expenses.md`, `docs/architecture/api-contract.md`
- **Depends on:** #9, #11

**História:** Como participante, quero lançar, consultar, editar e excluir despesas do grupo.

**Critérios de aceite:**

- [ ] AC-EXP-01 a AC-EXP-14 atendidos.
- [ ] Schema Zod com `z.discriminatedUnion('type', ...)` para o rateio.
- [ ] As partes são calculadas pelo `calculateShares` e persistidas junto da despesa, em transação.
- [ ] Criação e edição travam a linha do grupo (`FOR UPDATE`) e conferem `status = OPEN`.
- [ ] Permissões: qualquer participante vinculado cria; só o criador ou o dono edita e exclui.
- [ ] Listagem paginada, ordenada por `occurredOn` desc e `createdAt` desc.
- [ ] Testes de integração e e2e cobrindo os três tipos de rateio e as regras de permissão.

---

### T-13 · feat(web): add expense form and list

- **Area:** frontend
- **Spec:** `docs/specs/03-expenses.md`, `docs/specs/05-settlement-dashboard.md` (RF-UI-07, AC-UI-06)
- **Depends on:** #10, #12

**História:** Como participante, quero lançar despesas escolhendo quem pagou e como dividir, vendo a prévia do rateio antes de salvar.

**Critérios de aceite:**

- [ ] Formulário com descrição, valor (máscara BRL → centavos), pagador, data, tipo de rateio e seleção de participantes.
- [ ] Prévia das partes em tempo real, com a lógica de resto espelhando as regras da spec; botão "Salvar" desabilitado enquanto a soma for inválida, mostrando o que falta.
- [ ] Aba Despesas lista as despesas com valor, pagador e data, com ações de editar e excluir conforme a permissão.
- [ ] Erros da API traduzidos por `code` para mensagens em pt-BR.
- [ ] Em grupo fechado, criação, edição e exclusão ficam indisponíveis.
- [ ] Estados vazio, carregando e erro; funciona em 360 px.

---

### T-14 · feat(api): add balance calculation and member statement

- **Area:** backend
- **Spec:** `docs/specs/04-balances-and-settlement.md` (RN-BAL-01 a RN-BAL-03, AC-BAL-01 a AC-BAL-03)
- **Depends on:** #12

**História:** Como participante, quero ver o saldo de cada pessoa e o extrato detalhado para entender de onde vem cada valor.

**Critérios de aceite:**

- [ ] `calculateBalances` e `buildStatement` são funções puras com testes unitários e de propriedade (soma dos saldos = 0).
- [ ] `GET /groups/:id/balances` retorna `paidCents`, `owedCents` e `netCents` por participante.
- [ ] `GET /groups/:id/members/:memberId/statement` retorna as linhas em ordem cronológica com `runningBalanceCents`; o último valor é igual ao saldo.
- [ ] Se o invariante de soma zero for violado, responde `500 INTERNAL_ERROR` e registra o erro.
- [ ] `ExpensesService.listForBalance` é a única porta de leitura de despesas para `balances` (sem importar o repository de outro módulo).
- [ ] Testes e2e dos cenários AC-BAL-01 a AC-BAL-03.

---

### T-15 · feat(api): add debt simplification algorithm

- **Area:** backend
- **Spec:** `docs/specs/04-balances-and-settlement.md` (RN-BAL-04 a RN-BAL-09), `docs/architecture/decisions/0002-debt-simplification.md`
- **Depends on:** #2

**História:** Como participante, quero o menor número possível de transferências para quitar o grupo.

**Critérios de aceite:**

- [ ] `simplifyDebts(balances)` é uma função pura, sem acesso a banco, retornando `[{ from, to, amountCents }]`.
- [ ] Para até 16 saldos não nulos, o resultado é o mínimo (DP de bitmask); acima disso, usa o guloso com no máximo `n − 1` transferências. Constante `EXACT_SOLVER_MAX_PARTICIPANTS` em um só lugar.
- [ ] Exemplos passam: cadeia (A→B→C vira A→C), ciclo (plano vazio), `+5, −3, −2, +4, −4` (3 transferências) e saldos todos zerados.
- [ ] Determinístico: mesma entrada gera o mesmo plano, independentemente da ordem de entrada.
- [ ] Testes de propriedade: zera todos os saldos; nenhuma transferência `≤ 0`, para si mesmo ou repetida; `≤ n − 1` transferências; o caminho exato nunca é pior que o guloso.
- [ ] Desempenho: 16 saldos não nulos em menos de 200 ms; 50 participantes em menos de 1 s.

---

### T-16 · feat(api): add settlement plan, group closing and transfer payment

- **Area:** backend
- **Spec:** `docs/specs/04-balances-and-settlement.md` (RN-BAL-10 a RN-BAL-16, AC-BAL-09 a AC-BAL-14)
- **Depends on:** #14, #15

**História:** Como organizador, quero fechar o grupo e congelar o plano final, e como participante quero marcar o que já foi pago.

**Critérios de aceite:**

- [ ] `GET /groups/:id/settlement-plan` calcula o plano em grupo `OPEN` e retorna o persistido em grupo `CLOSED`.
- [ ] `POST /groups/:id/close` (somente dono) fecha o grupo e persiste as transferências como `PENDING`, tudo em uma transação com lock da linha do grupo.
- [ ] Fechamento sem dívidas é permitido e gera plano vazio; fechar de novo retorna `409 GROUP_CLOSED`.
- [ ] `PATCH /groups/:id/transfers/:transferId/pay` é idempotente (`paidAt` da primeira chamada) e retorna `409 GROUP_NOT_CLOSED` se o grupo estiver aberto.
- [ ] Teste de concorrência: despesa criada durante o fechamento entra no plano ou é rejeitada com `GROUP_CLOSED`.
- [ ] Testes e2e de AC-BAL-09 a AC-BAL-14.

---

### T-17 · feat(web): add balances and member statement screens

- **Area:** frontend
- **Spec:** `docs/specs/05-settlement-dashboard.md` (RF-UI-01, RF-UI-02, AC-UI-01, AC-UI-02)
- **Depends on:** #13, #14

**História:** Como participante, quero ver quanto cada pessoa deve ou tem a receber e abrir o extrato para entender o cálculo.

**Critérios de aceite:**

- [ ] Aba Saldos mostra um cartão por participante com valor em BRL, rótulo textual ("recebe", "deve", "quitado") e cor correspondente (nunca só cor).
- [ ] Clicar no participante abre o extrato com descrição, data, pago, devido e saldo acumulado por linha.
- [ ] O total do extrato é igual ao saldo exibido na aba Saldos.
- [ ] Estados vazio, carregando e erro (com "Tentar novamente"); funciona em 360 px.

---

### T-18 · feat(web): add settlement dashboard and group closing

- **Area:** frontend
- **Spec:** `docs/specs/05-settlement-dashboard.md` (RF-UI-03 a RF-UI-06, AC-UI-03 a AC-UI-05)
- **Depends on:** #16, #17

**História:** Como grupo, queremos ver claramente quem paga quem, fechar o acerto e acompanhar os pagamentos.

**Critérios de aceite:**

- [ ] Aba Quitação mostra o plano em frases claras ("Duda paga R$ 50,00 para Ana"), o número de transferências e o total movimentado.
- [ ] Sem dívidas: mensagem "Tudo certo! Ninguém deve nada."
- [ ] Botão "Fechar grupo" (somente dono, somente grupo aberto) com diálogo de confirmação; após fechar, o status muda e as ações de edição somem.
- [ ] Em grupo fechado, cada transferência tem "Marcar como paga", com indicador de status e resumo "x de y pagas".
- [ ] Erros tratados com mensagens amigáveis; funciona em 360 px.

---

### T-19 · test(api): add end-to-end tests for the main flows

- **Area:** backend
- **Spec:** `docs/engineering/testing-strategy.md`
- **Depends on:** #16

**História:** Como time, queremos testes e2e que protejam os fluxos críticos de regressões.

**Critérios de aceite:**

- [ ] Fluxo completo: cadastro → login → criar grupo → despesas dos três tipos → saldos → plano → fechar → marcar transferência como paga.
- [ ] Cenário de cada edge case de `docs/engineering/edge-cases.md` que é verificável via API (12 a 17).
- [ ] Testes de autorização (dono, participante, estranho) para todas as rotas de grupo.
- [ ] Banco de teste isolado, com migrations aplicadas e limpeza entre testes; os testes rodam no CI.

---

### T-20 · test(web): add playwright happy path test

- **Area:** frontend
- **Spec:** `docs/engineering/testing-strategy.md`
- **Depends on:** #18

**História:** Como time, queremos um teste de interface que valide o caminho feliz de ponta a ponta.

**Critérios de aceite:**

- [ ] Playwright configurado em `apps/web/e2e/` e rodando contra o ambiente do Docker Compose.
- [ ] O teste cobre: cadastro, criação de grupo com 3 participantes, despesas igualitária, por porcentagem e por valor fixo, conferência de saldos, plano de liquidação e fechamento.
- [ ] Os valores esperados dos saldos e do plano são verificados na tela.
- [ ] Executa no CI (ou em job separado) e gera relatório em caso de falha.

---

### T-21 · docs: sync readme with the final state

- **Area:** docs
- **Spec:** `README.md`, `docs/`
- **Depends on:** #20

**História:** Como pessoa que chega ao projeto, quero um README fiel ao que foi entregue para entender o produto e rodá-lo sem surpresas.

**Critérios de aceite:**

- [ ] Instruções de "Como rodar" testadas em um clone limpo.
- [ ] Diagramas de arquitetura conferidos com o código real.
- [ ] Seção de demonstração com capturas de tela das principais telas e credenciais do seed.
- [ ] Links do board e (se existir) da aplicação publicada.
- [ ] Specs, ADRs e contrato da API atualizados com qualquer decisão que tenha mudado.
- [ ] Nenhuma seção marcada como "planejado" que já esteja implementada.

---

### T-22 · chore: deploy the application

- **Area:** infra
- **Spec:** `docs/architecture/plan.md` (seção 10)
- **Depends on:** #3, #19

**História:** Como pessoa interessada, quero acessar o produto no ar sem precisar rodá-lo localmente.

**Critérios de aceite:**

- [ ] Web publicada (Vercel ou similar) e API + PostgreSQL publicados (Render, Railway ou similar).
- [ ] Migrations aplicadas por `prisma migrate deploy` no release; segredos configurados fora do repositório.
- [ ] CORS e `API_URL` configurados; cookie com `Secure` em produção.
- [ ] Smoke test manual do fluxo completo em produção.
- [ ] URL pública registrada no README.
