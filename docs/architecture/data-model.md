# Modelo de Dados

Banco: PostgreSQL. ORM: Prisma. Todo dinheiro em **centavos inteiros**; porcentagem em **basis points**.

## ERD

```mermaid
erDiagram
    USER ||--o{ GROUP : "owns"
    USER ||--o{ GROUP_MEMBER : "linked to"
    USER ||--o{ EXPENSE : "created"
    GROUP ||--|{ GROUP_MEMBER : "has"
    GROUP ||--o{ EXPENSE : "has"
    GROUP ||--o{ SETTLEMENT_TRANSFER : "has"
    GROUP_MEMBER ||--o{ EXPENSE : "paid"
    GROUP_MEMBER ||--o{ EXPENSE_SHARE : "owes"
    EXPENSE ||--|{ EXPENSE_SHARE : "split into"
    GROUP_MEMBER ||--o{ SETTLEMENT_TRANSFER : "from"
    GROUP_MEMBER ||--o{ SETTLEMENT_TRANSFER : "to"

    USER {
        uuid id PK
        string name
        string email UK
        string passwordHash
        datetime createdAt
    }
    GROUP {
        uuid id PK
        string name
        string description
        string currency "BRL"
        enum status "OPEN | CLOSED"
        uuid ownerId FK
        datetime closedAt
        datetime createdAt
    }
    GROUP_MEMBER {
        uuid id PK
        uuid groupId FK
        uuid userId FK "nullable"
        string name
        string email "nullable"
        datetime createdAt
    }
    EXPENSE {
        uuid id PK
        uuid groupId FK
        string description
        int amountCents
        uuid paidByMemberId FK
        enum splitType "EQUAL | PERCENTAGE | FIXED"
        date occurredOn
        uuid createdByUserId FK
        datetime createdAt
        datetime updatedAt
    }
    EXPENSE_SHARE {
        uuid id PK
        uuid expenseId FK
        uuid memberId FK
        int amountCents
        int basisPoints "nullable, só PERCENTAGE"
    }
    SETTLEMENT_TRANSFER {
        uuid id PK
        uuid groupId FK
        uuid fromMemberId FK
        uuid toMemberId FK
        int amountCents
        enum status "PENDING | PAID"
        datetime paidAt
        datetime createdAt
    }
```

## Rascunho do schema Prisma

> O schema definitivo nasce na task de Prisma (#4). Este rascunho fixa nomes, tipos e constraints.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum GroupStatus {
  OPEN
  CLOSED
}

enum SplitType {
  EQUAL
  PERCENTAGE
  FIXED
}

enum TransferStatus {
  PENDING
  PAID
}

model User {
  id           String   @id @default(uuid()) @db.Uuid
  name         String
  email        String   @unique
  passwordHash String
  createdAt    DateTime @default(now())

  ownedGroups Group[]
  memberships GroupMember[]
  expenses    Expense[]
}

model Group {
  id          String      @id @default(uuid()) @db.Uuid
  name        String
  description String?
  currency    String      @default("BRL")
  status      GroupStatus @default(OPEN)
  ownerId     String      @db.Uuid
  closedAt    DateTime?
  createdAt   DateTime    @default(now())

  owner     User                 @relation(fields: [ownerId], references: [id])
  members   GroupMember[]
  expenses  Expense[]
  transfers SettlementTransfer[]

  @@index([ownerId])
}

model GroupMember {
  id        String   @id @default(uuid()) @db.Uuid
  groupId   String   @db.Uuid
  userId    String?  @db.Uuid
  name      String
  email     String?
  createdAt DateTime @default(now())

  group Group @relation(fields: [groupId], references: [id], onDelete: Cascade)
  user  User? @relation(fields: [userId], references: [id])

  paidExpenses  Expense[]
  shares        ExpenseShare[]
  transfersFrom SettlementTransfer[] @relation("TransferFrom")
  transfersTo   SettlementTransfer[] @relation("TransferTo")

  @@unique([groupId, userId])
  @@unique([groupId, email])
  @@index([userId])
  @@index([email])
  // Unicidade case-insensitive de nome: índice único em lower(name) criado via SQL na migration.
}

model Expense {
  id              String    @id @default(uuid()) @db.Uuid
  groupId         String    @db.Uuid
  description     String
  amountCents     Int
  paidByMemberId  String    @db.Uuid
  splitType       SplitType
  occurredOn      DateTime  @db.Date
  createdByUserId String    @db.Uuid
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  group     Group          @relation(fields: [groupId], references: [id], onDelete: Cascade)
  paidBy    GroupMember    @relation(fields: [paidByMemberId], references: [id])
  createdBy User           @relation(fields: [createdByUserId], references: [id])
  shares    ExpenseShare[]

  @@index([groupId, occurredOn(sort: Desc), createdAt(sort: Desc)])
  // CHECK (amount_cents > 0) via SQL na migration.
}

model ExpenseShare {
  id          String @id @default(uuid()) @db.Uuid
  expenseId   String @db.Uuid
  memberId    String @db.Uuid
  amountCents Int
  basisPoints Int?

  expense Expense     @relation(fields: [expenseId], references: [id], onDelete: Cascade)
  member  GroupMember @relation(fields: [memberId], references: [id])

  @@unique([expenseId, memberId])
  @@index([memberId])
  // CHECK (amount_cents >= 0) via SQL na migration.
}

model SettlementTransfer {
  id           String         @id @default(uuid()) @db.Uuid
  groupId      String         @db.Uuid
  fromMemberId String         @db.Uuid
  toMemberId   String         @db.Uuid
  amountCents  Int
  status       TransferStatus @default(PENDING)
  paidAt       DateTime?
  createdAt    DateTime       @default(now())

  group  Group       @relation(fields: [groupId], references: [id], onDelete: Cascade)
  from   GroupMember @relation("TransferFrom", fields: [fromMemberId], references: [id])
  to     GroupMember @relation("TransferTo", fields: [toMemberId], references: [id])

  @@unique([groupId, fromMemberId, toMemberId])
  @@index([groupId])
  // CHECK (amount_cents > 0 AND from_member_id <> to_member_id) via SQL na migration.
}
```

## Constraints e invariantes

| Regra | Onde é garantida |
|---|---|
| E-mail único por usuário | `@unique` (e normalização na aplicação) |
| E-mail e usuário únicos por grupo | `@@unique([groupId, email])`, `@@unique([groupId, userId])` |
| Nome único por grupo (sem diferenciar maiúsculas) | Índice único em `lower(name)` por grupo, criado por SQL na migration |
| `amountCents > 0` na despesa | `CHECK` na migration + validação Zod |
| Uma parte por participante por despesa | `@@unique([expenseId, memberId])` |
| Soma das partes = valor da despesa | Calculator + conferência no use case antes de persistir |
| Soma dos saldos = 0 | Garantida pelos dois itens acima; verificada em runtime em `balances` |
| Transferência `from ≠ to` e `> 0` | `CHECK` na migration |
| Não editar grupo `CLOSED` | Use cases (com lock da linha do grupo) |

## Notas de modelagem

- `amountCents` usa `Int` (32 bits, máximo ≈ R$ 21,4 milhões). O limite de negócio por despesa (R$ 1 milhão) fica bem abaixo. Somas de saldo usam `number` no código (seguro até 2⁵³).
- As partes são **persistidas** (e não recalculadas a cada consulta) para que o histórico não mude se a regra de arredondamento evoluir.
- A remoção de participante é física e bloqueada quando há despesas (`RN-GRP-07`), então não existe estado "órfão".
- Exclusão de despesa é física no MVP; trilha de auditoria é item de roadmap.
