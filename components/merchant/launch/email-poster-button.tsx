"use client"

import { useState, useTransition } from "react"
import { Mail01Icon } from "@hugeicons/core-free-icons"

import { emailPosterAction, type EmailPosterState } from "@/app/app/qr/actions"
import { Icon } from "@/components/brand"
import { StatusBanner } from "@/components/loyalty/status-banner"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

/**
 * Phone-native alternative to browser printing: email all registered poster
 * A4 counter PDFs to the signed-in merchant. Calls the
 * server action directly (no form) and shows inline feedback, so the QR panel
 * updates without a reload.
 */
export function EmailPosterButton() {
  const [pending, startTransition] = useTransition()
  const [state, setState] = useState<EmailPosterState>({})

  return (
    <div className="grid gap-2">
      <Button
        type="button"
        variant="outline"
        className="w-fit"
        disabled={pending}
        aria-busy={pending || undefined}
        onClick={() =>
          startTransition(async () => {
            setState(await emailPosterAction())
          })
        }
      >
        {pending ? (
          <Spinner aria-hidden="true" role="presentation" />
        ) : (
          <Icon icon={Mail01Icon} size={16} />
        )}
        {pending ? "Emailing PDFs…" : "Email poster PDFs"}
      </Button>
      {state.message ? (
        <StatusBanner
          tone={state.ok ? "success" : "error"}
          title={state.ok ? "Poster PDFs sent" : "Could not send poster PDFs"}
        >
          {state.message}
        </StatusBanner>
      ) : null}
    </div>
  )
}
