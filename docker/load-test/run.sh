#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# HI Tech Examination — Full Docker Load Test Runner
# Usage: bash docker/load-test/run.sh [smoke|load|2k|stress|spike]
# Default scenario: 2k (2000 concurrent students)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCENARIO="${1:-2k}"
EXAM_SLUG="load-test-exam"
COMPOSE="docker compose -f docker/load-test/docker-compose.yml"

cd "$(git rev-parse --show-toplevel)"

echo "═══════════════════════════════════════════════════════"
echo "  HI Tech Examination Load Test  |  Scenario: ${SCENARIO}"
echo "═══════════════════════════════════════════════════════"

# ── Step 1: Build & start infrastructure + app ────────────────────────────
echo ""
echo "▶ Step 1/4  Building and starting containers..."
$COMPOSE up --build -d postgres pgbouncer redis app

# ── Step 2: Wait for app to be healthy ────────────────────────────────────
echo ""
echo "▶ Step 2/4  Waiting for app to become healthy (migrations run inside)..."
RETRIES=30
until $COMPOSE exec -T app wget -qO- http://localhost:3000/api/health > /dev/null 2>&1; do
  RETRIES=$((RETRIES - 1))
  if [ "$RETRIES" -le 0 ]; then
    echo "✖ App did not become healthy in time. Check logs:"
    echo "  docker compose -f docker/load-test/docker-compose.yml logs app"
    exit 1
  fi
  echo "  waiting... ($RETRIES retries left)"
  sleep 5
done
echo "✔ App is healthy."

# ── Step 3: Seed database ─────────────────────────────────────────────────
echo ""
echo "▶ Step 3/4  Seeding database (admin + ${EXAM_SLUG} exam)..."
DATABASE_URL="postgresql://examforge_user:examforge_pass@localhost:5434/examforge" \
EXAM_SLUG="$EXAM_SLUG" \
SEED_ADMIN_EMAIL="admin@loadtest.local" \
SEED_ADMIN_PASSWORD="ChangeMe@123" \
  npx tsx tests/k6/seed.ts

echo "✔ Database seeded."

# ── Step 4: Run k6 ───────────────────────────────────────────────────────
echo ""
echo "▶ Step 4/4  Running k6 scenario: ${SCENARIO} (2000 VUs)..."
mkdir -p tests/k6/results

BASE_URL="http://localhost:3000" \
EXAM_SLUG="$EXAM_SLUG" \
SCENARIO="$SCENARIO" \
  $COMPOSE --profile k6 run --rm \
    -e BASE_URL=http://localhost:3000 \
    -e EXAM_SLUG="$EXAM_SLUG" \
    -e SCENARIO="$SCENARIO" \
    k6

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  Done! Results saved to tests/k6/results/last-run.json"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "To stop all containers:"
echo "  docker compose -f docker/load-test/docker-compose.yml down -v"
