import { NextResponse } from "next/server";
import { demoUsers } from "@/lib/engine/sathiPersonas";

export const dynamic = "force-dynamic";

/** List the five Sathi demo personas (reference: GET /v1/demo-users). */
export async function GET() {
  return NextResponse.json(demoUsers());
}
