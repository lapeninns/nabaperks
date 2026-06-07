"use client"

import { CustomerShell } from "@/components/layout"
import { StatusBanner } from "@/components/loyalty"

export default function CustomerCardError() {
  return (
    <CustomerShell className="grid content-center">
      <StatusBanner title="Card unavailable" tone="error" className="text-center">
        This card could not be loaded safely. Ask a team member for the current
        loyalty QR and try again.
      </StatusBanner>
    </CustomerShell>
  )
}
