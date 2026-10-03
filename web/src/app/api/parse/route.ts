import { NextRequest, NextResponse } from "next/server";
import { getOwnerUser, audit } from "@/lib/server/data";
import { parseExpenseText } from "@/lib/engine/nlp";

export const dynamic = "force-dynamic";

/** Parse preview — returns structured parse with confidence; nothing saved. */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { text?: string };
    const text = (body.text ?? "").trim();
    if (text.length < 2) {
      return NextResponse.json({ error: "Text too short" }, { status: 400 });
    }
    const parsed = parseExpenseText(text);
    // Pure computation — auditing only when an owner exists (no auto-create).
    const user = await getOwnerUser();
    if (user) await audit(user.id, "nl_parse_preview", { text });
    return NextResponse.json(parsed);
  } catch (e) {
    console.error("[parse]", e);
    return NextResponse.json({ error: "Failed to parse" }, { status: 500 });
  }
}
