#!/usr/bin/env python3
"""Generate the Android offline fallback page (res/raw/offline.html).

Reads the committed demo persona bundles (web/public/demo/*.json) and injects
them into scripts/offline_template.html, producing a fully self-contained
page (data, styles and scripts inlined) that the WebView can render with zero
network access.

MainActivity replaces __REASON__ / __ATTEMPT__ at runtime; this generator
must leave those placeholders untouched.

Re-run whenever the demo bundles change:

    python3 scripts/gen_offline_page.py
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ORDER = ["student", "garment_worker", "gig_driver", "remittance_household", "shopkeeper"]
TEMPLATE = ROOT / "scripts" / "offline_template.html"
DEST = ROOT / "web" / "android" / "app" / "src" / "main" / "res" / "raw" / "offline.html"


def main() -> None:
    template = TEMPLATE.read_text(encoding="utf-8")
    for placeholder in ("__REASON__", "__ATTEMPT__", "__PERSONAS_JSON__"):
        assert placeholder in template, f"template lost placeholder {placeholder}"

    personas = []
    for name in ORDER:
        path = ROOT / "web" / "public" / "demo" / f"{name}.json"
        personas.append(json.loads(path.read_text(encoding="utf-8")))

    blob = json.dumps(personas, ensure_ascii=False, separators=(",", ":"))
    # Guard against the blob terminating the host <script> tag early.
    blob = blob.replace("</", "<\\/")

    out = template.replace("__PERSONAS_JSON__", blob)
    assert "__REASON__" in out and "__ATTEMPT__" in out, "runtime placeholders must survive"
    assert "__PERSONAS_JSON__" not in out

    DEST.parent.mkdir(parents=True, exist_ok=True)
    DEST.write_text(out, encoding="utf-8")
    print(f"wrote {DEST.relative_to(ROOT)} ({DEST.stat().st_size / 1024:.1f} KB, {len(personas)} personas)")


if __name__ == "__main__":
    main()
