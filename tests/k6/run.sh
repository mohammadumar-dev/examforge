#!/usr/bin/env bash
# Usage: bash tests/k6/run.sh [smoke|load|stress|spike]
set -e

SCENARIO="${1:-smoke}"
EXAM_SLUG="${EXAM_SLUG:-load-test-exam}"
BASE_URL="${BASE_URL:-http://localhost:3000}"

echo "════════════════════════════════════════════"
echo " HI Tech Examination Load Test"
echo " Scenario : $SCENARIO"
echo " Target   : $BASE_URL"
echo " Exam     : $EXAM_SLUG"
echo "════════════════════════════════════════════"

# 1. Start infrastructure if not already running
echo "[1/4] Starting infra (postgres, pgbouncer, redis)..."
docker compose -f docker/load-test/docker-compose.yml up -d postgres pgbouncer redis
echo "      Waiting for postgres to be healthy..."
until docker exec ef_postgres pg_isready -U examforge_user -d examforge &>/dev/null; do sleep 1; done

# 2. Run Prisma migrations
echo "[2/4] Running migrations..."
DATABASE_URL="postgresql://examforge_user:examforge_pass@127.0.0.1:5432/examforge" \
  npx prisma migrate deploy

# 3. Seed test exam
echo "[3/4] Seeding test exam..."
DATABASE_URL="postgresql://examforge_user:examforge_pass@127.0.0.1:5432/examforge" \
  EXAM_SLUG="$EXAM_SLUG" \
  WHATSAPP_ENABLED="false" \
  npx tsx tests/k6/seed.ts

# 4. Start the app (connect via PgBouncer port 6432)
echo "[4/4] Make sure the app is running at $BASE_URL"
echo "      DATABASE_URL should point to pgbouncer: postgresql://examforge_user:examforge_pass@127.0.0.1:6432/examforge"
echo ""
read -p "Press Enter once the app is running..."

# 5. Run k6
mkdir -p tests/k6/results
echo "Running k6 ($SCENARIO)..."
k6 run \
  --env BASE_URL="$BASE_URL" \
  --env EXAM_SLUG="$EXAM_SLUG" \
  --env SCENARIO="$SCENARIO" \
  --out json="tests/k6/results/${SCENARIO}-$(date +%Y%m%d-%H%M%S).json" \
  tests/k6/exam-flow.js

echo "Done. Results saved to tests/k6/results/"
