"use client"

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import type { StampOutcome } from "@/lib/customer/experience/stamp-choreography"

type StampOutcomeContextValue = {
  outcome: StampOutcome | null
  report: (outcome: StampOutcome) => void
}

const StampOutcomeContext = createContext<StampOutcomeContextValue | null>(null)

/**
 * Carries the stamp result from the collector up to the screen headline. The
 * stamp lands in place and the server refresh that follows re-renders the
 * route as "already stamped today"; without this the headline above the
 * freshly slammed stamp would say so. Once a stamp lands on this visit the
 * result owns the screen: "Stamp added." and what is left, nothing else.
 */
export function StampOutcomeProvider({ children }: { children: ReactNode }) {
  const [outcome, setOutcome] = useState<StampOutcome | null>(null)
  // setOutcome is stable, so the value only changes with the outcome.
  const value = useMemo(() => ({ outcome, report: setOutcome }), [outcome])
  return (
    <StampOutcomeContext.Provider value={value}>
      {children}
    </StampOutcomeContext.Provider>
  )
}

/**
 * Called by the collector with its view's outcome. Once a stamp lands the
 * outcome is kept for the rest of the visit, so later refreshes cannot put
 * the "already stamped" headline back over it. A no-op outside a provider.
 */
export function useReportStampOutcome(outcome: StampOutcome | null) {
  const report = useContext(StampOutcomeContext)?.report
  const headline = outcome?.headline
  const supportLine = outcome?.supportLine
  useEffect(() => {
    if (!report || headline === undefined || supportLine === undefined) return
    report({ headline, supportLine })
  }, [report, headline, supportLine])
}

function useLandedOutcome(): StampOutcome | null {
  return useContext(StampOutcomeContext)?.outcome ?? null
}

/** The screen headline: the server's until a stamp lands on this visit. */
export function StampScreenHeadline({ initial }: { initial: string }) {
  return <>{useLandedOutcome()?.headline ?? initial}</>
}

/** The support line under the headline, swapped the same way. */
export function StampScreenSupport({ initial }: { initial?: string }) {
  const landed = useLandedOutcome()
  return <>{landed ? landed.supportLine : initial}</>
}

/**
 * "View my card": quiet while the stamp press is the screen's one primary
 * action, filled once there is nothing left to do here (a stamp landed, or
 * today's stamp was already on the card).
 */
export function StampScreenCardLink({
  href,
  primary,
}: {
  href: string
  /** The server already knows there is nothing to stamp on this visit. */
  primary: boolean
}) {
  const landed = useLandedOutcome()
  return (
    <Button
      asChild
      size="lg"
      variant={primary || landed ? "default" : "secondary"}
      className="w-full"
    >
      <Link href={href}>View my card</Link>
    </Button>
  )
}
