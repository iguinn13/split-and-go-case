# Spec 02 — Grupos e Participantes

## Contexto

Um grupo reúne os participantes que dividem despesas. O usuário que cria o grupo é o **dono**. Participantes podem estar vinculados a usuários com conta ou ser **convidados** (somente nome, e-mail opcional).

## User stories

- **US-GRP-01** — Como organizador, quero criar um grupo informando nome e vários participantes de uma vez.
- **US-GRP-02** — Como organizador, quero adicionar ou remover participantes enquanto o grupo está aberto.
- **US-GRP-03** — Como usuário, quero ver a lista dos grupos de que participo e abrir os detalhes de cada um.

## Requisitos funcionais

| ID | Requisito |
|---|---|
| RF-GRP-01 | `POST /groups` cria um grupo com `name`, `baseCurrency` (opcional, padrão `BRL`), `description` opcional e `members[]`. |
| RF-GRP-02 | O criador vira dono e é incluído automaticamente como participante vinculado ao seu usuário. |
| RF-GRP-03 | `GET /groups` lista os grupos em que o usuário é dono ou participante vinculado. |
| RF-GRP-04 | `GET /groups/:id` retorna o grupo, seus participantes e seu status. |
| RF-GRP-05 | `POST /groups/:id/members` adiciona um participante. |
| RF-GRP-06 | `DELETE /groups/:id/members/:memberId` remove um participante. |
| RF-GRP-07 | `PATCH /groups/:id` altera nome e descrição (somente dono). |

## Regras de negócio

| ID | Regra |
|---|---|
| RN-GRP-01 | `name` do grupo: 2 a 80 caracteres. `baseCurrency` deve ser uma moeda suportada (`06-currencies.md`), padrão `BRL`, e **não pode ser alterada** depois da criação. |
| RN-GRP-02 | Um grupo precisa de no mínimo **2** participantes (incluindo o criador) para registrar despesas. A criação aceita 1 participante (só o criador) e permite completar depois. |
| RN-GRP-03 | Nome do participante: 1 a 60 caracteres, único dentro do grupo (comparação sem diferenciar maiúsculas). |
| RN-GRP-04 | E-mail do participante é opcional, normalizado e único dentro do grupo quando informado. |
| RN-GRP-05 | Se o e-mail de um participante bate com o de um usuário cadastrado, o participante é vinculado a esse usuário. Se o usuário se cadastrar depois, o vínculo é feito no cadastro. |
| RN-GRP-06 | Só o dono adiciona/remove participantes e edita o grupo. Qualquer participante vinculado pode ler o grupo e lançar despesas. |
| RN-GRP-07 | Não é possível remover um participante que seja pagador ou participante de alguma despesa (`409 MEMBER_HAS_EXPENSES`). |
| RN-GRP-08 | O dono não pode ser removido do grupo; a tentativa retorna `403 FORBIDDEN` (decisão: não há código de erro específico). |
| RN-GRP-09 | Grupo `CLOSED` não aceita mudanças de participantes (`409 GROUP_CLOSED`). |
| RN-GRP-10 | Usuário sem vínculo com o grupo recebe `404` (não revelar existência). |

## Critérios de aceite

### AC-GRP-01 — Criar grupo com vários participantes
- **Dado** um usuário autenticado
- **Quando** envio `POST /groups` com nome "Viagem Floripa" e participantes "Bia", "Caio" e "Duda"
- **Então** recebo `201` com o grupo `OPEN` e 4 participantes (o criador e os 3 informados), `baseCurrency = BRL`.

### AC-GRP-02 — Validação de participantes
- **Quando** envio dois participantes com o mesmo nome (ou o mesmo e-mail) no mesmo grupo
- **Então** recebo `422` com `VALIDATION_ERROR` indicando o campo duplicado.

### AC-GRP-03 — Listar meus grupos
- **Dado** que sou dono do grupo A e participante vinculado do grupo B, e não tenho vínculo com o grupo C
- **Quando** chamo `GET /groups`
- **Então** vejo A e B, e não vejo C.

### AC-GRP-04 — Acesso negado a grupo alheio
- **Quando** chamo `GET /groups/:id` de um grupo sem vínculo comigo
- **Então** recebo `404 GROUP_NOT_FOUND`.

### AC-GRP-05 — Adicionar participante
- **Dado** um grupo `OPEN` do qual sou dono
- **Quando** adiciono "Edu" com e-mail de um usuário já cadastrado
- **Então** recebo `201` e o participante fica vinculado àquele usuário, que passa a ver o grupo.

### AC-GRP-06 — Remover participante sem despesas
- **Dado** um participante sem nenhuma despesa associada
- **Quando** o dono o remove
- **Então** recebo `204` e ele some da lista.

### AC-GRP-07 — Remover participante com despesas
- **Dado** um participante que pagou ou participa de uma despesa
- **Quando** tento removê-lo
- **Então** recebo `409 MEMBER_HAS_EXPENSES` e nada muda.

### AC-GRP-08 — Permissão de dono
- **Dado** que sou participante, mas não dono
- **Quando** tento adicionar ou remover participantes ou editar o grupo
- **Então** recebo `403 FORBIDDEN`.

### AC-GRP-08b — Dono não removível
- **Dado** que sou o dono do grupo
- **Quando** tento remover o participante vinculado a mim (o próprio dono)
- **Então** recebo `403 FORBIDDEN` e nada muda.

### AC-GRP-09 — Grupo fechado
- **Dado** um grupo `CLOSED`
- **Quando** tento adicionar ou remover participantes
- **Então** recebo `409 GROUP_CLOSED`.

### AC-GRP-10 — Moeda-base do grupo
- **Quando** crio um grupo com `baseCurrency = "USD"`
- **Então** o grupo é criado em USD e todos os saldos e o plano de liquidação passam a ser expressos em USD.
- **E** moeda não suportada retorna `422 VALIDATION_ERROR`, e `PATCH /groups/:id` não aceita alterar `baseCurrency`.
