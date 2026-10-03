import { NextResponse } from "next/server";
import { resetAllData, getOwnerUser, audit } from "@/lib/server/data";

export const dynamic = "force-dynamic";

/**
 * Reset / delete all data: wipes the owner's transactions, goals, insights,
 * audit trail and account so the app returns to the onboarding screen.
 * The client must also clear its local caches (copilot history, query cache).
 * Reference personas that power /api/v1 are intentionally preserved.
 */
export async function POST() {
  try {
    const user = await getOwnerUser();
    if (user) {
      await audit(user.id, "reset_all_data", {
        at: new Date().toISOString(),
        note: "User requested full data reset",
      });
    }
    await resetAllData();
    return NextResponse.json({ ok: true, reset: true });
  } catch (e) {
    console.error("[reset]", e);
    return NextResponse.json({ error: "Failed to reset data" }, { status: 500 });
  }
}

