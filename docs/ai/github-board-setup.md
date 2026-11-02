# Configuração do Board no GitHub

O gerenciamento de tarefas usa o **GitHub Projects** chamado **Split and Go Case**, aberto para visualização pública.

## Colunas (campo Status)

| Coluna | Significado |
|---|---|
| **Backlog** | Planejada, ainda não iniciada |
| **In Progress** | Em desenvolvimento |
| **In Review/Testing** | PR aberto, em revisão e teste |
| **Done** | Revisada, mergeada e verificada |

## Pré-requisito: escopo `project` no gh

O token do GitHub CLI precisa do escopo de projetos. Rode uma vez:

```bash
gh auth refresh -s project
gh auth status   # confirme que "project" aparece nos scopes
```

## Configuração inicial (uma vez)

```bash
# 1. Vincula o projeto ao repositório, torna-o público e ajusta as colunas
scripts/board/setup-board.sh

# 2. Cria labels e uma issue por task de docs/tasks/backlog.md, todas em Backlog
scripts/board/create-issues.sh
```

Ambos os scripts localizam o projeto pelo título (`Split and Go Case`) e são seguros para repetir: `create-issues.sh` ignora tasks cujo título já existe como issue.

> Rode o `setup-board.sh` **antes** de adicionar itens: trocar as opções do campo Status gera novos identificadores.

## Operação do dia a dia

```bash
scripts/board/board.sh info                      # projeto e repositório resolvidos
scripts/board/board.sh list                      # issue, status e título
scripts/board/board.sh get-status 12
scripts/board/board.sh set-status 12 "In Progress"
scripts/board/board.sh add 23                    # adiciona uma issue nova ao board (Backlog)
```

Em geral esses comandos são executados pela skill `/run-task` (ver `automation-workflow.md`).

## Criar novas tasks

1. Adicione a seção `### T-NN · tipo(escopo): descrição` em `docs/tasks/backlog.md` com `Area`, `Spec`, `Depends on`, história e critérios de aceite.
2. Rode `scripts/board/create-issues.sh`.

Mantenha o número da task igual ao número da issue; o script avisa quando divergem.

## Verificação

```bash
gh project view <número> --owner <dono> --web      # abre o board
gh project item-list <número> --owner <dono>       # itens e status
```

O board deve estar com visibilidade pública e exibir exatamente as quatro colunas acima.
