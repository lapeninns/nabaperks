"use client"

import { useState } from "react"
import { QrPauseDialog } from "@/components/merchant/launch/qr-pause-dialog"
import { Button } from "@/components/ui/button"
import { qrPauseResult } from "@/lib/merchant/qr-pause-state"

/** UI-only fixture. Database authority is exercised by the separate DB tier. */
export function QrPauseHarness() {
  const [active, setActive] = useState(true)
  const [requests, setRequests] = useState(0)
  const [confirmations, setConfirmations] = useState(0)
  return (
    <section className="grid gap-6 p-6">
      <h1 className="text-3xl font-extrabold">Venue QR</h1>
      <p role="status">
        {active ? "Live · accepting scans" : "Paused · no new scans"}
      </p>
      <p>
        Code requests: {requests}. Confirmation transitions: {confirmations}.
      </p>
      {active ? (
        <QrPauseDialog
          qrCodeId="00000000-0000-4000-8000-000000000001"
          venueName="Old Crown Girton"
          actions={{
            request: async () => {
              setRequests((count) => count + 1)
              return {
                status: "sent",
                message: "Verification code sent. Scans remain active.",
                challengeId: "fixture",
                maskedEmail: "o•••@example.test",
                retryAt: new Date(Date.now() + 60_000).toISOString(),
              }
            },
            verify: async (_qr, _challenge, code) => {
              if (code === "000000") return qrPauseResult("expired")
              if (code !== "123456") return qrPauseResult("incorrect")
              setActive(false)
              setConfirmations((count) => count + 1)
              return qrPauseResult("paused")
            },
          }}
        />
      ) : (
        <Button
          onClick={() => {
            setActive(true)
            setConfirmations((count) => count + 1)
          }}
        >
          Resume customer scans
        </Button>
      )}
    </section>
  )
}
