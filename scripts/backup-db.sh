#!/bin/bash
# Exports the production D1 database (articles + settings) to a timestamped
# .sql file under backups/, commits it, and pushes to GitHub.
#
# Run manually with: ./scripts/backup-db.sh
# Also run on a schedule (see the project's scheduled cloud agent).

set -euo pipefail
cd "$(dirname "$0")/.."

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
OUT="backups/matthewrkenney-articles-$TIMESTAMP.sql"

mkdir -p backups
npx wrangler d1 export matthewrkenney-articles --remote --output "$OUT"

# Keep the last 30 backups on disk/in git; older ones are still recoverable
# from git history if ever needed, just not kept as live files.
ls -1t backups/matthewrkenney-articles-*.sql | tail -n +31 | xargs -r rm --

git add backups/
if git diff --cached --quiet; then
  echo "No changes to back up (database identical to last snapshot)."
  exit 0
fi

git commit -m "Automated D1 backup: $TIMESTAMP"
git push origin main
echo "Backup committed and pushed: $OUT"
