# Contrato da API

API REST em JSON. Base URL local: `http://localhost:3001`. Autenticação por `Authorization: Bearer <jwt>` (exceto rotas públicas). Todos os identificadores são UUID. Valores monetários são **inteiros na menor unidade da moeda** (`...Minor`; centavos em BRL, ienes em JPY). Taxas de câmbio são **texto decimal** (`"5.4325"`), nunca número. Datas de despesa são `YYYY-MM-DD`; timestamps são ISO 8601 em UTC.

## Convenções

### Formato de erro

```json
{
  "statusCode": 422,
  "code": "VALIDATION_ERROR",
  "message": "Invalid request data",
  "details": [{ "path": "members.1.name", "message": "Required" }]
}
```

`details` existe apenas em erros de validação. `message` é sempre em inglês e nunca contém detalhes internos.

### Códigos de erro

| HTTP | `code` | Quando |
|---|---|---|
| 400 | `BAD_REQUEST` | Requisição malformada (ex.: JSON inválido) |
| 404 | `NOT_FOUND` | Rota inexistente |
| 401 | `UNAUTHORIZED` | Token ausente, inválido ou expirado |
| 401 | `INVALID_CREDENTIALS` | Login com e-mail ou senha incorretos |
| 403 | `FORBIDDEN` | Autenticado, mas sem permissão (ex.: não é dono; tentar remover o dono do grupo, RN-GRP-08) |
| 404 | `GROUP_NOT_FOUND` | Grupo inexistente ou sem vínculo com o usuário |
| 404 | `MEMBER_NOT_FOUND` | Participante não existe no grupo |
| 404 | `EXPENSE_NOT_FOUND` | Despesa não existe no grupo |
| 404 | `TRANSFER_NOT_FOUND` | Transferência não existe no grupo |
| 409 | `EMAIL_ALREADY_IN_USE` | Cadastro com e-mail já existente |
| 409 | `GROUP_CLOSED` | Operação de escrita em grupo fechado |
| 409 | `GROUP_NOT_CLOSED` | Operação que exige grupo fechado |
| 409 | `GROUP_NEEDS_MORE_MEMBERS` | Despesa em grupo com menos de 2 participantes |
| 409 | `MEMBER_HAS_EXPENSES` | Remoção de participante com despesas |
| 422 | `VALIDATION_ERROR` | Corpo, query ou params inválidos |
| 422 | `INVALID_SPLIT_PARTICIPANTS` | Pagador/participante fora do grupo ou repetido |
| 422 | `SPLIT_PERCENTAGE_SUM_INVALID` | Soma dos basis points ≠ 10000 |
| 422 | `SPLIT_FIXED_SUM_INVALID` | Soma dos valores fixos ≠ total |
| 422 | `EXCHANGE_RATE_INVALID` | Taxa ausente (moeda ≠ base), inválida, ou ≠ 1 com a mesma moeda |
| 422 | `AMOUNT_OUT_OF_RANGE` | Valor original ou convertido fora de `1..1.000.000.000` |
| 503 | `EXCHANGE_RATE_UNAVAILABLE` | Provedor de câmbio indisponível ou com tempo esgotado |
| 500 | `INTERNAL_ERROR` | Erro inesperado (inclui violação do invariante de saldo) |

### Paginação

`?page=1&pageSize=20` (padrão `1` e `20`, máximo `100`). Resposta: `{ "items": [...], "page": 1, "pageSize": 20, "total": 134 }`.

## Endpoints

### Saúde

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET | `/health` | Pública | `200 { "status": "ok", "database": "up" }` |

### Moedas e câmbio (spec 06)

| Método | Rota | Auth | Resposta |
|---|---|---|---|
| GET | `/currencies` | JWT | `200 [{ code, name, minorUnits }]` |
| GET | `/exchange-rates?from=USD&to=BRL&date=2026-07-10` | JWT | `200 { from, to, rate, date, source }` ou `503 EXCHANGE_RATE_UNAVAILABLE` |

```jsonc
{ "from": "USD", "to": "BRL", "rate": "5.43250000", "date": "2026-07-10", "source": "frankfurter" }
```

`date` é opcional (padrão: hoje). Com `from = to`, retorna `rate = "1"` sem chamar o provedor. A resposta é cacheada em memória por par e data (1 h).

### Auth (spec 01)

| Método | Rota | Auth | Corpo | Resposta |
|---|---|---|---|---|
| POST | `/auth/register` | Pública | `{ name, email, password }` | `201 { id, name, email }` |
| POST | `/auth/login` | Pública | `{ email, password }` | `200 { accessToken, user: { id, name, email } }` |
| GET | `/auth/me` | JWT | — | `200 { id, name, email }` |

### Grupos e participantes (spec 02)

| Método | Rota | Corpo | Resposta |
|---|---|---|---|
| POST | `/groups` | `{ name, baseCurrency?, description?, members: [{ name, email? }] }` | `201 Group` |
| GET | `/groups` | — | `200 GroupSummary[]` |
| GET | `/groups/:groupId` | — | `200 Group` |
| PATCH | `/groups/:groupId` | `{ name?, description? }` | `200 Group` |
| POST | `/groups/:groupId/members` | `{ name, email? }` | `201 Member` |
| DELETE | `/groups/:groupId/members/:memberId` | — | `204` |

```jsonc
// Group
{
  "id": "uuid", "name": "Viagem Floripa", "description": null,
  "baseCurrency": "BRL", "status": "OPEN", "ownerId": "uuid",
  "closedAt": null, "createdAt": "2026-07-01T12:00:00.000Z",
  "members": [{ "id": "uuid", "name": "Ana", "email": "ana@example.com", "userId": "uuid" }]
}
// GroupSummary
{ "id": "uuid", "name": "Viagem Floripa", "baseCurrency": "BRL", "status": "OPEN", "memberCount": 4, "createdAt": "..." }
```

### Despesas (spec 03)

| Método | Rota | Corpo | Resposta |
|---|---|---|---|
| POST | `/groups/:groupId/expenses` | `CreateExpense` | `201 Expense` |
| GET | `/groups/:groupId/expenses` | — (`page`, `pageSize`) | `200 Page<Expense>` |
| GET | `/groups/:groupId/expenses/:expenseId` | — | `200 Expense` |
| PUT | `/groups/:groupId/expenses/:expenseId` | `CreateExpense` | `200 Expense` |
| DELETE | `/groups/:groupId/expenses/:expenseId` | — | `204` |

```jsonc
// CreateExpense — "split" é uma união discriminada por "type"
{
  "description": "Jantar",
  "currency": "USD",                      // opcional: padrão = baseCurrency do grupo
  "originalAmountMinor": 10000,           // na menor unidade de "currency" (US$ 100,00)
  "exchangeRate": "5.4325",               // obrigatória se currency != baseCurrency
  "paidByMemberId": "uuid",
  "occurredOn": "2026-07-10",
  "split": { "type": "EQUAL", "participantIds": ["uuid", "uuid", "uuid"] }
  // { "type": "PERCENTAGE", "shares": [{ "memberId": "uuid", "basisPoints": 5000 }, ...] }
  // { "type": "FIXED",      "shares": [{ "memberId": "uuid", "originalAmountMinor": 4000 }, ...] }
}

// Expense
{
  "id": "uuid", "groupId": "uuid", "description": "Jantar",
  "currency": "USD", "originalAmountMinor": 10000, "exchangeRate": "5.43250000",
  "amountMinor": 54325,                   // convertido, na moeda-base do grupo
  "paidByMemberId": "uuid", "splitType": "EQUAL", "occurredOn": "2026-07-10",
  "createdByUserId": "uuid", "createdAt": "...", "updatedAt": "...",
  "shares": [{ "memberId": "uuid", "originalAmountMinor": 3334, "amountMinor": 18109, "basisPoints": null }]
}
```

### Saldos e extrato (spec 04)

| Método | Rota | Resposta |
|---|---|---|
| GET | `/groups/:groupId/balances` | `200 { currency, balances: [{ memberId, name, paidMinor, owedMinor, netMinor }] }` (`currency` = moeda-base) |
| GET | `/groups/:groupId/members/:memberId/statement` | `200 Statement` (`lines[].amountMinor` = total convertido da despesa, lido do valor persistido, nunca recalculado) |

```jsonc
// Statement
{
  "currency": "BRL",                      // moeda-base; todos os valores abaixo estão nela
  "member": { "id": "uuid", "name": "Ana" },
  "totals": { "paidMinor": 54325, "owedMinor": 13581, "netMinor": 40744 },
  "lines": [{
    "expenseId": "uuid", "description": "Jantar", "occurredOn": "2026-07-10",
    "original": { "currency": "USD", "amountMinor": 10000, "exchangeRate": "5.43250000" },  // null se moeda = base
    "amountMinor": 54325,                 // total da despesa convertido (valor persistido, moeda-base); igual ao original se moeda = base
    "paidMinor": 54325, "owedMinor": 13581, "netMinor": 40744, "runningBalanceMinor": 40744
  }]
}
```

### Liquidação (spec 04)

| Método | Rota | Corpo | Resposta |
|---|---|---|---|
| GET | `/groups/:groupId/settlement-plan` | — | `200 SettlementPlan` |
| POST | `/groups/:groupId/close` | — | `200 SettlementPlan` (grupo agora `CLOSED`) |
| PATCH | `/groups/:groupId/transfers/:transferId/pay` | — | `200 Transfer` |

```jsonc
// SettlementPlan
{
  "groupId": "uuid", "currency": "BRL", "status": "OPEN",   // currency = moeda-base; OPEN: calculado na hora | CLOSED: persistido
  "transferCount": 1, "totalMovedMinor": 5000,
  "transfers": [{
    "id": null,                                   // preenchido somente quando CLOSED
    "from": { "memberId": "uuid", "name": "Duda" },
    "to":   { "memberId": "uuid", "name": "Ana" },
    "amountMinor": 5000,
    "status": null,                               // PENDING | PAID quando CLOSED
    "paidAt": null
  }]
}
```

## Validação (Zod)

Cada rota com entrada tem um schema Zod em `dto/` do módulo e é aplicada pelo `ZodValidationPipe` no controller. Os tipos TypeScript dos DTOs são inferidos (`z.infer`). Schemas de `split` usam `z.discriminatedUnion('type', [...])`.

## Autorização (resumo)

| Operação | Quem pode |
|---|---|
| Ler grupo, despesas, saldos, plano | Dono ou participante vinculado |
| Criar despesa | Dono ou participante vinculado |
| Editar/excluir despesa | Criador da despesa ou dono |
| Editar grupo, adicionar/remover participante, fechar grupo | Dono (o dono em si não pode ser removido: `403 FORBIDDEN`) |
| Marcar transferência como paga | Dono ou participante vinculado |
