"use client"

import { CustomerShell } from "@/components/layout"
import { StatusBanner } from "@/components/loyalty"

export default function CustomerRewardError() {
  return (
    <CustomerShell className="grid content-center">
      <StatusBanner
        title="Reward unavailable"
        tone="error"
        className="text-center"
      >
        This reward could not be loaded safely. Return to the customer card or
        ask a team member for help.
      </StatusBanner>
    </CustomerShell>
  )
}
