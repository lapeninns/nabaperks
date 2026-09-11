"use client"

import { useCallback, useState } from "react"

import type { CancellationInterviewActionState } from "@/app/app/billing/actions"
import {
  CancellationInterviewForm,
  type CancellationInterviewAction,
} from "@/components/merchant/account/cancellation-interview-form"

/**
 * DB-free interview action. Support-call stays on-page; continue-to-cancel
 * records portal-handoff intent then fails inline so Playwright can prove the
 * busy interlock without opening Stripe.
 */
export function CancellationInterviewHarnessClient() {
  const [attemptCount, setAttemptCount] = useState(0)
  const [lastResolution, setLastResolution] = useState("")

  const interviewAction: CancellationInterviewAction = useCallback(
    async (_previousState, formData) => {
      const requestedResolution = formData.get("requestedResolution")
      const resolution =
        typeof requestedResolution === "string" ? requestedResolution : ""

      setAttemptCount((current) => current + 1)
      setLastResolution(resolution)

      // Mirror submitCancellationInterviewAction's guard. Without it, a form
      // field that loses or renames its `name` still reports success here
      // while production would reject the submission.
      const primaryReason = formData.get("primaryReason")
      const details = formData.get("details")
      if (
        typeof primaryReason !== "string" ||
        typeof details !== "string" ||
        (resolution !== "continue_cancellation" && resolution !== "support_call")
      ) {
        return {
          status: "error",
          message:
            "Choose a cancellation reason and what you would like to do next.",
        }
      }

      // Long enough for browser proof to observe the shared pending interlock,
      // short enough to keep the DB-free suite fast and deterministic.
      await new Promise((resolve) => window.setTimeout(resolve, 600))

      if (resolution === "support_call") {
        return {
          status: "follow_up_requested",
        } satisfies CancellationInterviewActionState
      }

      return {
        status: "error",
        message: "Stripe cancellation could not be opened. Please try again.",
      } satisfies CancellationInterviewActionState
    },
    []
  )

  return (
    <>
      <CancellationInterviewForm interviewAction={interviewAction} />
      <output
        data-testid="cancellation-interview-attempts"
        aria-live="polite"
        className="sr-only"
      >
        {attemptCount}
      </output>
      <output
        data-testid="cancellation-interview-resolution"
        className="sr-only"
      >
        {lastResolution}
      </output>
    </>
  )
}
