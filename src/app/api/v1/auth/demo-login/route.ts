import { NextRequest, NextResponse } from "next/server";
import { mintDemoToken, rateLimit, clientKey, badRequest } from "@/lib/server/sathiApi";
import { RATE_LIMITS } from "@/lib/engine/sathiConfig";
import { SATHI_PERSONAS } from "@/lib/engine/sathiPersonas";

export const dynamic = "force-dynamic";

/**
 * Demo login (reference: POST /v1/auth/demo-login).
 * Exchanges a persona user_id for a signed demo token used as Bearer auth
 * on /v1/me/* and /v1/chat. No real credentials — synthetic personas only.
 */
export async function POST(req: NextRequest) {
  try {
    if (!rateLimit(clientKey(req, "demo-login"), RATE_LIMITS.demo_login_per_window, RATE_LIMITS.window_s * 1000)) {
      return NextResponse.json(
        { error: { code: "rate_limited", message: "Too many logins — wait a minute." } },
        { status: 429 },
      );
    }
    const body = (await req.json().catch(() => null)) as { user_id?: string } | null;
    const userId = body?.user_id;
    if (!userId || !SATHI_PERSONAS[userId]) {
      return badRequest("user_id must be one of: " + Object.keys(SATHI_PERSONAS).join(", "));
    }
    return NextResponse.json({
      token: mintDemoToken(userId),
      token_type: "bearer",
      user_id: userId,
      expires_in: 24 * 3600,
    });
  } catch (e) {
    console.error("[v1 demo-login]", e);
    return NextResponse.json({ error: { code: "internal", message: "Login failed" } }, { status: 500 });
  }
}
