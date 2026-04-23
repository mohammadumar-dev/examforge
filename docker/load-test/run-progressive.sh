#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# HI Tech Examination — Progressive Load Test: 100 → 500 → 2000 VUs
# Usage: bash docker/load-test/run-progressive.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

EXAM_SLUG="load-test-exam"
COMPOSE="docker compose -f docker/load-test/docker-compose.yml"

cd "$(git rev-parse --show-toplevel)"
mkdir -p tests/k6/results
chmod 777 tests/k6/results

run_k6() {
  local scenario="$1"
  local label="$2"

  echo ""
  echo "══════════════════════════════════════════════════════════"
  echo "  k6 scenario: ${label}"
  echo "══════════════════════════════════════════════════════════"

  $COMPOSE --profile k6 run --rm \
    -e BASE_URL=http://localhost:3000 \
    -e EXAM_SLUG="$EXAM_SLUG" \
    -e SCENARIO="$scenario" \
    k6 2>&1 | tee "tests/k6/results/${scenario}.log"

  local exit_code=${PIPESTATUS[0]}
  if [ "$exit_code" -eq 0 ]; then
    echo "✔ ${label} passed all thresholds."
  else
    echo "✖ ${label} FAILED (exit $exit_code) — check tests/k6/results/${scenario}.log"
    echo "  Aborting progressive test."
    exit "$exit_code"
  fi
}

# ── Ensure stack is up ────────────────────────────────────────────────────────
echo "▶ Starting containers..."
$COMPOSE up -d postgres pgbouncer redis app

echo ""
echo "▶ Waiting for app to be healthy..."
RETRIES=30
until $COMPOSE exec -T app wget -qO- http://localhost:3000/api/health >/dev/null 2>&1; do
  RETRIES=$((RETRIES - 1))
  [ "$RETRIES" -le 0 ] && echo "✖ App not healthy." && exit 1
  echo "  waiting... ($RETRIES left)"
done
echo "✔ App healthy."

# ── Seed ──────────────────────────────────────────────────────────────────────
echo ""
echo "▶ Seeding database..."
DATABASE_URL="postgresql://examforge_user:examforge_pass@localhost:5434/examforge" \
EXAM_SLUG="$EXAM_SLUG" \
SEED_ADMIN_EMAIL="admin@loadtest.local" \
SEED_ADMIN_PASSWORD="ChangeMe@123" \
  npx tsx tests/k6/seed.ts
echo "✔ Database seeded."

# ── Progressive runs ─────────────────────────────────────────────────────────
run_k6 "100"  "100 VU  (12 min)"
run_k6 "500"  "500 VU  (15 min)"
run_k6 "2k"   "2000 VU (31 min)"

echo ""
echo "══════════════════════════════════════════════════════════"
echo "  All three scenarios passed!"
echo "  Logs: tests/k6/results/{100,500,2k}.log"
echo "══════════════════════════════════════════════════════════"
echo ""
echo "To stop all containers:"
echo "  docker compose -f docker/load-test/docker-compose.yml down -v"
