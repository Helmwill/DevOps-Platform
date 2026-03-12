#!/usr/bin/env bash
# =============================================================================
# smoke.sh — Story 6.2 Smoke Test Suite
#
# Verifies the deployed dashboard is healthy and all key API endpoints
# respond correctly.  Runs as the final step of the production deployment.
#
# Usage:
#   scripts/smoke.sh <BASE_URL> [CREDENTIALS]
#
#   BASE_URL     — Required. Base URL of the deployed dashboard
#                  e.g. https://dashboard.example.com
#   CREDENTIALS  — Optional. Plain-text user:password for basic auth
#                  e.g. admin:secret
#
# Exit codes:
#   0  — all checks passed
#   1  — one or more checks failed (triggers rollback in deploy-prod.yml)
# =============================================================================

set -euo pipefail

BASE_URL="${1:?Usage: smoke.sh <BASE_URL> [CREDENTIALS]}"
CREDENTIALS="${2:-}"

CURL_BASE=(curl --silent --fail-with-body --max-time 15 --retry 3 --retry-delay 5)

if [[ -n "$CREDENTIALS" ]]; then
  CURL_BASE+=(--user "$CREDENTIALS")
fi

pass() { echo "  PASS: $1"; }
fail() { echo "  FAIL: $1"; exit 1; }

echo "=============================================="
echo "Smoke test suite"
echo "Target  : $BASE_URL"
echo "Auth    : ${CREDENTIALS:+enabled (credentials provided)}"
echo "Started : $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "=============================================="

# ------------------------------------------------------------------------------
# 1. GET /health — liveness probe
#    Expected: HTTP 200, body contains {"status":"ok"}
# ------------------------------------------------------------------------------
echo ""
echo "1/4  GET /health"
HEALTH_BODY=$("${CURL_BASE[@]}" --write-out "\n%{http_code}" "$BASE_URL/health") || \
  fail "/health did not respond within timeout"

HTTP_CODE=$(echo "$HEALTH_BODY" | tail -1)
BODY=$(echo "$HEALTH_BODY" | head -1)

[[ "$HTTP_CODE" == "200" ]] || fail "/health returned HTTP $HTTP_CODE (expected 200)"
echo "$BODY" | grep -q '"ok"' || fail "/health body missing status:ok — got: $BODY"
pass "/health → HTTP $HTTP_CODE, status:ok"

# ------------------------------------------------------------------------------
# 2. GET /api/containers — container list
#    Expected: HTTP 200, valid JSON array
# ------------------------------------------------------------------------------
echo ""
echo "2/4  GET /api/containers"
CONTAINERS_BODY=$("${CURL_BASE[@]}" --write-out "\n%{http_code}" "$BASE_URL/api/containers") || \
  fail "/api/containers did not respond within timeout"

HTTP_CODE=$(echo "$CONTAINERS_BODY" | tail -1)
BODY=$(echo "$CONTAINERS_BODY" | head -1)

[[ "$HTTP_CODE" == "200" ]] || fail "/api/containers returned HTTP $HTTP_CODE (expected 200)"
# Verify the body is a JSON array (starts with '[')
echo "$BODY" | grep -qE '^\s*\[' || fail "/api/containers did not return a JSON array — got: $BODY"
pass "/api/containers → HTTP $HTTP_CODE, JSON array"

# ------------------------------------------------------------------------------
# 3. GET /api/stats — server metrics
#    Expected: HTTP 200, valid JSON object
# ------------------------------------------------------------------------------
echo ""
echo "3/4  GET /api/stats"
STATS_BODY=$("${CURL_BASE[@]}" --write-out "\n%{http_code}" "$BASE_URL/api/stats") || \
  fail "/api/stats did not respond within timeout"

HTTP_CODE=$(echo "$STATS_BODY" | tail -1)
BODY=$(echo "$STATS_BODY" | head -1)

[[ "$HTTP_CODE" == "200" ]] || fail "/api/stats returned HTTP $HTTP_CODE (expected 200)"
echo "$BODY" | grep -qE '^\s*\{' || fail "/api/stats did not return a JSON object — got: $BODY"
pass "/api/stats → HTTP $HTTP_CODE, JSON object"

# ------------------------------------------------------------------------------
# 4. GET / — frontend SPA
#    Expected: HTTP 200 (or 401 when auth required), non-empty HTML body
# ------------------------------------------------------------------------------
echo ""
echo "4/4  GET / (frontend)"
FRONTEND_BODY=$(curl --silent --max-time 15 --retry 3 --retry-delay 5 \
  ${CREDENTIALS:+--user "$CREDENTIALS"} \
  --write-out "\n%{http_code}" "$BASE_URL/") || \
  fail "/ did not respond within timeout"

HTTP_CODE=$(echo "$FRONTEND_BODY" | tail -1)
BODY=$(echo "$FRONTEND_BODY" | head -1)

# 200 = authenticated and serving HTML; 401 = auth gate active (still healthy)
[[ "$HTTP_CODE" == "200" || "$HTTP_CODE" == "401" ]] || \
  fail "/ returned HTTP $HTTP_CODE (expected 200 or 401)"
[[ -n "$BODY" ]] || fail "/ returned an empty body"
pass "/ → HTTP $HTTP_CODE, non-empty body"

# ------------------------------------------------------------------------------
# Summary
# ------------------------------------------------------------------------------
echo ""
echo "=============================================="
echo "All smoke tests passed."
echo "Completed: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "=============================================="
