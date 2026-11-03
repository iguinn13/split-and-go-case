#!/usr/bin/env bash
# Deploys Split&Go on the host where it runs (build on the server).
# Usage: deploy/deploy.sh [git-ref]      (default: main; pass a previous SHA to roll back)
# First run: DOMAIN=your.domain LETSENCRYPT_EMAIL=you@mail deploy/deploy.sh
set -euo pipefail

REF="${1:-main}"
cd "$(dirname "$0")/.."
COMPOSE=(docker compose -f docker-compose.prod.yml)

PREVIOUS="$(git rev-parse HEAD)"
git fetch --quiet origin
git checkout --quiet --detach "$(git rev-parse --verify --quiet "origin/$REF" || git rev-parse "$REF")"
echo "Deploying $(git rev-parse --short HEAD) (was ${PREVIOUS:0:7})"

if [ ! -f .env ]; then
    : "${DOMAIN:?first run needs DOMAIN}" "${LETSENCRYPT_EMAIL:?first run needs LETSENCRYPT_EMAIL}"
    umask 077
    cat > .env <<ENV
DOMAIN=$DOMAIN
LETSENCRYPT_EMAIL=$LETSENCRYPT_EMAIL
POSTGRES_USER=splitgo
POSTGRES_DB=splitgo
POSTGRES_PASSWORD=$(openssl rand -hex 24)
JWT_SECRET=$(openssl rand -hex 48)
FX_PROVIDER_URL=https://api.frankfurter.dev/v1
ENV
    echo "Generated .env with new secrets (not printed)."
fi
set -a; . ./.env; set +a

"${COMPOSE[@]}" build

# First release only: obtain the certificate before nginx (needs port 80 free).
if ! "${COMPOSE[@]}" run --rm --no-deps --entrypoint sh certbot -c "test -f /etc/letsencrypt/live/$DOMAIN/fullchain.pem"; then
    "${COMPOSE[@]}" run --rm --no-deps -p 80:80 --entrypoint certbot certbot certonly --standalone \
        -d "$DOMAIN" --email "$LETSENCRYPT_EMAIL" --agree-tos --no-eff-email --non-interactive
fi

# The api container runs `prisma migrate deploy` before starting; --wait blocks until healthy.
"${COMPOSE[@]}" up -d --remove-orphans --wait
"${COMPOSE[@]}" exec -T nginx nginx -s reload
[ "$PREVIOUS" = "$(git rev-parse HEAD)" ] || echo "$PREVIOUS" > .previous-release
curl -fsS "https://$DOMAIN/login" -o /dev/null && echo "OK: https://$DOMAIN"
