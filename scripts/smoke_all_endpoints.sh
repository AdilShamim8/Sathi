#!/usr/bin/env bash
# Smoke-test all Sathi endpoints (product API + v1 API). Expects server on :3000.
set -uo pipefail
BASE=http://localhost:3000
PASS=0; FAIL=0
declare -a FAILED

check() { # name, expected_prefix, actual_code
  local name="$1" want="$2" got="$3"
  if [[ "$got" == "$want"* ]]; then PASS=$((PASS+1)); echo "  OK   $name -> $got";
  else FAIL=$((FAIL+1)); FAILED+=("$name -> $got (want $want)"); echo "  FAIL $name -> $got (want $want)"; fi
}

code() { curl -s -o /dev/null -w "%{http_code}" --max-time 30 "$@"; }
body() { curl -s --max-time 30 "$@"; }

echo "== PRODUCT API =="
check "GET  /api/boot" 200 "$(code $BASE/api/boot)"
check "GET  /api/summary" 200 "$(code $BASE/api/summary)"
check "GET  /api/transactions" 200 "$(code $BASE/api/transactions)"
check "POST /api/transactions (NL)" 200 "$(code -X POST $BASE/api/transactions -H 'Content-Type: application/json' -d '{"text":"আজকে রিকশা ভাড়া ৮০ টাকা"}')"
check "POST /api/parse" 200 "$(code -X POST $BASE/api/parse -H 'Content-Type: application/json' -d '{"text":"চাল ৫০০ টাকা"}')"
check "GET  /api/spending" 200 "$(code $BASE/api/spending)"
check "GET  /api/forecast" 200 "$(code $BASE/api/forecast)"
check "POST /api/forecast (action)" 200 "$(code -X POST $BASE/api/forecast -H 'Content-Type: application/json' -d '{"actionId":"cut_eating_out"}')"
check "GET  /api/goals" 200 "$(code $BASE/api/goals)"
GOAL_ID=$(body $BASE/api/goals | python3 -c 'import sys,json;g=json.load(sys.stdin);goals=g if isinstance(g,list) else (g.get("goals") or g.get("data") or []);print(goals[0]["id"] if goals else 1)' 2>/dev/null)
check "GET  /api/goals/analyze" 200 "$(code "$BASE/api/goals/analyze?goalId=$GOAL_ID")"
check "POST /api/goals/simulate" 200 "$(code -X POST $BASE/api/goals/simulate -H 'Content-Type: application/json' -d "{\"goalId\":$GOAL_ID,\"extraMonthlySavings\":1500}")"
check "GET  /api/insights" 200 "$(code $BASE/api/insights)"
check "POST /api/copilot" 200 "$(code -X POST $BASE/api/copilot -H 'Content-Type: application/json' -d '{"question":"How much can I safely spend?"}')"
check "GET  /api/salary" 200 "$(code $BASE/api/salary)"
check "GET  /api/metrics" 200 "$(code $BASE/api/metrics)"

echo "== V1 API =="
check "GET  /api/v1/healthz" 200 "$(code $BASE/api/v1/healthz)"
check "GET  /api/v1/demo-users" 200 "$(code $BASE/api/v1/demo-users)"

TOKEN=$(body -X POST $BASE/api/v1/auth/demo-login -H 'Content-Type: application/json' -d '{"user_id":"garment_worker"}' | python3 -c 'import sys,json;print(json.load(sys.stdin).get("token",""))' 2>/dev/null)
if [[ -n "$TOKEN" ]]; then PASS=$((PASS+1)); echo "  OK   POST /api/v1/auth/demo-login -> token acquired"
else FAIL=$((FAIL+1)); FAILED+=("demo-login token"); echo "  FAIL demo-login"; fi
AUTH="Authorization: Bearer $TOKEN"

check "POST /api/v1/parse-amount" 200 "$(code -X POST $BASE/api/v1/parse-amount -H 'Content-Type: application/json' -H "$AUTH" -d '{"text":"৫০০ টাকা রিচার্জ"}')"
check "GET  /api/v1/me/summary" 200 "$(code -H "$AUTH" $BASE/api/v1/me/summary)"
check "GET  /api/v1/me/transactions" 200 "$(code -H "$AUTH" $BASE/api/v1/me/transactions)"
check "GET  /api/v1/me/forecast" 200 "$(code -H "$AUTH" $BASE/api/v1/me/forecast)"
check "POST /api/v1/me/goal-plan" 200 "$(code -X POST -H "$AUTH" -H 'Content-Type: application/json' $BASE/api/v1/me/goal-plan -d '{"target_paisa":3000000,"months":6}')"
check "GET  /api/v1/me/goals" 200 "$(code -H "$AUTH" $BASE/api/v1/me/goals)"
check "GET  /api/v1/me/cashout-insights" 200 "$(code -H "$AUTH" $BASE/api/v1/me/cashout-insights)"
check "GET  /api/v1/me/benchmark" 200 "$(code -H "$AUTH" $BASE/api/v1/me/benchmark)"
check "GET  /api/v1/meta/model-card" 200 "$(code -H "$AUTH" $BASE/api/v1/meta/model-card)"
check "POST /api/v1/chat" 200 "$(code -X POST $BASE/api/v1/chat -H 'Content-Type: application/json' -H "$AUTH" -d '{"message":"আগামী সাত দিনে ঘাটতির ঝুঁকি কত?"}')"

echo "== SEMANTIC CHECKS =="
S=$(body -H "$AUTH" $BASE/api/v1/me/summary)
METHOD=$(echo "$S" | python3 -c 'import sys,json;print(json.load(sys.stdin)["data"]["safe_to_spend"]["method"])' 2>/dev/null)
if [[ "$METHOD" == "model" ]]; then PASS=$((PASS+1)); echo "  OK   summary safe_to_spend.method = model (ML live)"
else FAIL=$((FAIL+1)); FAILED+=("summary method=$METHOD"); echo "  FAIL summary method=$METHOD"; fi
F=$(body -H "$AUTH" $BASE/api/v1/me/forecast)
FMETHOD=$(echo "$F" | python3 -c 'import sys,json;print(json.load(sys.stdin)["data"].get("method","?"))' 2>/dev/null)
if [[ "$FMETHOD" == *"lightgbm"* ]]; then PASS=$((PASS+1)); echo "  OK   forecast method = $FMETHOD"
else FAIL=$((FAIL+1)); FAILED+=("forecast method=$FMETHOD"); echo "  FAIL forecast method=$FMETHOD"; fi
B=$(body -H "$AUTH" $BASE/api/v1/me/benchmark)
LABEL=$(echo "$B" | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d["data"]["brier_score"]["ml_model"] < d["data"]["brier_score"]["rule_baseline"])' 2>/dev/null)
if [[ "$LABEL" == "True" ]]; then PASS=$((PASS+1)); echo "  OK   benchmark: ML Brier < rule baseline"
else FAIL=$((FAIL+1)); FAILED+=("benchmark compare"); echo "  FAIL benchmark compare"; fi

echo
echo "RESULT: $PASS passed, $FAIL failed"
if [[ $FAIL -gt 0 ]]; then printf ' - %s\n' "${FAILED[@]}"; exit 1; fi
