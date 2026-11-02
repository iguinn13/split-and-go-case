# Split&Go — Guia para agentes

Plataforma de gestão e rateio de despesas em grupo, com liquidação em número mínimo de transferências. Desenvolvimento orientado por especificação (SDD).

## Leia antes de qualquer tarefa

1. `docs/constitution.md` — regras inegociáveis (têm precedência sobre todo o resto)
2. `docs/specs/` — **o quê** (user stories, regras `RN-*`, critérios de aceite `AC-*`)
3. `docs/architecture/` — **como** (plano, modelo de dados, contrato da API, ADRs)
4. `docs/engineering/` — padrões de código, git, testes, edge cases
5. `docs/tasks/backlog.md` — as tasks (número da task = número da issue)

## Regras essenciais

- **Idioma:** código, nomes de arquivo, commits, branches, PRs e títulos de issues em **inglês**. Documentação em **português (pt-BR)** com nomes de arquivo em inglês. Textos da interface em pt-BR.
- **Arquitetura:** monolito modular em camadas por domínio: `Controller → Use Case → Repository/Service`. **Sem DDD.** Interfaces **somente** com necessidade real (justifique no PR).
- **Regras complexas** (rateio, saldo, simplificação) em funções puras sem I/O (`*.calculator.ts`, `debt-simplifier.ts`). Use cases só orquestram.
- **Dinheiro:** inteiros em centavos (`amountCents`); porcentagem em basis points. Nunca ponto flutuante. Somente BRL no MVP.
- **Validação:** Zod nos controllers. Erros no contrato de `docs/architecture/api-contract.md`.
- **Stack:** NestJS (LTS), TypeScript estrito, Prisma, PostgreSQL, Zod, Next.js, Docker Compose, ESLint + Prettier, pnpm.
- **Qualidade:** lint, typecheck, testes e build verdes antes de abrir PR. Nunca enfraquecer testes para passar.
- **Escopo:** implemente só o que os critérios de aceite da issue pedem. Dúvida de spec: pare e pergunte.

## Git

- Conventional Commits com escopo e referência: `feat(expenses): add percentage split calculator` + rodapé `Refs #12`.
- Branch: `<type>/<issue>-<slug>`. PR com `Closes #<issue>`, título em Conventional Commit, merge por squash.
- Detalhes em `docs/engineering/git-workflow.md`.

## Board e automação

- Board GitHub Projects **Split and Go Case**: `Backlog → In Progress → In Review/Testing → Done`.
- `/run-task <issue>` executa o fluxo completo (desenvolvimento, PR, revisão, merge, Done). Ver `docs/ai/automation-workflow.md`.
- Agentes: `backend-developer`, `frontend-developer`, `code-reviewer` (`.claude/agents/`).
- Scripts do board: `scripts/board/board.sh` (status), `setup-board.sh`, `create-issues.sh`.

## Comandos (disponíveis após as tasks de fundação #1 a #5)

```bash
pnpm install
pnpm lint && pnpm typecheck && pnpm test && pnpm build
docker compose up --build        # web :3000, api :3001, postgres :5432
```
