# Spec 01 — Autenticação

## Contexto

Usuários precisam de conta para criar e acessar grupos. O MVP usa e-mail e senha com JWT. Não há recuperação de senha nem login social (ver roadmap V2).

## User stories

- **US-AUTH-01** — Como visitante, quero criar uma conta com nome, e-mail e senha para acessar a plataforma.
- **US-AUTH-02** — Como usuário, quero entrar com e-mail e senha para acessar meus grupos.
- **US-AUTH-03** — Como usuário autenticado, quero encerrar minha sessão para proteger minha conta.

## Requisitos funcionais

| ID | Requisito |
|---|---|
| RF-AUTH-01 | `POST /auth/register` cria um usuário com `name`, `email` e `password`. |
| RF-AUTH-02 | `POST /auth/login` valida credenciais e retorna um JWT de acesso. |
| RF-AUTH-03 | `GET /auth/me` retorna o usuário autenticado. |
| RF-AUTH-04 | Rotas de grupo, despesa, saldo e liquidação exigem JWT válido. |
| RF-AUTH-05 | No cadastro, participantes pendentes de grupos com o mesmo e-mail são vinculados ao novo usuário (ver `02-groups-and-members.md`, RN-GRP-05). |
| RF-AUTH-06 | A interface guarda o JWT em cookie `httpOnly`, emitido pelo servidor Next.js, e redireciona rotas protegidas para o login. |

## Regras de negócio

| ID | Regra |
|---|---|
| RN-AUTH-01 | `email` é normalizado (trim + minúsculas) e único no sistema. |
| RN-AUTH-02 | `password` tem no mínimo 8 caracteres e é armazenada somente como hash (argon2id ou bcrypt com custo ≥ 12). |
| RN-AUTH-03 | `name` tem de 2 a 80 caracteres após trim. |
| RN-AUTH-04 | O JWT expira em 24 horas e carrega `sub` (id do usuário) e `email`. |
| RN-AUTH-05 | Credenciais inválidas retornam sempre a mesma mensagem genérica, sem revelar se o e-mail existe. |
| RN-AUTH-06 | A resposta nunca inclui `passwordHash`. |

## Critérios de aceite

### AC-AUTH-01 — Cadastro com sucesso
- **Dado** que não existe usuário com `ana@example.com`
- **Quando** envio `POST /auth/register` com nome, e-mail e senha de 8+ caracteres
- **Então** recebo `201` com `id`, `name` e `email`, sem senha ou hash.

### AC-AUTH-02 — E-mail duplicado
- **Dado** que `ana@example.com` já existe
- **Quando** tento cadastrar `ANA@example.com`
- **Então** recebo `409` com código `EMAIL_ALREADY_IN_USE`.

### AC-AUTH-03 — Validação de entrada
- **Quando** envio e-mail malformado, senha com menos de 8 caracteres ou nome vazio
- **Então** recebo `422` com código `VALIDATION_ERROR` e a lista de campos inválidos.

### AC-AUTH-04 — Login com sucesso
- **Dado** um usuário cadastrado
- **Quando** envio `POST /auth/login` com as credenciais corretas
- **Então** recebo `200` com `accessToken` (JWT) e os dados do usuário.

### AC-AUTH-05 — Login inválido
- **Quando** envio senha errada ou e-mail inexistente
- **Então** recebo `401` com código `INVALID_CREDENTIALS` e a mesma mensagem nos dois casos.

### AC-AUTH-06 — Rota protegida
- **Quando** chamo qualquer rota protegida sem token, com token expirado ou adulterado
- **Então** recebo `401` com código `UNAUTHORIZED`.

### AC-AUTH-07 — Vínculo de participantes pendentes
- **Dado** um grupo com participante convidado de e-mail `bia@example.com`
- **Quando** Bia se cadastra com esse e-mail
- **Então** o participante passa a apontar para o usuário dela e o grupo aparece na lista dela.

### AC-AUTH-08 — Sessão na interface
- **Quando** faço login pela interface
- **Então** o token é guardado em cookie `httpOnly` e nunca fica acessível por JavaScript do navegador.
- **E** ao clicar em "Sair" o cookie é removido e sou levado ao login.
