#!/usr/bin/env bash
# Daily pg_dump, keeps the last 7 days. Cron example (host):
#   0 3 * * * /home/ubuntu/opt/splitandgo/app/deploy/backup.sh >> /home/ubuntu/opt/splitandgo/backups/backup.log 2>&1
set -euo pipefail
cd "$(dirname "$0")/.."
BACKUP_DIR="${BACKUP_DIR:-$PWD/../backups}"
mkdir -p "$BACKUP_DIR"
set -a; . ./.env; set +a
OUT="$BACKUP_DIR/splitgo-$(date +%F).sql.gz"
docker compose -f docker-compose.prod.yml exec -T postgres \
    pg_dump -U "${POSTGRES_USER:-splitgo}" "${POSTGRES_DB:-splitgo}" | gzip > "$OUT.tmp"
mv "$OUT.tmp" "$OUT"
find "$BACKUP_DIR" -name 'splitgo-*.sql.gz' -mtime +7 -delete
echo "$(date -Is) backup ok: $OUT"
