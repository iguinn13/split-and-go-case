# ADR 0003 — JWT guardado em cookie httpOnly emitido pelo Next.js

- **Status:** Aceita
- **Contexto:** A API usa JWT. Guardar o token em `localStorage` o expõe a roubo por XSS.
- **Decisão:**
  - A API é stateless e valida `Authorization: Bearer <jwt>` (expiração de 24h; segredo em `JWT_SECRET`).
  - O front-end (Next.js) chama `/auth/login` a partir de um **Route Handler**, grava o `accessToken` em cookie `httpOnly`, `SameSite=Lax` (e `Secure` em produção) e repassa o token à API nas chamadas feitas no servidor. O JavaScript do navegador nunca lê o token.
  - Um `middleware` do Next redireciona rotas protegidas sem cookie para `/login`.
- **Alternativas consideradas:**
  - `localStorage`: simples, porém vulnerável a XSS.
  - Cookie emitido diretamente pela API: exige configuração de CORS com credenciais e domínios compatíveis; mais frágil em hospedagens separadas.
  - Refresh token com rotação: mais seguro, porém fora do escopo do MVP (roadmap).
- **Consequências:**
  - Chamadas de dados feitas pelo servidor do Next (Server Components e Route Handlers) anexam o token; componentes de cliente usam Route Handlers como proxy.
  - Logout apaga o cookie.
  - Não há revogação de token antes da expiração no MVP.
