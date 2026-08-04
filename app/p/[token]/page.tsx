import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { PRIVATE_ROUTE_METADATA } from "@/lib/seo/metadata"

export const metadata: Metadata = PRIVATE_ROUTE_METADATA

type OfferPassScanHandoffPageProps = {
  params: Promise<{
    token: string
  }>
}

// Pass scan tokens are uuid-typed in the RPC; reject a malformed one here so a
// mistyped or truncated scan takes the calm 404 rather than the error boundary.
// One of five copies of this literal — see the header of
// lib/merchant/reward-scanner.ts for the full list and why they are separate.
const PASS_SCAN_TOKEN_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Public handoff for a customer's discount-pass QR. It carries no authority of
 * its own: it only forwards into the merchant console, where the staff screen
 * requires a merchant session and proves venue ownership. Mirrors /r/[token].
 */
export default async function OfferPassScanHandoffPage({
  params,
}: OfferPassScanHandoffPageProps) {
  const { token } = await params

  if (!PASS_SCAN_TOKEN_PATTERN.test(token)) {
    notFound()
  }

  redirect(`/app/offers/scan/${encodeURIComponent(token)}`)
}
