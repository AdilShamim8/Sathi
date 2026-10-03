import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Liveness probe (reference: GET /healthz). */
export async function GET() {
  return NextResponse.json({ status: "ok", service: "sathi", version: "1.0.0" });
}

