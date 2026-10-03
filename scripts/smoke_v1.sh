#!/usr/bin/env bash
# Smoke-test every v1 + main API endpoint; verify the model is live.
set -u
BASE="http://localhost:3000"
fail=0

# main app routes
for r in /api/boot /api/summary /api/transactions /api/spending /api/forecast \
         /api/goals /api/insights /api/metrics /api/salary; do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 60 "$BASE$r")
  echo "MAIN $r -> $code"
  [ "$code" = "200" ] || fail=1
done

# v1 public routes
for r in /api/v1/healthz /api/v1/demo-users /api/v1/meta/model-card; do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 60 "$BASE$r")
  echo "V1   $r -> $code"
  [ "$code" = "200" ] || fail=1
done

# v1 authenticated routes (demo-login for the hero persona)
TOKEN=$(curl -s --max-time 60 -X POST "$BASE/api/v1/auth/demo-login" \
  -H "Content-Type: application/json" -d '{"user_id":"garment_worker"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])" 2>/dev/null)
if [ -z "${TOKEN:-}" ]; then echo "demo-login FAILED"; exit 1; fi
echo "V1   /api/v1/auth/demo-login -> token OK"

for r in /api/v1/me/summary /api/v1/me/transactions /api/v1/me/forecast \
         /api/v1/me/cashout-insights /api/v1/me/benchmark; do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 120 -H "Authorization: Bearer $TOKEN" "$BASE$r")
  echo "V1   $r -> $code"
  [ "$code" = "200" ] || fail=1
done

# goal-plan POST (Monte Carlo options)
code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 120 -H "Authorization: Bearer $TOKEN" \
  -X POST "$BASE/api/v1/me/goal-plan" -H "Content-Type: application/json" \
  -d '{"goal_type":"emergency_fund","target_paisa":500000,"months":6}')
echo "V1   POST /api/v1/me/goal-plan -> $code"
[ "$code" = "200" ] || fail=1

# main app parse POST (NL capture)
code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 60 -X POST "$BASE/api/parse" \
  -H "Content-Type: application/json" -d '{"text":"chai 30 taka"}')
echo "MAIN POST /api/parse -> $code"
[ "$code" = "200" ] || fail=1

# goals POST + parse-amount + chat
code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 60 -H "Authorization: Bearer $TOKEN" \
  -X POST "$BASE/api/v1/me/goals" -H "Content-Type: application/json" \
  -d '{"goal_type":"emergency_fund","target_paisa":500000,"monthly_paisa":50000}')
echo "V1   POST /api/v1/me/goals -> $code"
[ "$code" = "200" ] || [ "$code" = "201" ] || fail=1

code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 60 -X POST "$BASE/api/v1/parse-amount" \
  -H "Content-Type: application/json" -d '{"text":"৫০০ টাকা"}')
echo "V1   POST /api/v1/parse-amount -> $code"
[ "$code" = "200" ] || fail=1

# model verification: summary must report method=model + shortfall_prob
curl -s --max-time 120 -H "Authorization: Bearer $TOKEN" "$BASE/api/v1/me/summary" | python3 -c "
import sys, json
d = json.load(sys.stdin)['data']
s = d['safe_to_spend']
print('MODEL summary: method=%s shortfall_prob=%s model=%s rule_s2s=%s model_s2s=%s status=%s window=%sd' % (
    s.get('method'), s.get('shortfall_prob'), s.get('model_version'),
    s.get('rule_safe_to_spend_paisa'), s.get('safe_to_spend_total_paisa'), s.get('status'), s.get('horizon_days')))
assert s.get('method') == 'model', 'MODEL NOT LIVE'
assert s.get('shortfall_prob') is not None
assert s.get('model_version') == 'fc-2026-09-30-15d8427d'
"
[ $? -ne 0 ] && fail=1

# forecast must be model-driven with quantile days
curl -s --max-time 120 -H "Authorization: Bearer $TOKEN" "$BASE/api/v1/me/forecast" | python3 -c "
import sys, json
d = json.load(sys.stdin)['data']
print('MODEL forecast: p=%s trough=%s method=%s model=%s days=%d first_day_p50=%s' % (
    round(d['shortfall_prob'],3), d['trough_date'], d['method'][:40], d['model_version'], len(d['days']), d['days'][0]['p50_display']))
assert 'lightgbm' in d['method']
assert d['model_version'] == 'fc-2026-09-30-15d8427d'
assert len(d['days']) == 21
"
[ $? -ne 0 ] && fail=1

# benchmark must carry the generated evaluation tables
curl -s --max-time 60 -H "Authorization: Bearer $TOKEN" "$BASE/api/v1/me/benchmark" | python3 -c "
import sys, json
d = json.load(sys.stdin)['data']
ev = d['evaluation']
print('MODEL benchmark: brier=%s bss_vs_rule=%s T1rows=%d T7features=%d sim=%s' % (
    round(d['brier_score']['ml_model'],4), round(d['brier_score']['brier_skill_vs_rule'],3),
    len(ev['forecast_table_t1']), len(ev['explainability_shap_t7']['global']), d['simulated'][:30]))
assert d['brier_score']['ml_model'] < d['brier_score']['rule_baseline']
assert len(ev['forecast_table_t1']) >= 5
assert len(ev['explainability_shap_t7']['global']) >= 10
"
[ $? -ne 0 ] && fail=1

echo ""
if [ "$fail" = "0" ]; then echo "ALL ENDPOINTS OK — MODEL IS LIVE"; else echo "FAILURES DETECTED"; exit 1; fi
