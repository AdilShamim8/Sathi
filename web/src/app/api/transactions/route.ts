import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOwner, onboardingRequiredResponse, isOnboardingRequiredError } from "@/lib/server/guard";
import { audit, clearInsights } from "@/lib/server/data";
import { parseExpenseText } from "@/lib/engine/nlp";

export const dynamic = "force-dynamic";

/** List transactions (optionally filtered). */
export async function GET(req: NextRequest) {
  try {
    const user = await requireOwner();
    const { searchParams } = new URL(req.url);
    const limit = Math.min(500, Math.max(1, parseInt(searchParams.get("limit") ?? "200", 10) || 200));
    const category = searchParams.get("category") ?? undefined;
    const direction = searchParams.get("direction") ?? undefined;

    const where: { userId: number; category?: string; direction?: string } = { userId: user.id };
    if (category) where.category = category;
    if (direction) where.direction = direction;

    const rows = await db.transaction.findMany({
      where,
      orderBy: { timestamp: "desc" },
      take: limit,
    });
    return NextResponse.json(rows);
  } catch (e) {
    if (isOnboardingRequiredError(e)) return onboardingRequiredResponse();
    console.error("[transactions GET]", e);
    return NextResponse.json({ error: "Failed to list transactions" }, { status: 500 });
  }
}

/** Save a parsed NL transaction. Low-confidence parses must be confirmed. */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      text?: string; confirmed?: boolean; categoryOverride?: string;
    };
    const text = (body.text ?? "").trim();
    if (text.length < 2 || text.length > 500) {
      return NextResponse.json({ error: "Text must be 2-500 characters" }, { status: 400 });
    }

    const user = await requireOwner();
    const parsed = parseExpenseText(text);
    if (parsed.amount === null) {
      return NextResponse.json({ error: "Could not find an amount in the text." }, { status: 400 });
    }
    if (parsed.confidence < 0.7 && !body.confirmed && !body.categoryOverride) {
      return NextResponse.json({ saved: false, needsConfirmation: true, parsed });
    }

    const category = body.categoryOverride ?? parsed.category;
    const created = await db.transaction.create({
      data: {
        userId: user.id,
        timestamp: new Date(parsed.date),
        amount: parsed.amount,
        currency: "BDT",
        direction: parsed.direction,
        category,
        subcategory: parsed.subcategory,
        merchant: parsed.merchant,
        channel: "wallet",
        source: "natural_language_input",
        classificationConfidence: parsed.confidence,
      },
    });

    await clearInsights(user.id); // insights must never show stale numbers
    await audit(user.id, "nl_transaction_saved", {
      text, parsed: { ...parsed, category }, confirmed: body.confirmed ?? false,
    });

    return NextResponse.json({
      saved: true, needsConfirmation: false,
      id: created.id,
      parsed: { ...parsed, category },
    });
  } catch (e) {
    if (isOnboardingRequiredError(e)) return onboardingRequiredResponse();
    console.error("[transactions POST]", e);
    return NextResponse.json({ error: "Failed to save transaction" }, { status: 500 });
  }
}

