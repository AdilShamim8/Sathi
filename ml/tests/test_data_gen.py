"""Generator determinism: same seed + config => identical transactions."""
import json

from data_gen.generate import generate


def test_same_seed_same_hash(tmp_path):
    a = generate(n_users=10, n_drifted_per_persona=1, out_dir=tmp_path / "a")
    b = generate(n_users=10, n_drifted_per_persona=1, out_dir=tmp_path / "b")
    assert a["transactions_hash"] == b["transactions_hash"]
    meta = json.loads((tmp_path / "a" / "dataset_meta.json").read_text(encoding="utf-8"))
    assert meta["n_users"] == 10 and meta["n_drifted_users"] == 5
    assert (tmp_path / "a" / "cash_truth.parquet").exists()
