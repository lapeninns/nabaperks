import { notFound } from "next/navigation"

import { PageTitle } from "@/components/brand"

import {
  OffersHarnessClient,
  type OfferHarnessStep,
  type OfferHarnessSurface,
} from "./harness-client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Offers harness lane — variant "full", nav highlighted on /app/offers.
 *
 * Mounts the merchant desk, the three creator steps, the customer landing and
 * pass, and the staff redemption screen against static fixtures, with no
 * Supabase and no session. `?surface=` chooses which of the four to show and
 * `?step=` chooses which creator step.
 *
 * Both are resolved against a closed set here on the server, so a hand-edited
 * query string can only ever select a screen this lane already owns — and the
 * two arrays live in this file rather than in the client module because a
 * function exported from a `"use client"` module cannot be called during a
 * server render.
 */

const SURFACES: readonly OfferHarnessSurface[] = [
  "desk",
  "creator",
  "customer",
  "staff",
]

const STEPS: readonly OfferHarnessStep[] = ["benefits", "rules", "review"]

function fromClosedSet<T extends string>(
  allowed: readonly T[],
  value: string | undefined,
  fallback: T
): T {
  return allowed.find((entry) => entry === value) ?? fallback
}

export default async function OffersHarnessPage({
  searchParams,
}: {
  searchParams?: Promise<{ surface?: string; step?: string }>
}) {
  if (process.env.NODE_ENV === "production") {
    notFound()
  }

  const params = searchParams ? await searchParams : {}

  return (
    <div className="grid min-w-0 gap-6">
      <PageTitle
        eyebrow="Harness"
        title="Offers and campaign QR"
        description="DB-free states for the merchant desk, the creator, the customer landing and pass, and the staff redemption screen."
      />

      <OffersHarnessClient
        surface={fromClosedSet(SURFACES, params.surface, "desk")}
        step={fromClosedSet(STEPS, params.step, "review")}
      />
    </div>
  )
}
