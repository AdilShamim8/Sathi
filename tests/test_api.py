"""Comprehensive integration and unit test suite for Sathi FastAPI endpoints."""
from fastapi.testclient import TestClient
import pytest

from api.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="module")
def auth_headers(client):
    users_resp = client.get("/v1/demo-users")
    assert users_resp.status_code == 200
    users = users_resp.json()
    assert len(users) > 0
    first_user = users[0]["user_id"]

    login_resp = client.post("/v1/auth/demo-login", json={"user_id": first_user})
    assert login_resp.status_code == 200
    token = login_resp.json()["token"]
    return {"Authorization": f"Bearer {token}"}


def test_healthz_endpoint(client):
    resp = client.get("/healthz")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["self_check"]["database"] is True
    assert body["self_check"]["config_loaded"] is True


def test_demo_users_endpoint(client):
    resp = client.get("/v1/demo-users")
    assert resp.status_code == 200
    users = resp.json()
    assert len(users) == 5  # 5 personas
    personas = {u["persona"] for u in users}
    assert "garment_worker" in personas
    assert "gig_driver" in personas


def test_unauthenticated_request_fails(client):
    resp = client.get("/v1/me/summary")
    assert resp.status_code == 401
    err = resp.json()["error"]
    assert err["code"] == "UNAUTHENTICATED"


def test_summary_endpoint(client, auth_headers):
    resp = client.get("/v1/me/summary", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert "data" in body
    assert "evidence" in body
    data = body["data"]
    assert "balance_paisa" in data
    assert "balance_display" in data
    assert "safe_to_spend" in data
    assert "cash_on_hand" in data
    assert "recurring" in data
    assert "categories" in data
    assert "metrics" in data
    assert body["evidence"]["data_used"]["source"] == "synthetic"


def test_benchmark_endpoint(client, auth_headers):
    resp = client.get("/v1/me/benchmark", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert "brier_score" in body
    assert "quantile_loss" in body
    assert "early_warning_7d" in body


def test_transactions_endpoint(client, auth_headers):
    resp = client.get("/v1/me/transactions?page=1&page_size=10", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    data = body["data"]
    assert len(data["items"]) == 10
    first_txn = data["items"][0]
    assert "category" in first_txn
    assert "rule_id" in first_txn["category"]
    assert "amount_display" in first_txn


def test_forecast_endpoint(client, auth_headers):
    resp = client.get("/v1/me/forecast", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    data = body["data"]
    assert "shortfall_prob" in data
    assert "risk_level" in data
    assert len(data["days"]) > 0
    assert "p50_display" in data["days"][0]


def test_goal_plan_endpoint(client, auth_headers):
    req = {
        "goal_type": "emergency_fund",
        "target_paisa": 1000000,  # 10,000 taka
        "months": 6,
    }
    resp = client.post("/v1/me/goal-plan", json=req, headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    data = body["data"]
    assert data["target_paisa"] == 1000000
    assert len(data["options"]) > 0
    first_opt = data["options"][0]
    assert "p_goal_met" in first_opt
    assert "monthly_contribution_display" in first_opt


def test_cashout_insights_endpoint(client, auth_headers):
    resp = client.get("/v1/me/cashout-insights", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert "data" in body
    assert "patterns" in body["data"]
    assert "replaceable_fee_saved_paisa" in body["data"]


def test_goals_save_and_list(client, auth_headers):
    req = {
        "goal_type": "family_support",
        "target_paisa": 500000,
        "months": 4,
        "plan_option_key": "extend_timeline",
        "monthly_contribution_paisa": 125000,
    }
    save_resp = client.post("/v1/me/goals", json=req, headers=auth_headers)
    assert save_resp.status_code == 200
    saved = save_resp.json()
    assert saved["target_paisa"] == 500000
    assert saved["goal_id"] > 0

    list_resp = client.get("/v1/me/goals", headers=auth_headers)
    assert list_resp.status_code == 200
    goals = list_resp.json()["goals"]
    assert len(goals) > 0


def test_parse_amount_endpoint(client):
    resp = client.post("/v1/parse-amount", json={"text": "ত্রিশ হাজার টাকা"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["amount_paisa"] == 3000000
    assert "৩০,০০০" in data["amount_display"]

    resp_en = client.post("/v1/parse-amount", json={"text": "25k"})
    assert resp_en.status_code == 200
    assert resp_en.json()["amount_paisa"] == 2500000


def test_chat_endpoint(client, auth_headers):
    req = {
        "message": "সামনের সপ্তাহে কি টানাটানি হতে পারে?",
        "locale": "bn",
    }
    resp = client.post("/v1/chat", json=req, headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert "data" in body
    assert body["data"]["intent"] == "forecast"
    assert "reply" in body["data"]
    assert "evidence" in body


def test_model_card_endpoint(client):
    resp = client.get("/v1/meta/model-card")
    assert resp.status_code == 200
    card = resp.json()
    assert "LightGBM" in card["model"]
    assert "fairness_evaluation" in card


def test_inputs_get_defaults_and_auth(client, auth_headers):
    # Unauthenticated -> 401 (never a client-supplied user_id)
    assert client.get("/v1/me/inputs").status_code == 401
    resp = client.get("/v1/me/inputs", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert "cash_on_hand_paisa" in data and "income_day" in data
    assert "rent_confirmed" in data and "other_liquid_paisa" in data


def test_inputs_post_roundtrip_and_effect(client, auth_headers):
    resp = client.post("/v1/me/inputs", headers=auth_headers,
                       json={"cash_on_hand_taka": 2500, "income_day": 7,
                             "rent_confirmed": True, "other_liquid_taka": 1000})
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["cash_on_hand_paisa"] == 250000
    assert data["income_day"] == 7
    assert data["rent_confirmed"] is True
    assert data["other_liquid_paisa"] == 100000

    # The declared cash flows into the summary's liquidity basis.
    s = client.get("/v1/me/summary", headers=auth_headers).json()["data"]
    basis = s["liquidity_basis"]
    assert basis["cash_on_hand_paisa"] >= 0
    assert basis["other_liquid_paisa"] == 100000
    assert basis["cash_source"].startswith("user-declared")
    assert s["cash_on_hand"]["source"].startswith("user-declared")

    # Invalid payloads fail closed.
    assert client.post("/v1/me/inputs", headers=auth_headers,
                       json={"income_day": 99}).status_code == 400
    assert client.post("/v1/me/inputs", headers=auth_headers,
                       json={}).status_code == 400


def test_forecast_contract_fields(client, auth_headers):
    resp = client.get("/v1/me/forecast", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    # Mission contract: actionable output, not just a probability.
    assert "safe_to_spend_paisa" in data
    assert "daily_allowance_paisa" in data
    assert "liquidity_basis" in data
    assert "top_action" in data
    assert "shortfall_prob" in data
    basis = data["liquidity_basis"]
    for k in ("wallet_balance_paisa", "cash_on_hand_paisa", "other_liquid_paisa", "total_liquid_paisa"):
        assert k in basis


def test_actions_endpoint(client, auth_headers):
    assert client.get("/v1/me/actions").status_code == 401
    resp = client.get("/v1/me/actions", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert "actions" in data and "base_shortfall_prob" in data
    assert data["method"].startswith("counterfactual")
    for a in data["actions"]:
        assert a["delta_shortfall_prob"] <= 0.0001  # ranked: never worse than baseline
        assert 0.0 <= a["shortfall_prob_after"] <= 1.0
    ids = {a["action_id"] for a in data["actions"]}
    assert "buffer_payday" in ids  # the always-present candidate


def test_benchmark_requires_auth(client):
    assert client.get("/v1/me/benchmark").status_code == 401
