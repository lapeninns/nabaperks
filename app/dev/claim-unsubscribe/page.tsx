import { notFound } from "next/navigation"

import {
  ClaimUnsubscribePanel,
  type ClaimUnsubscribeState,
} from "@/components/customer/claim-unsubscribe-panel"

import { harnessClaimUnsubscribeAction } from "./actions"

export const dynamic = "force-dynamic"

const STATES = new Set<ClaimUnsubscribeState>(["default", "done", "failed"])

/**
 * DB-free proof of the claim-unsubscribe copy. The production page always
 * rate-limits through Supabase first, so Playwright mounts these states here
 * without persistence or an existence oracle.
 */
export default async function ClaimUnsubscribeHarnessPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>
}) {
  if (process.env.NODE_ENV === "production") notFound()

  const query = await searchParams
  const state = STATES.has(query.state as ClaimUnsubscribeState)
    ? (query.state as ClaimUnsubscribeState)
    : "default"

  return (
    <ClaimUnsubscribePanel
      state={state}
      token="harness-unsub-token"
      action={harnessClaimUnsubscribeAction}
    />
  )
}
