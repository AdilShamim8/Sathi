"""Demo bundle generator: precomputes API envelopes for all 5 personas.

Enables offline operation and airplane mode testing in the mobile app.
Uses the EXACT same service layer as the online FastAPI endpoints.
Output: web/public/demo/{persona}.json and web/public/demo/users.json
(the Next.js app's offline demo bundles).
"""
from __future__ import annotations

import datetime as dt
import json
from pathlib import Path

import sathi_config
from api.config import get_settings
from api.db import connect, init_db, path_from_url
from api.repositories import transactions as tx_repo
from api.repositories import users as users_repo
from api.services.cashout_service import get_cashout_insights
from api.services.convert import row_to_txn
from api.services.evidence import as_of_date, build_evidence
from api.services.forecast_service import get_forecast
from api.services.goal_service import create_goal_plan
from api.services.summary_service import get_summary
from core.categorizer import categorize
from core.formatting import format_taka
from ml.inference import load_latest_version

BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "data"
OUTPUT_DIR = BASE_DIR / "web" / "public" / "demo"


def generate_bundle() -> None:
    settings = get_settings()
    cfg = sathi_config.load_config()
    db_path = path_from_url(settings.database_url)
    init_db(db_path, DATA_DIR)
    conn = connect(db_path)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    demo_users = users_repo.demo_users(conn)
    forecast_v = load_latest_version()
    personas_cfg = cfg.section("personas")
    labels = cfg.section("categories")
    cat_labels = labels.get("categories", labels)
    as_of = as_of_date(cfg)

    users_manifest = []

    for u in demo_users:
        user_id = u["user_id"]
        persona = u["persona"]
        p_cfg = personas_cfg.get(persona, {})
        u_full = users_repo.get_user(conn, user_id) or {}

        manifest_item = {
            "user_id": user_id,
            "persona": persona,
            "persona_label_bn": p_cfg.get("label_bn", persona),
            "persona_label_en": p_cfg.get("label_en", persona),
            "age_band": u_full.get("age_band", "unknown"),
            "region": u_full.get("region", "unknown"),
            "income_band": u_full.get("income_band", "unknown"),
        }
        users_manifest.append(manifest_item)

        # 1. Summary
        summary_data, summary_ev = get_summary(conn, cfg, forecast_v, user_id)

        # 2. Transactions
        rows, total = tx_repo.list_page(conn, user_id, page=1, page_size=20)
        items = []
        for r in rows:
            t = row_to_txn(r)
            cat_res = categorize(t)
            cat_key = cat_res.category.value
            cat_label = cat_labels.get(cat_key, {})
            items.append({
                "txn_id": t.txn_id,
                "ts": t.ts.isoformat(),
                "type": t.type.value,
                "direction": "in" if t.is_inflow else "out",
                "amount_paisa": t.amount_paisa,
                "amount_display": format_taka(t.amount_paisa, "bn"),
                "fee_paisa": t.fee_paisa,
                "fee_display": format_taka(t.fee_paisa, "bn"),
                "counterparty": {
                    "id": t.counterparty_id,
                    "type": t.counterparty_type,
                    "category": t.counterparty_category,
                    "accepts_digital": t.counterparty_accepts_digital,
                },
                "category": {
                    "category": cat_key,
                    "label_bn": cat_label.get("label_bn", cat_key),
                    "label_en": cat_label.get("label_en", cat_key),
                    "rule_id": cat_res.rule_id,
                    "reason_bn": cat_res.reason_bn,
                    "reason_en": cat_res.reason_en,
                },
                "balance_after_paisa": t.balance_after_paisa,
                "balance_after_display": format_taka(t.balance_after_paisa, "bn"),
            })
        tx_data = {
            "items": items,
            "page": 1,
            "page_size": 20,
            "total": total,
            "as_of_date": as_of.isoformat(),
        }
        tx_ev = build_evidence(cfg, total, {"transactions": "Data"}, forecast_v)

        # 3. Forecast
        fc_data, fc_ev = get_forecast(conn, cfg, user_id)

        # 4. Cashout
        co_data, co_ev = get_cashout_insights(conn, cfg, user_id)

        # 5. Preset Goal Plan (emergency fund: 10,000 taka in 6 months)
        gp_data, gp_ev = create_goal_plan(conn, cfg, user_id, "emergency_fund", 1000000, 6)

        # 6. Raw engine input: the transaction series itself (last 120 days,
        # minimal fields) so the offline page can run the deterministic
        # engines locally — recurring detection, bootstrap path simulation,
        # safe-to-spend and shortfall explanation without any network.
        cutoff_dt = as_of - dt.timedelta(days=120)
        cutoff = cutoff_dt.isoformat()
        eng_rows = conn.execute(
            "SELECT ts, type, amount_paisa, fee_paisa, counterparty_id, "
            "counterparty_category, counterparty_accepts_digital, balance_after_paisa "
            "FROM transactions WHERE user_id = ? AND ts >= ? ORDER BY ts",
            (user_id, cutoff),
        ).fetchall()
        engine_txns = [
            {
                "ts": r["ts"],
                "type": r["type"],
                "amount_paisa": r["amount_paisa"],
                "fee_paisa": r["fee_paisa"],
                "counterparty_id": r["counterparty_id"],
                "counterparty_category": r["counterparty_category"],
                "accepts_digital": bool(r["counterparty_accepts_digital"]),
            }
            for r in eng_rows
        ]

        # Wallet balance just BEFORE the first engine txn = first balance_after
        # reversed by that txn's net effect (fee included for outflows).
        opening_paisa = 0
        if eng_rows:
            first = eng_rows[0]
            signed = first["amount_paisa"] + first["fee_paisa"] \
                if first["type"] not in ("cash_in", "salary_in", "remittance_in") \
                else -first["amount_paisa"]
            opening_paisa = int(first["balance_after_paisa"]) + signed

        bundle = {
            "user": manifest_item,
            "summary": {"data": summary_data.model_dump(), "evidence": summary_ev.model_dump()},
            "transactions": {"data": tx_data, "evidence": tx_ev.model_dump()},
            "forecast": {"data": fc_data.model_dump(), "evidence": fc_ev.model_dump()},
            "cashout": {"data": co_data.model_dump(), "evidence": co_ev.model_dump()},
            "goal_plan": {"data": gp_data.model_dump(), "evidence": gp_ev.model_dump()},
            "engine": {
                "as_of_date": as_of.isoformat(),
                "opening_balance_paisa": opening_paisa,
                "transactions": engine_txns,
            },
        }

        persona_file = OUTPUT_DIR / f"{persona}.json"
        persona_file.write_text(json.dumps(bundle, ensure_ascii=False, indent=2), encoding="utf-8")

    manifest_file = OUTPUT_DIR / "users.json"
    manifest_file.write_text(json.dumps(users_manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    from ml.benchmark import load_benchmark_metrics
    benchmark_file = OUTPUT_DIR / "benchmark.json"
    benchmark_file.write_text(json.dumps(load_benchmark_metrics(), ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Demo bundle generated successfully in {OUTPUT_DIR} for {len(demo_users)} personas.")


if __name__ == "__main__":
    generate_bundle()
