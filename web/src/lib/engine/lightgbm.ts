/**
 * LightGBM text-model predictor — runs the trained Sathi quantile boosters
 * (ml/artifacts/forecast/<version>/model_qXX.txt) inside this Next.js app,
 * so the product serves the SAME model version the Python pipeline trained
 * and evaluated (no train/serve skew, no Python dependency at runtime).
 *
 * Format (LightGBM `Booster.save_model`, version=v4):
 *   - a header block (max_feature_idx, objective, feature_names, tree_sizes …)
 *   - one `Tree=N` block per tree with space-separated arrays:
 *       num_leaves, num_cat, split_feature, threshold, decision_type,
 *       left_child, right_child, leaf_value (… plus stats we can ignore)
 *   - child indices: >= 0 → internal node index; < 0 → leaf -(i+1)
 *   - decision_type bitmask: 1 = categorical split, 2 = missing goes left
 *     (the Sathi boosters are numerical-only: num_cat=0, decision_type=2)
 *   - leaf_value already includes the per-tree shrinkage (tree 0 has
 *     shrinkage=1, later trees 0.05), so prediction = Σ leaf_value.
 *
 * Pure: parsing and prediction are deterministic functions of the file text.
 */

export interface LgbTree {
  numLeaves: number;
  splitFeature: Int32Array;
  threshold: Float64Array;
  decisionType: Uint8Array;
  leftChild: Int32Array;
  rightChild: Int32Array;
  leafValue: Float64Array;
}

export interface LgbModel {
  maxFeatureIdx: number;
  objective: string;
  trees: LgbTree[];
}

function parseNumberArray(line: string): number[] {
  const eq = line.indexOf("=");
  const body = eq >= 0 ? line.slice(eq + 1) : line;
  return body
    .trim()
    .split(/\s+/)
    .filter((s) => s.length > 0)
    .map(Number);
}

function toInt32Array(xs: number[]): Int32Array {
  const out = new Int32Array(xs.length);
  for (let i = 0; i < xs.length; i++) out[i] = xs[i] | 0;
  return out;
}

/** Parse a LightGBM text model. Throws on malformed input. */
export function parseLgbModel(text: string): LgbModel {
  const lines = text.split("\n");
  const model: LgbModel = { maxFeatureIdx: -1, objective: "", trees: [] };
  let i = 0;

  // ---- header until the first Tree= ----
  for (; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (line.startsWith("Tree=")) break;
    if (line.startsWith("max_feature_idx=")) {
      model.maxFeatureIdx = parseInt(line.slice("max_feature_idx=".length), 10);
    } else if (line.startsWith("objective=")) {
      model.objective = line.slice("objective=".length).trim();
    }
  }
  if (model.maxFeatureIdx < 0) throw new Error("lightgbm: missing max_feature_idx");

  // ---- tree blocks ----
  while (i < lines.length) {
    const line = lines[i]!.trim();
    if (!line.startsWith("Tree=")) {
      i++;
      continue;
    }
    const t: Record<string, number[]> = {};
    let numLeaves = 0;
    let numCat = 0;
    i++;
    for (; i < lines.length; i++) {
      const l = lines[i]!.trim();
      if (l.startsWith("Tree=") || l === "end" || l === "") break;
      if (l.startsWith("num_leaves=")) numLeaves = parseInt(l.slice("num_leaves=".length), 10);
      else if (l.startsWith("num_cat=")) numCat = parseInt(l.slice("num_cat=".length), 10);
      else if (l.startsWith("is_linear=") || l.startsWith("shrinkage=")) continue;
      else if (l.includes("=") && !l.startsWith("split_gain")) t[l.slice(0, l.indexOf("="))] = parseNumberArray(l);
    }
    if (numCat > 0) throw new Error("lightgbm: categorical splits not supported");
    const splitFeature = t["split_feature"];
    const threshold = t["threshold"];
    const decisionType = t["decision_type"];
    const leftChild = t["left_child"];
    const rightChild = t["right_child"];
    const leafValue = t["leaf_value"];
    if (!splitFeature || !threshold || !decisionType || !leftChild || !rightChild || !leafValue) {
      throw new Error("lightgbm: incomplete tree block");
    }
    const nNodes = numLeaves - 1;
    model.trees.push({
      numLeaves,
      splitFeature: toInt32Array(splitFeature.slice(0, nNodes)),
      threshold: Float64Array.from(threshold.slice(0, nNodes)),
      decisionType: Uint8Array.from(decisionType.slice(0, nNodes).map((x) => (x | 0) & 0xff)),
      leftChild: toInt32Array(leftChild.slice(0, nNodes)),
      rightChild: toInt32Array(rightChild.slice(0, nNodes)),
      leafValue: Float64Array.from(leafValue),
    });
  }
  if (model.trees.length === 0) throw new Error("lightgbm: no trees parsed");
  return model;
}

/**
 * Predict one row (raw margin, before any objective transform — the Sathi
 * boosters are quantile regressors whose leaf output IS the quantile).
 *
 * Missing values follow LightGBM v4 semantics, verified against the reference
 * Python booster on the shipped models (tests/fixtures/lgb-predictions.json):
 *  - decision_type bits 2-3 (missing_type) != 0 → NaN takes the default_left
 *    direction (bit 1);
 *  - missing_type == 0 (feature never missing in training — true for every
 *    node of the Sathi boosters) → NaN falls through the threshold
 *    comparison and lands exactly where 0.0 lands.
 */
export function predictLgb(model: LgbModel, features: readonly number[]): number {
  let sum = 0;
  for (let ti = 0; ti < model.trees.length; ti++) {
    const t = model.trees[ti]!;
    let node = 0;
    while (node >= 0) {
      const f = t.splitFeature[node]!;
      let v = features[f] as number | undefined;
      const thr = t.threshold[node]!;
      const dt = t.decisionType[node]!;
      if (v === undefined || Number.isNaN(v)) {
        const missingType = (dt >> 2) & 3;
        if (missingType !== 0) {
          node = (dt & 2) !== 0 ? t.leftChild[node]! : t.rightChild[node]!;
          continue;
        }
        v = 0; // empirical LightGBM behaviour when missing_type == None
      }
      node = v <= thr ? t.leftChild[node]! : t.rightChild[node]!;
    }
    sum += t.leafValue[-node - 1]!;
  }
  return sum;
}
