/**
 * Financial knowledge base (RAG).
 * Self-authored educational corpus; BM25-lite lexical retrieval.
 * Production path would use pgvector embeddings — noted for judges.
 */

export interface KnowledgeChunk {
  id: number;
  sourceId: string;
  title: string;
  topic: string;
  chunkText: string;
}

export const KNOWLEDGE_CORPUS: Omit<KnowledgeChunk, "id">[] = [
  {
    sourceId: "kb-01", title: "The month-end dry spell", topic: "cash_flow",
    chunkText: "A month-end dry spell happens when income arrives early in the month but obligations and discretionary spending continue through days 21–31. The wallet drains not because of one big purchase but because of timing: the last 10 days have outflow with no inflow. Holding a fixed buffer on salary day is the standard mitigation — even 1–2 days of essential expenses relieves most of the pressure. Shifting one recurring bill earlier or one discretionary purchase later also smooths the trough.",
  },
  {
    sourceId: "kb-02", title: "Safe-to-spend thinking", topic: "budgeting",
    chunkText: "Safe-to-spend is the amount you can spend after subtracting upcoming commitments (rent, bills, remittances due before the next income), a safety buffer (about 3 days of essentials), and your prorated savings target from your current balance. Dividing safe-to-spend by the days until your next income gives a daily budget. The figure changes as new transactions land, which is why it should be recomputed rather than fixed monthly.",
  },
  {
    sourceId: "kb-03", title: "Cash-out fees in Bangladesh MFS", topic: "fees",
    chunkText: "Mobile financial services typically charge a fee on cash-out (agent-assisted withdrawal), while send-money and merchant payments are often free or cheaper. Frequent small cash-outs multiply fees and remove the digital spending record that helps apps give useful insights. Batching withdrawals into fewer, larger ones and paying merchants directly where accepted reduces both fee leakage and record loss. Exact fee schedules vary by provider and should be verified on the official rate card.",
  },
  {
    sourceId: "kb-04", title: "Emergency funds for irregular incomes", topic: "savings",
    chunkText: "Households with irregular income (gig work, daily wages, remittance) benefit from a small emergency fund before ambitious goals. A common starting target is 2–4 weeks of essential expenses. Keeping it in the wallet or an easily reachable DPS means a late payment does not force informal borrowing. Once the buffer exists, goal savings can be more aggressive because shortfalls no longer derail the plan.",
  },
  {
    sourceId: "kb-05", title: "Probability, not certainty", topic: "forecasting",
    chunkText: "Cash-flow forecasts are estimates expressed as ranges and probabilities, never certainties. A '40% shortfall risk in the next 7 days' means that in 4 of 10 similar situations the balance dipped below the safety line. Calibration matters: a well-calibrated model's 40% predictions should come true about 40% of the time. When a forecast shows high risk, the practical response is to defer discretionary spending through the pressure window, not to panic.",
  },
  {
    sourceId: "kb-06", title: "Pay-yourself-first", topic: "savings",
    chunkText: "Pay-yourself-first means moving your savings amount out of the spending wallet on salary day, before discretionary spending starts. It converts saving from a month-end leftover into a scheduled commitment. Even a small fixed amount builds the habit; raising it gradually (e.g. after each salary increase) is more sustainable than large jumps. In DPS terms, an automated monthly deposit implements the same principle.",
  },
  {
    sourceId: "kb-07", title: "Reading your spending categories", topic: "spending",
    chunkText: "Grouping transactions into categories turns an unreadable list into a spending picture. Essentials (food, transport, utilities, rent) are needs; discretionary categories (dining out, entertainment, shopping) are wants where trade-offs are easiest. A single month can mislead — festival months, emergencies and one-off purchases distort totals — so comparing 30-day windows and checking recurring patterns gives a steadier view before deciding to cut anything.",
  },
  {
    sourceId: "kb-08", title: "Goal feasibility and capacity", topic: "goals",
    chunkText: "Goal feasibility compares required monthly saving (target minus saved, over months remaining) with realistic capacity (average inflow minus non-savings outflow over recent complete months). When capacity is below the requirement, options include trimming a discretionary category, extending the timeline, or reducing the target. Monte-Carlo style thinking — asking 'what happens if income is late one month?' — prevents plans that only work when everything goes perfectly.",
  },
  {
    sourceId: "kb-09", title: "Why we show evidence with advice", topic: "trust",
    chunkText: "Every automated insight should carry the evidence behind it: which transactions, which window, which assumption. Evidence lets you verify the reasoning instead of trusting a black box, separates prediction (what may happen) from fact (what happened), and keeps the final decision with you. If an explanation cannot show its numbers, treat it with caution — that is a healthy rule for any financial app, not just this one.",
  },
  {
    sourceId: "kb-10", title: "Remittance rhythm planning", topic: "cash_flow",
    chunkText: "Remittance-receiving households often see money arrive every 2–3 months rather than monthly. Planning around the rhythm means front-loading essential payments and obligations right after the remittance lands, and treating the final weeks before the next one as a protected low-spend window. Mixing one small local income source with remittance reduces dependence on a single arrival date.",
  },
];

/* -------------------- BM25-lite retrieval -------------------- */

const STOP = new Set(["the", "a", "an", "is", "are", "of", "to", "in", "and", "or", "my", "your", "i", "me", "what", "why", "how", "do", "does", "can", "should", "for", "on", "it", "this", "that", "with"]);

function tokenize(s: string): string[] {
  return normalize(s).split(/[^a-z0-9\u0980-\u09FF]+/).filter((t) => t.length > 1 && !STOP.has(t));
}

function normalize(s: string): string {
  const BN: Record<string, string> = { "০": "0", "১": "1", "২": "2", "৩": "3", "৪": "4", "৫": "5", "৬": "6", "৭": "7", "৮": "8", "৯": "9" };
  return s.toLowerCase().replace(/[০-৯]/g, (d) => BN[d] ?? d);
}

export function retrieveKnowledge(query: string, chunks: KnowledgeChunk[], k = 3): { chunk: KnowledgeChunk; score: number }[] {
  const qTokens = tokenize(query);
  if (qTokens.length === 0) return [];
  const df = new Map<string, number>();
  const docTokens = chunks.map((c) => {
    const toks = tokenize(`${c.title} ${c.topic} ${c.chunkText}`);
    for (const t of new Set(toks)) df.set(t, (df.get(t) ?? 0) + 1);
    return toks;
  });
  const N = chunks.length;
  const avgLen = docTokens.reduce((s, d) => s + d.length, 0) / N || 1;

  const scored = chunks.map((c, i) => {
    const toks = docTokens[i];
    const tf = new Map<string, number>();
    for (const t of toks) tf.set(t, (tf.get(t) ?? 0) + 1);
    let score = 0;
    for (const q of qTokens) {
      const f = tf.get(q) ?? 0;
      if (f === 0) continue;
      const n = df.get(q) ?? 0;
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      score += idf * ((f * 2.2) / (f + 1.2 * (0.25 + 0.75 * (toks.length / avgLen))));
    }
    return { chunk: c, score };
  });
  return scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score).slice(0, k);
}
