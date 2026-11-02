# Agentes de IA

O desenvolvimento do Split&Go é assistido por três agentes do Claude Code, definidos em `.claude/agents/`. Eles seguem a mesma fonte de verdade: `CLAUDE.md`, `docs/constitution.md` e as specs.

| Agente | Arquivo | Modelo / esforço | Responsabilidade |
|---|---|---|---|
| **backend-developer** | `.claude/agents/backend-developer.md` | Sonnet · `medium` | Implementa tasks de back-end (NestJS, Prisma, Zod, PostgreSQL) e tasks de infra ligadas à API. |
| **frontend-developer** | `.claude/agents/frontend-developer.md` | Sonnet · `medium` | Implementa tasks de front-end (Next.js, Tailwind, Zod). |
| **code-reviewer** | `.claude/agents/code-reviewer.md` | Sonnet · `high` | Revisa o PR contra os critérios de aceite da issue, as specs e a constituição. Retorna `APPROVED` ou `CHANGES_REQUESTED`. |

## Escolha do agente

A label de área da issue define quem executa:

| Label | Agente |
|---|---|
| `backend` | backend-developer |
| `frontend` | frontend-developer |
| `infra` | backend-developer (frontend-developer se a task só toca `apps/web`) |
| `docs` | backend-developer |

## Contrato entre agentes e orquestrador

- **Desenvolvedor recebe:** número da issue (escrita em português) e o `Título do PR`. Lê a issue e a documentação por conta própria; código, commits e título do PR ficam em inglês.
- **Desenvolvedor entrega:** branch com commits semânticos (`Refs #n`), PR com `Closes #n`, relatório com a evidência de cada critério.
- **Desenvolvedor não faz:** merge, mudança de status no board, escopo além dos critérios da issue.
- **Revisor recebe:** número da issue e do PR.
- **Revisor entrega:** veredito `APPROVED` ou `CHANGES_REQUESTED`, com evidência por critério ou lista de problemas com arquivo e linha.
- **Revisor não faz:** alterar código, fazer merge ou mexer no board.
- **Orquestrador** (skill `/run-task`): move os cards, aciona os agentes, faz o merge após aprovação e controla os ciclos de revisão.

## Limites e salvaguardas

1. Agentes de desenvolvimento implementam **uma** issue por vez e só o que os critérios pedem. Trabalho extra vira sugestão de nova task.
2. Ambiguidade na spec: o agente para e reporta a dúvida em vez de adivinhar.
3. Testes nunca são removidos ou enfraquecidos para passar.
4. O revisor não aprova sem evidência para cada critério e sem lint, typecheck, testes e build verdes.
5. Máximo de 2 ciclos de revisão por task; depois disso a decisão volta para uma pessoa.
6. Responsabilidade final: toda mudança é entendida e aprovada por quem mantém o projeto; o fluxo automatizado acelera o trabalho, mas não substitui esse entendimento.
