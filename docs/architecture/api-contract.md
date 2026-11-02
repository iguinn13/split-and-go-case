# Contrato da API

API REST em JSON. Base URL local: `http://localhost:3001`. Autenticação por `Authorization: Bearer <jwt>` (exceto rotas públicas). Todos os identificadores são UUID. Valores monetários são **centavos inteiros** (`...Cents`). Datas de despesa são `YYYY-MM-DD`; timestamps são ISO 8601 em UTC.

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
| 401 | `UNAUTHORIZED` | Token ausente, inválido ou expirado |
| 401 | `INVALID_CREDENTIALS` | Login com e-mail ou senha incorretos |
| 403 | `FORBIDDEN` | Autenticado, mas sem permissão (ex.: não é dono) |
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
| 500 | `INTERNAL_ERROR` | Erro inesperado (inclui violação do invariante de saldo) |

### Paginação

`?page=1&pageSize=20` (padrão `1` e `20`, máximo `100`). Resposta: `{ "items": [...], "page": 1, "pageSize": 20, "total": 134 }`.

## Endpoints

### Saúde

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET | `/health` | Pública | `200 { "status": "ok", "database": "up" }` |

### Auth (spec 01)

| Método | Rota | Auth | Corpo | Resposta |
|---|---|---|---|---|
| POST | `/auth/register` | Pública | `{ name, email, password }` | `201 { id, name, email }` |
| POST | `/auth/login` | Pública | `{ email, password }` | `200 { accessToken, user: { id, name, email } }` |
| GET | `/auth/me` | JWT | — | `200 { id, name, email }` |

### Grupos e participantes (spec 02)

| Método | Rota | Corpo | Resposta |
|---|---|---|---|
| POST | `/groups` | `{ name, description?, members: [{ name, email? }] }` | `201 Group` |
| GET | `/groups` | — | `200 GroupSummary[]` |
| GET | `/groups/:groupId` | — | `200 Group` |
| PATCH | `/groups/:groupId` | `{ name?, description? }` | `200 Group` |
| POST | `/groups/:groupId/members` | `{ name, email? }` | `201 Member` |
| DELETE | `/groups/:groupId/members/:memberId` | — | `204` |

```jsonc
// Group
{
  "id": "uuid", "name": "Viagem Floripa", "description": null,
  "currency": "BRL", "status": "OPEN", "ownerId": "uuid",
  "closedAt": null, "createdAt": "2026-07-01T12:00:00.000Z",
  "members": [{ "id": "uuid", "name": "Ana", "email": "ana@example.com", "userId": "uuid" }]
}
// GroupSummary
{ "id": "uuid", "name": "Viagem Floripa", "status": "OPEN", "memberCount": 4, "createdAt": "..." }
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
// CreateExpense — o campo "split" é uma união discriminada por "type"
{
  "description": "Jantar",
  "amountCents": 10000,
  "paidByMemberId": "uuid",
  "occurredOn": "2026-07-10",
  "split": { "type": "EQUAL", "participantIds": ["uuid", "uuid", "uuid"] }
  // { "type": "PERCENTAGE", "shares": [{ "memberId": "uuid", "basisPoints": 5000 }, ...] }
  // { "type": "FIXED",      "shares": [{ "memberId": "uuid", "amountCents": 4000 }, ...] }
}

// Expense
{
  "id": "uuid", "groupId": "uuid", "description": "Jantar", "amountCents": 10000,
  "paidByMemberId": "uuid", "splitType": "EQUAL", "occurredOn": "2026-07-10",
  "createdByUserId": "uuid", "createdAt": "...", "updatedAt": "...",
  "shares": [{ "memberId": "uuid", "amountCents": 3334, "basisPoints": null }]
}
```

### Saldos e extrato (spec 04)

| Método | Rota | Resposta |
|---|---|---|
| GET | `/groups/:groupId/balances` | `200 { balances: [{ memberId, name, paidCents, owedCents, netCents }] }` |
| GET | `/groups/:groupId/members/:memberId/statement` | `200 Statement` |

```jsonc
// Statement
{
  "member": { "id": "uuid", "name": "Ana" },
  "totals": { "paidCents": 10000, "owedCents": 2500, "netCents": 7500 },
  "lines": [{
    "expenseId": "uuid", "description": "Jantar", "occurredOn": "2026-07-10",
    "paidCents": 10000, "owedCents": 2500, "netCents": 7500, "runningBalanceCents": 7500
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
  "groupId": "uuid", "status": "OPEN",           // OPEN: calculado na hora | CLOSED: persistido
  "transferCount": 1, "totalMovedCents": 5000,
  "transfers": [{
    "id": null,                                   // preenchido somente quando CLOSED
    "from": { "memberId": "uuid", "name": "Duda" },
    "to":   { "memberId": "uuid", "name": "Ana" },
    "amountCents": 5000,
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
| Editar grupo, adicionar/remover participante, fechar grupo | Dono |
| Marcar transferência como paga | Dono ou participante vinculado |
