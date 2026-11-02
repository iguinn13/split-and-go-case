# Padrões de Código

Complementa `docs/constitution.md`. O código é escrito em **inglês** (identificadores, comentários, mensagens de erro da API, nomes de arquivo).

## Ferramentas

| Ferramenta | Uso |
|---|---|
| TypeScript | `strict: true`, `noUncheckedIndexedAccess: true` |
| ESLint | Config na raiz, regras `@typescript-eslint/recommended-type-checked`; `no-explicit-any` como erro |
| Prettier | Aspas simples, ponto e vírgula, `printWidth: 100`, vírgula final (`all`) |
| commitlint + husky | Valida Conventional Commits no `commit-msg`; `lint-staged` no `pre-commit` |
| pnpm | Gerenciador de pacotes (workspace) |

## Nomenclatura

| Item | Convenção | Exemplo |
|---|---|---|
| Arquivos | `kebab-case` com sufixo de papel | `create-expense.use-case.ts`, `expenses.controller.ts`, `split.calculator.ts` |
| Classes | `PascalCase` | `CreateExpenseUseCase` |
| Funções e variáveis | `camelCase` | `calculateShares` |
| Constantes | `UPPER_SNAKE_CASE` | `EXACT_SOLVER_MAX_PARTICIPANTS` |
| Enums e tipos | `PascalCase`; valores de enum `UPPER_SNAKE_CASE` | `SplitType.EQUAL` |
| Schemas Zod | `camelCase` terminando em `Schema`; tipo inferido com `PascalCase` | `createExpenseSchema` → `CreateExpenseInput` |
| Campos monetários | sufixo `Cents` | `amountCents`, `netCents` |
| Campos de porcentagem | sufixo `BasisPoints` | `basisPoints` |
| Tabelas/colunas no banco | mapeadas para `snake_case` com `@@map` / `@map` | `expense_shares.amount_cents` |

## Camadas — regras práticas

**Controller**

```ts
@Post()
async create(
  @CurrentUser() user: AuthUser,
  @Param('groupId', ParseUUIDPipe) groupId: string,
  @Body(new ZodValidationPipe(createExpenseSchema)) body: CreateExpenseInput,
) {
  return this.createExpense.execute({ userId: user.id, groupId, input: body });
}
```

- Sem `if` de regra de negócio, sem Prisma.

**Use case**

- Uma classe por ação, um método público `execute(params)`.
- Recebe um único objeto de parâmetros.
- Lança `AppError` com `code` do contrato (`throw new AppError('GROUP_CLOSED', 409)`); nunca `HttpException` direta.
- Transações com `prisma.$transaction` quando houver mais de uma escrita.

**Repository**

- Só consultas e escritas. Nome dos métodos expressa a intenção (`findByIdWithMembers`, `createWithShares`).
- Nunca lança erro de negócio; retorna `null` quando não achar.

**Calculator**

- Função pura exportada, sem classe, sem imports de Nest/Prisma.
- Entradas e saídas são tipos simples; **nunca** muta a entrada.
- Ganha testes unitários com todos os edge cases de `docs/engineering/edge-cases.md`.

## Boas práticas

1. **Zod na borda:** validar no controller; use cases confiam em dados tipados.
2. **Sem `any`**; sem `as` para silenciar o compilador (exceto casos documentados).
3. **Dinheiro:** nunca `parseFloat`, nunca `toFixed` para cálculo. Formatação só na UI.
4. **Early return** em vez de `else` aninhado; funções curtas e com nome que explica a intenção.
5. **Comentários** explicam o porquê, não o quê. Sem código comentado.
6. **Sem interfaces especulativas.** Ver constituição, seção 2.4.
7. **Imports** absolutos pelo alias `@/` dentro de cada app; nunca atravessar módulos pelo caminho do repository.
8. **Configuração** vem de variáveis de ambiente validadas por Zod na inicialização (`env.schema.ts`); o app não sobe com configuração inválida.
9. **Logs** estruturados; nunca logar senha, hash ou token.

## Front-end

- Componentes pequenos, tipados, em `PascalCase.tsx`; hooks em `use-*.ts`.
- Server Components por padrão; `'use client'` apenas onde há interatividade.
- Estilos com Tailwind; tokens de cor e espaçamento centralizados no tema.
- Formulários com validação Zod espelhando a API e mensagens em pt-BR.
- Cada tela trata os estados: carregando, vazio, erro e sucesso.
- Textos de interface em pt-BR; identificadores de código em inglês.
