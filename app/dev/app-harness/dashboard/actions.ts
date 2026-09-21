"use server"

import type { VenueCodeResetActionState } from "@/app/app/actions"

/** DB-free stand-in: a successful reset that reveals a new literal code. */
export async function noopResetVenueCodeAction(): Promise<VenueCodeResetActionState> {
  return {
    reset: true,
    code: "730264",
    rotatesAt: "2026-09-22T04:00:00.000Z",
  }
}

/** The server refused (rate limit, RPC failure): the sheet stays open. */
export async function failingResetVenueCodeAction(): Promise<VenueCodeResetActionState> {
  return {
    errors: {
      form: "The code was reset recently. Try again in a few minutes.",
    },
  }
}

/** Never resolves within a screenshot window: pins the in-flight state. */
export async function slowResetVenueCodeAction(): Promise<VenueCodeResetActionState> {
  await new Promise((resolve) => setTimeout(resolve, 60_000))
  return { reset: true, code: "730264" }
}
