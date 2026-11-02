# Fluxo de Git e Commits

O histórico de commits conta a evolução técnica do produto e se liga às tasks do board **Split and Go Case**.

## Branches

| Padrão | Uso |
|---|---|
| `main` | Sempre estável. Recebe somente PRs revisados (squash merge). |
| `feat/<issue>-<slug>` | Funcionalidade (`feat/12-expenses-crud`) |
| `fix/<issue>-<slug>` | Correção |
| `chore/<issue>-<slug>` | Infra, tooling, dependências |
| `docs/<issue>-<slug>` | Somente documentação |
| `test/<issue>-<slug>` | Somente testes |

`<issue>` é o número da issue no GitHub; `<slug>` em inglês e `kebab-case`, derivado do campo **Título do PR** da issue. As issues e cards do board são escritos em português; branches, commits e títulos de PR ficam em inglês.

## Conventional Commits

Formato: `<type>(<scope>): <description>`

```
feat(expenses): add percentage split calculator

Distribute remainder cents by largest fractional remainder, breaking
ties by member id so results are deterministic.

Refs #11
```

### Tipos

| Tipo | Quando |
|---|---|
| `feat` | Nova funcionalidade |
| `fix` | Correção de bug |
| `docs` | Documentação |
| `test` | Testes |
| `refactor` | Mudança interna sem alterar comportamento |
| `perf` | Melhoria de desempenho |
| `build` | Build, dependências, Docker |
| `ci` | Pipelines |
| `chore` | Tarefas de manutenção e tooling |

### Escopos

`api`, `web`, `auth`, `groups`, `expenses`, `balances`, `settlements`, `infra`, `docs`, `ai`, `github`.

### Regras

1. Descrição em inglês, no imperativo, minúscula, sem ponto final, até 72 caracteres.
2. Corpo (opcional) explica o **porquê**, em inglês, com linhas de até 100 caracteres.
3. **Todo commit referencia a issue** no rodapé: `Refs #<n>`. O último commit do PR pode usar `Closes #<n>`.
4. Commits pequenos e incrementais; cada commit compila e passa nos testes.
5. Breaking changes: `!` após o tipo/escopo e rodapé `BREAKING CHANGE:`.
6. Commits de agentes de IA incluem a linha `Co-Authored-By` correspondente.

## Pull requests

- Título igual ao campo **Título do PR** da issue, em Conventional Commit (será o título do squash merge): `feat(expenses): add expense crud endpoints`.
- Corpo usa `.github/pull_request_template.md`, inclui `Closes #<n>` e o checklist de critérios de aceite da issue.
- Um PR resolve **uma** issue.
- Merge por **squash**; a branch é apagada depois.
- CI (lint, teste e build) precisa estar verde.

## Relação com o board

| Evento | Status do card |
|---|---|
| Trabalho começa (branch criada) | `In Progress` |
| PR aberto | `In Review/Testing` |
| Review aprovado e PR mergeado | `Done` |
| Review reprovado | volta para `In Progress` |

A automação desse fluxo está descrita em `docs/ai/automation-workflow.md`.
