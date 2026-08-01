"use client"

import { useActionState } from "react"

import {
  submitCancellationInterviewAction,
  type CancellationInterviewActionState,
} from "@/app/app/billing/actions"
import { StatusBanner } from "@/components/loyalty/status-banner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

const INITIAL_STATE: CancellationInterviewActionState = { status: "idle" }
const SELECT_CLASSES =
  "focus-ring min-h-11 w-full rounded-2xl border border-input bg-secondary/60 px-4 text-sm outline-none"

export function CancellationInterviewForm() {
  const [state, action, pending] = useActionState(
    submitCancellationInterviewAction,
    INITIAL_STATE
  )

  if (state.status === "follow_up_requested") {
    return (
      <StatusBanner tone="success" title={<h2>Support follow-up requested</h2>}>
        Your subscription has not been cancelled. The Nabaperks team will use
        your exit-review context to follow up.
      </StatusBanner>
    )
  }

  return (
    <form action={action} aria-busy={pending} className="grid gap-4">
      <label className="grid gap-1.5 text-sm font-bold">
        Main reason for leaving
        <select name="primaryReason" required className={SELECT_CLASSES}>
          <option value="price">The price no longer works</option>
          <option value="not_using">We are not using it enough</option>
          <option value="missing_feature">A feature is missing</option>
          <option value="technical_issue">
            A technical issue is blocking us
          </option>
          <option value="poor_results">
            We have not seen the result we expected
          </option>
          <option value="seasonal_pause">
            The venue is entering a quiet or closed season
          </option>
          <option value="closing">The venue is closing</option>
          <option value="other">Another reason</option>
        </select>
      </label>

      <label className="grid gap-1.5 text-sm font-bold">
        What did you expect, and what happened instead?
        <Textarea
          name="details"
          maxLength={2000}
          placeholder="Optional, but this helps us address the real issue."
        />
      </label>

      <fieldset className="grid gap-2">
        <legend className="text-sm font-bold">What would you like next?</legend>
        <label className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm">
          <input
            type="radio"
            name="requestedResolution"
            value="support_call"
            defaultChecked
            className="focus-ring mt-0.5 size-4 accent-primary"
          />
          <span>
            <strong className="block">Ask for a support call</strong>
            <span className="text-muted-foreground">
              Keep the subscription unchanged while we review the expectation, a
              possible fix, or an available alternative.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm">
          <input
            type="radio"
            name="requestedResolution"
            value="continue_cancellation"
            className="focus-ring mt-0.5 size-4 accent-primary"
          />
          <span>
            <strong className="block">Continue to cancellation</strong>
            <span className="text-muted-foreground">
              Open Stripe and schedule cancellation at the end of the current
              paid or trial period.
            </span>
          </span>
        </label>
      </fieldset>

      {state.status === "error" ? (
        <StatusBanner tone="error" title={<h2>Exit review not saved</h2>}>
          {state.message}
        </StatusBanner>
      ) : null}

      <Button type="submit" disabled={pending} className="w-full sm:w-fit">
        {pending ? "Saving your review…" : "Continue"}
      </Button>
      <p className="text-xs leading-5 text-muted-foreground">
        Choosing a support call does not cancel your subscription. Choosing to
        continue opens Stripe, where you confirm the cancellation date.
      </p>
    </form>
  )
}
