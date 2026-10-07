import { NextResponse } from "next/server";
import { serverAIStatus } from "@/lib/server/aiProvider";

export const dynamic = "force-dynamic";

/** Configuration only; does not spend tokens or expose server credentials. */
export async function GET() {
  return NextResponse.json(serverAIStatus(), { headers: { "Cache-Control": "no-store" } });
}
