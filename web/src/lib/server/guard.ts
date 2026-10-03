/**
 * Route guard: resolves the device owner or signals that onboarding has not
 * been completed yet. Product routes never auto-create users — the owner
 * account is created exclusively through /api/onboarding.
 */
import { NextResponse } from "next/server";
import type { User } from "@prisma/client";
import { getOwnerUser } from "./data";

export class OnboardingRequiredError extends Error {
  constructor() {
    super("onboarding_required");
    this.name = "OnboardingRequiredError";
    Object.setPrototypeOf(this, OnboardingRequiredError.prototype);
  }
}

export function isOnboardingRequiredError(e: unknown): boolean {
  if (!e) return false;
  if (e instanceof OnboardingRequiredError) return true;
  if (typeof e === "object") {
    const err = e as { message?: string; name?: string; code?: string };
    return (
      err.message === "onboarding_required" ||
      err.name === "OnboardingRequiredError" ||
      err.code === "onboarding_required"
    );
  }
  return false;
}

export async function requireOwner(): Promise<User> {
  const user = await getOwnerUser();
  if (!user) throw new OnboardingRequiredError();
  return user;
}

export function onboardingRequiredResponse() {
  return NextResponse.json(
    {
      error: "Onboarding required — open the app and finish setup first.",
      code: "onboarding_required",
    },
    { status: 409 },
  );
}
