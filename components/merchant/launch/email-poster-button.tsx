"use client"

import { useState, useTransition } from "react"
import { Mail01Icon } from "@hugeicons/core-free-icons"

import { emailPosterAction, type EmailPosterState } from "@/app/app/qr/actions"
import { Icon } from "@/components/brand"
import { StatusBanner } from "@/components/loyalty/status-banner"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

/**
 * Phone-native alternative to "open the A4 and print at 100%": email the poster
 * link to the signed-in merchant so they can open and print it from a computer
 * later. Calls the server action directly (no form) and shows inline feedback,
 * so the QR panel updates without a reload.
 */
export function EmailPosterButton() {
  const [pending, startTransition] = useTransition()
  const [state, setState] = useState<EmailPosterState>({})
  const resultMessage = state.message?.replaceAll(
    "the poster",
    "the poster link"
  )

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
        {pending ? "Emailing link…" : "Email poster link"}
      </Button>
      {resultMessage ? (
        <StatusBanner
          tone={state.ok ? "success" : "error"}
          title={state.ok ? "Poster link sent" : "Could not send poster link"}
        >
          {resultMessage}
        </StatusBanner>
      ) : null}
    </div>
  )
}
