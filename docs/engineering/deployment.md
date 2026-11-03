# Deploy (produção)

Decisão do responsável pelo projeto: tudo roda em uma única VM (Oracle Cloud) com Docker Compose, em vez de Vercel/Render. Isso substitui a proposta original da seção 10 do plano.

## Topologia

`docker-compose.prod.yml` (projeto `splitandgo`):

| Serviço | Papel | Portas no host |
|---|---|---|
| `nginx` | Proxy reverso, TLS, redireciona HTTP para HTTPS | **80 e 443 (únicas)** |
| `web` | Next.js (BFF); alcança a API pela rede interna (`API_URL=http://api:3001`) | nenhuma |
| `api` | NestJS; executa `prisma migrate deploy` antes de subir | nenhuma |
| `postgres` | PostgreSQL 17, volume `postgres-data` | nenhuma |
| `certbot` | Renovação automática do Let's Encrypt (HTTP-01, webroot, a cada 12 h) | nenhuma |

Somente o `web` é exposto: a API não é pública (o navegador só fala com os Route Handlers do web). O nginx sobrescreve `X-Forwarded-Host`, por isso `WEB_TRUST_FORWARDED_HOST=1`. O cookie `sg_session` sai com `Secure` porque `NODE_ENV=production` e o acesso é por HTTPS. `CORS_ORIGIN=https://$DOMAIN`.

## Por que build no servidor

O repositório é público e o servidor tem CPU/RAM de sobra; `git pull` + `docker compose build` evita registry. O CI/CD não guarda credenciais do servidor além da chave restrita descrita em "Deploy contínuo (CD)".

## Segredos

`.env` fica só no servidor (não versionado, modo 600). Na primeira execução o `deploy/deploy.sh` o gera com `openssl rand` (`POSTGRES_PASSWORD`, `JWT_SECRET`) sem imprimir os valores. Modelo: `.env.production.example`.

## Primeiro deploy

```bash
git clone https://github.com/iguinn13/split-and-go-case.git ~/opt/splitandgo/app
cd ~/opt/splitandgo/app
DOMAIN=splitandgo.duckdns.org LETSENCRYPT_EMAIL=voce@exemplo.com deploy/deploy.sh main
```

O script: atualiza o código, gera `.env` se faltar, faz o build, emite o certificado (standalone na porta 80, só na primeira vez), sobe a stack com `--wait` (migrations rodam no start da API) e valida o HTTPS.

## Deploy contínuo (CD)

O workflow `.github/workflows/cd.yml` publica sozinho: quando o workflow **CI** termina com sucesso em um `push` na `main`, o job `Deploy to production` (ambiente `production`) conecta por SSH e implanta o commit exato testado pelo CI, depois confere `https://splitandgo.duckdns.org/login`. Deploys não se sobrepõem (`concurrency`), e o `deploy/ci-deploy.sh` usa `flock` no servidor.

**Chave restrita.** A chave do CI não dá shell. No `~/.ssh/authorized_keys` do servidor ela está presa a um único comando:

```
restrict,command="/home/ubuntu/opt/splitandgo/app/deploy/ci-deploy.sh" ssh-ed25519 AAAA... splitandgo-ci
```

O script só aceita um SHA de 40 caracteres hexadecimais (recebido em `SSH_ORIGINAL_COMMAND`) e roda `deploy/deploy.sh <sha>`. Uma chave vazada, portanto, só consegue implantar commits do próprio repositório.

**Segredos do ambiente `production`** (GitHub → Settings → Environments): `DEPLOY_SSH_KEY` (chave privada da chave restrita), `DEPLOY_HOST`, `DEPLOY_USER` e `DEPLOY_KNOWN_HOSTS` (saída de `ssh-keyscan`; o host é verificado com `StrictHostKeyChecking=yes`).

**Rollback pelo GitHub.** Em Actions → CD → Run workflow, informe o SHA completo de uma versão anterior. Migrations só andam para frente (veja "Rollback").

**Rotação da chave.** Gere um novo par, troque a linha no `authorized_keys` e atualize `DEPLOY_SSH_KEY`.

## Novo release manual

```bash
ssh ubuntu@<servidor> 'cd ~/opt/splitandgo/app && deploy/deploy.sh main'
```

## Rollback

O SHA anterior fica em `.previous-release`. Para voltar o código:

```bash
deploy/deploy.sh "$(cat .previous-release)"
```

Migrations só andam para frente. Se a release revertida precisar do esquema antigo, restaure o backup (abaixo) antes de subir.

## Backup

`deploy/backup.sh` faz `pg_dump | gzip` em `~/opt/splitandgo/backups` e mantém 7 dias; agendado por cron diário às 03:00. Restaurar:

```bash
gunzip -c backups/splitgo-AAAA-MM-DD.sql.gz | docker compose -f docker-compose.prod.yml exec -T postgres psql -U splitgo splitgo
```

## Operação

- Logs: `docker compose -f docker-compose.prod.yml logs -f api web nginx`.
- Estado: `docker compose -f docker-compose.prod.yml ps`.
