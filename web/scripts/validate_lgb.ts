/** Quick validation: TS LightGBM predictor vs Python fixture (run with bun).
 *  Reads the promoted model version from ml-artifacts/forecast/latest.json. */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseLgbModel, predictLgb } from "../src/lib/engine/lightgbm";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const version = JSON.parse(
  readFileSync(join(ROOT, "ml-artifacts/forecast/latest.json"), "utf8"),
).version as string;

const fx = JSON.parse(
  readFileSync(join(ROOT, "tests/fixtures/lgb-predictions.json"), "utf8"),
) as { models: Record<string, number[]>; rows: (number | null)[][] };

const rows = fx.rows.map((r) => r.map((v) => (v === null ? NaN : v)));
let worst = 0;
for (const [name, expected] of Object.entries(fx.models)) {
  const text = readFileSync(
    join(ROOT, "ml-artifacts/forecast", version, `model_${name}.txt`),
    "utf8",
  );
  const model = parseLgbModel(text);
  for (let i = 0; i < rows.length; i++) {
    const got = predictLgb(model, rows[i]!);
    if (!Number.isFinite(got)) {
      console.error(`NON-FINITE ${name} row ${i}: ts=${got} py=${expected[i]}`);
      process.exit(1);
    }
    const diff = Math.abs(got - expected[i]!);
    worst = Math.max(worst, diff);
    if (diff > 1e-9) {
      console.error(`MISMATCH ${name} row ${i}: ts=${got} py=${expected[i]}`);
      process.exit(1);
    }
  }
  console.log(`${name}: ${model.trees.length} trees, ${expected.length} rows OK`);
}
console.log(`ALL MATCH (worst abs diff ${worst.toExponential(2)})`);
