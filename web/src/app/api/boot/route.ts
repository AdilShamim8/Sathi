import { NextResponse } from "next/server";
import { getOwnerUser, ensureKnowledge } from "@/lib/server/data";

export const dynamic = "force-dynamic";

/**
 * Boot: report whether the owner account exists. The app is single-owner and
 * local-first â€” no user is ever auto-created here; /api/onboarding does that
 * with the user's chosen name and start mode (personal or demo data).
 */
export async function GET() {
  try {
    await ensureKnowledge();
    const user = await getOwnerUser();
    return NextResponse.json({
      ok: true,
      needsOnboarding: !user,
      user: user
        ? { id: user.id, name: user.name, mode: user.mode }
        : null,
    });
  } catch (e) {
    console.error("[boot]", e);
    return NextResponse.json({ ok: false, error: "Failed to initialize app" }, { status: 500 });
  }
}

