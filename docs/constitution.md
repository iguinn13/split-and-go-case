# Constituição do Projeto

Princípios inegociáveis do Split&Go. Qualquer spec, plano, task ou PR que contrarie este documento deve ser corrigido, ou este documento deve ser alterado antes (via ADR em `docs/architecture/decisions/`).

## 1. Método: Spec-Driven Development

1. **Spec primeiro.** Nenhuma funcionalidade é implementada sem uma spec em `docs/specs/` com critérios de aceite verificáveis.
2. **Plan depois.** As decisões técnicas vivem em `docs/architecture/`. Mudou a decisão, muda o documento no mesmo PR.
3. **Tasks derivam da spec.** Cada task em `docs/tasks/backlog.md` (e sua issue no board) referencia a spec e copia os critérios de aceite. Se o critério não está na spec, ele não existe.
4. **Código é a última etapa.** O PR implementa exatamente os critérios da task. Escopo extra vira nova task.

Ordem de precedência em caso de conflito: `constitution.md` > `specs/` > `architecture/` > `engineering/` > `tasks/`.

## 2. Arquitetura

1. **Monolito modular em camadas tradicional**, separado por domínio de negócio: `Controller → Use Case → Repository / Service`.
2. **Sem DDD.** Não há entidades ricas, agregados, value objects formais, eventos de domínio nem repositórios abstratos por padrão.
3. **Regras complexas** (rateio, saldo, simplificação de dívidas) ficam em **funções puras** (`*.calculator.ts`, `debt-simplifier.ts`), sem acesso a banco, sem `Date.now()`, sem efeitos colaterais. Use cases orquestram: carregam dados → chamam a função pura → persistem.
4. **Interfaces só com necessidade real**: mais de uma implementação existente, ou fronteira externa que precise ser trocada ou simulada em teste. Interface "por convenção" é proibida. Toda interface criada precisa de uma justificativa no PR.
5. **Dependência entre módulos** acontece somente via services/use cases exportados pelo módulo. Um módulo nunca importa o repository de outro.
6. **Controllers são finos.** Só fazem parsing/validação (Zod), chamam um use case e formatam a resposta. Nenhuma regra de negócio em controller.

## 3. Dados e dinheiro

1. **Dinheiro é inteiro na menor unidade da moeda** (`amountMinor`: centavos em BRL/USD/EUR, ienes em JPY). A quantidade de casas decimais vem do catálogo de moedas (ISO 4217). `float`/`number` fracionário nunca representa valor monetário.
2. **Porcentagem é inteira em basis points** (1% = 100 bp; 100% = 10000 bp). **Taxa de câmbio** é texto decimal com até 8 casas e é convertida com `BigInt`, nunca com `float`.
3. **Multi-moeda no MVP:** cada grupo tem uma **moeda-base** (padrão `BRL`, imutável). Cada despesa pode ser lançada em qualquer moeda suportada e guarda um **snapshot imutável** (moeda, valor original, taxa e valor convertido). Rateio, saldos e plano de liquidação são sempre calculados na moeda-base.
4. **Invariante de saldo:** a soma dos saldos de todos os participantes de um grupo é sempre `0`. Qualquer violação é bug e deve falhar de forma explícita (erro 500 logado), nunca ser mascarada.
5. **Resto da menor unidade** (centavos) é sempre distribuído de forma determinística e documentada (ver `specs/03-expenses.md`).
6. Mudanças de schema só por migration do Prisma, versionada.

## 4. Qualidade

1. **TypeScript estrito** (`strict: true`), sem `any` implícito. `any` explícito exige comentário justificando.
2. **ESLint + Prettier** obrigatórios e sem warnings no CI.
3. **Toda entrada externa é validada com Zod** na borda (controllers). Dados já validados não são revalidados em camadas internas.
4. **Testes:** funções puras têm cobertura unitária completa dos edge cases. Use cases críticos têm teste de integração. Fluxos principais têm e2e. Ver `engineering/testing-strategy.md`.
5. **Erros** seguem o contrato único de `architecture/api-contract.md`. Nada de stack trace ou mensagem interna vazando para o cliente.
6. **Segurança mínima:** senha com hash forte, JWT com expiração, cookie `httpOnly` + `SameSite`, autorização verificada em todo endpoint de grupo (o usuário precisa ser dono ou participante vinculado).

## 5. Idioma e convenções

1. **Código, nomes de arquivo, identificadores, commits, branches, títulos de PR e mensagens de erro da API em inglês.**
2. **Documentação em português (pt-BR)**, com nomes de arquivo em inglês. **Issues e cards do board (título, história e critérios de aceite) também em português.**
3. Textos exibidos ao usuário final na interface são em pt-BR.
4. **Conventional Commits** com escopo e referência à issue (`Refs #n`). Ver `engineering/git-workflow.md`.

## 6. Processo

1. Todo trabalho passa pelo board **Split and Go Case**, com os status `Backlog → In Progress → In Review/Testing → Done`.
2. Todo PR referencia a issue (`Closes #n`) e só é mergeado após revisão contra os critérios de aceite.
3. Nenhuma task entra em `Done` sem lint, testes e build verdes.
4. Commits pequenos e incrementais. Cada commit deixa o repositório em estado funcional.
