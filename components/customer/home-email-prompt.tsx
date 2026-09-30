"use client"

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react"

import {
  emailPromptAction,
  type EmailPromptState,
} from "@/app/home/(authed)/profile/actions"
import { MonoTag, ReceiptCard } from "@/components/brand"
import { CustomerOtpInput } from "@/components/customer/customer-otp-input"
import { WalletLinkNextStep } from "@/components/customer/wallet-link-next-step"
import { profileInputClass } from "@/components/customer/profile-form-parts"
import { StatusBanner } from "@/components/loyalty"
import { Button } from "@/components/ui/button"
import type { EmailPromptSurface } from "@/lib/customer/contact-event-core"
import { recordEmailPromptEvent } from "@/lib/customer/email-prompt-events"

export const EMAIL_PROMPT_DISMISS_KEY = "nabaperks.email-prompt-dismissed"
const RESHOW_AFTER_MS = 30 * 24 * 60 * 60 * 1000

/**
 * Why the prompt asks, chosen on the server from `CUSTOMER_EMAIL_AUTH_MODE`.
 * `rewards` while email sign-in is off; `wifi_sign_in` once email can open a
 * wallet. No promise about anything that is not live.
 */
export type EmailPromptReason = "rewards" | "wifi_sign_in"

const SUPPORT_COPY: Record<EmailPromptReason, string> = {
  rewards:
    "A confirmed email is needed before you collect a reward. Add it now and it's ready when you are.",
  wifi_sign_in:
    "Add your email so you can sign in over Wi-Fi when there's no signal. Confirm it here to open this same wallet, with your existing stamps and rewards.",
}

// A tiny external store over the localStorage dismissal flag, as in
// HomeBirthdayPrompt: useSyncExternalStore reads the client-only value without a
// hydration flash and without setState in an effect.
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function shouldShow(): boolean {
  try {
    const raw = window.localStorage.getItem(EMAIL_PROMPT_DISMISS_KEY)
    if (!raw) return true
    const dismissedAt = Number(raw)
    return (
      !Number.isFinite(dismissedAt) ||
      Date.now() - dismissedAt > RESHOW_AFTER_MS
    )
  } catch {
    return true
  }
}

/** The server never has localStorage; render hidden and let the client hydrate. */
function serverSnapshot() {
  return false
}

/**
 * A quiet, dismissible nudge (asked for only when the customer has no verified
 * email) to add and confirm an email in place: the address, then the emailed
 * code. It never blocks the wallet or a stamp; "Not now" is remembered for 30
 * days. While it is dismissed or not asked for, `fallback` (the birthday prompt
 * on home) shows instead, so at most one prompt is ever on screen.
 *
 * Render it unconditionally where it may appear and let `reason` decide: every
 * prompt action re-renders the route on the server (it sets or clears the
 * pending-code cookie), and that render may no longer ask, because the email
 * is now confirmed or the one-shot stamp flag has already left the URL. Kept
 * at a stable position, the prompt survives that render, and once the guest
 * has used it, it stays until they leave the screen so the code step and the
 * "Email confirmed" answer are actually seen.
 */
export function HomeEmailPrompt({
  action: promptAction = emailPromptAction,
  reason,
  surface = "home_prompt",
  initialEmail = null,
  codePending = false,
  fallback = null,
}: {
  action?: typeof emailPromptAction
  /** Why the server asks, or null when it is not asking. */
  reason: EmailPromptReason | null
  surface?: EmailPromptSurface
  /** An unverified email already on the profile, to prefill. */
  initialEmail?: string | null
  /** A code for `initialEmail` is already on its way: open at the code step. */
  codePending?: boolean
  fallback?: ReactNode
}) {
  const visible = useSyncExternalStore(subscribe, shouldShow, serverSnapshot)
  const [initialState] = useState<EmailPromptState>(() =>
    codePending && initialEmail
      ? { step: "code", email: initialEmail }
      : { step: "email", email: initialEmail ?? undefined }
  )
  const [state, action, pending] = useActionState(promptAction, initialState)
  // The last reason the server gave, so an engaged prompt keeps its copy after
  // the server stops asking (the compare-to-previous-render pattern).
  const [shownReason, setShownReason] = useState(reason)
  if (reason !== null && reason !== shownReason) setShownReason(reason)

  const engaged = state !== initialState
  const activeReason = reason ?? shownReason
  if (!visible || activeReason === null || (reason === null && !engaged)) {
    return <>{fallback}</>
  }

  function dismiss() {
    try {
      window.localStorage.setItem(EMAIL_PROMPT_DISMISS_KEY, String(Date.now()))
    } catch {
      // Storage can be unavailable; the notify below still hides it this session.
    }
    void recordEmailPromptEvent("customer_email_prompt_dismissed", surface)
    for (const listener of listeners) listener()
  }

  return (
    <EmailPromptCard
      reason={activeReason}
      surface={surface}
      state={state}
      action={action}
      pending={pending}
      onDismiss={dismiss}
    />
  )
}

function EmailPromptCard({
  reason,
  surface,
  state,
  action,
  pending,
  onDismiss,
}: {
  reason: EmailPromptReason
  surface: EmailPromptSurface
  state: EmailPromptState
  action: (payload: FormData) => void
  pending: boolean
  onDismiss: () => void
}) {
  // "Use a different email" is a client-only step back; any new server answer
  // (the compare-to-previous pattern) returns control to the server.
  const [editing, setEditing] = useState(false)
  const [seenState, setSeenState] = useState(state)
  if (state !== seenState) {
    setSeenState(state)
    setEditing(false)
  }

  const recorded = useRef(false)
  useEffect(() => {
    if (recorded.current) return
    recorded.current = true
    void recordEmailPromptEvent("customer_email_prompt_viewed", surface)
  }, [surface])

  const step = editing ? "email" : state.step
  const compact = surface === "stamp_prompt"

  return (
    <ReceiptCard
      className="grid gap-3"
      padding={compact ? "sm" : "md"}
      data-testid="email-prompt"
    >
      <MonoTag tone="cobalt">Your email</MonoTag>
      <h2 className="text-base leading-tight font-extrabold">
        {step === "verified"
          ? state.walletLinked
            ? "Wallets linked"
            : "Email confirmed"
          : "Add your email"}
      </h2>

      {step === "verified" ? (
        <p role="status" className="text-sm leading-6 text-muted-foreground">
          {state.message ?? "Your email is confirmed."}
        </p>
      ) : null}
      {step !== "verified" ? (
        <p className="text-sm leading-6 text-muted-foreground">
          Used this email for another wallet? After verification, we can bring
          your stamps and rewards together. If we need help checking the
          wallets, we will tell you and keep your stamps and rewards unchanged.
        </p>
      ) : null}

      {step === "email" ? (
        <EmailStep
          state={state}
          action={action}
          pending={pending}
          surface={surface}
          support={SUPPORT_COPY[reason]}
          onDismiss={onDismiss}
        />
      ) : null}

      {step === "code" ? (
        <CodeStep
          state={state}
          action={action}
          pending={pending}
          surface={surface}
          onChangeEmail={() => setEditing(true)}
        />
      ) : null}
      <WalletLinkNextStep
        linked={state.walletLinked}
        recovery={state.recovery}
      />
    </ReceiptCard>
  )
}

function EmailStep({
  state,
  action,
  pending,
  surface,
  support,
  onDismiss,
}: {
  state: EmailPromptState
  action: (payload: FormData) => void
  pending: boolean
  surface: EmailPromptSurface
  support: string
  onDismiss: () => void
}) {
  const errorId = `email-prompt-${surface}-email-error`
  return (
    <form action={action} className="grid gap-3">
      <p className="text-sm leading-6 text-muted-foreground">{support}</p>
      <input type="hidden" name="surface" value={surface} />
      <input type="hidden" name="intent" value="send" />
      <div className="grid gap-2">
        <label htmlFor={`email-prompt-${surface}-email`} className="eyebrow">
          Email
        </label>
        <input
          id={`email-prompt-${surface}-email`}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          defaultValue={state.email ?? ""}
          className={profileInputClass}
          aria-invalid={Boolean(state.errors?.email)}
          aria-describedby={state.errors?.email ? errorId : undefined}
        />
        {state.errors?.email ? (
          <p id={errorId} className="text-sm text-destructive">
            {state.errors.email}
          </p>
        ) : null}
      </div>
      {state.errors?.form ? (
        <StatusBanner tone="warning" title="Email not added">
          {state.errors.form}
        </StatusBanner>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Sending…" : "Send my code"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDismiss}>
          Not now
        </Button>
      </div>
    </form>
  )
}

function CodeStep({
  state,
  action,
  pending,
  surface,
  onChangeEmail,
}: {
  state: EmailPromptState
  action: (payload: FormData) => void
  pending: boolean
  surface: EmailPromptSurface
  onChangeEmail: () => void
}) {
  const inputId = `email-prompt-${surface}-otp`
  const errorId = `${inputId}-error`
  return (
    <div className="grid gap-3">
      <p className="text-sm leading-6 text-muted-foreground">
        Enter the code we sent{state.email ? ` to ${state.email}` : ""}.
      </p>
      <form action={action} className="grid gap-3">
        <input type="hidden" name="surface" value={surface} />
        <input type="hidden" name="intent" value="verify" />
        <div className="grid gap-2">
          <label htmlFor={inputId} className="eyebrow">
            Email code
          </label>
          <CustomerOtpInput
            id={inputId}
            name="otp"
            className={`${profileInputClass} font-mono`}
            aria-invalid={Boolean(state.errors?.otp)}
            aria-describedby={state.errors?.otp ? errorId : undefined}
          />
          {state.errors?.otp ? (
            <p id={errorId} className="text-sm text-destructive">
              {state.errors.otp}
            </p>
          ) : null}
        </div>
        {state.errors?.form ? (
          <StatusBanner tone="warning" title="Email not confirmed">
            {state.errors.form}
          </StatusBanner>
        ) : null}
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Confirming…" : "Confirm email"}
        </Button>
      </form>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <form action={action}>
          <input type="hidden" name="surface" value={surface} />
          <input type="hidden" name="intent" value="resend" />
          <input type="hidden" name="email" value={state.email ?? ""} />
          <Button type="submit" variant="link" size="sm" disabled={pending}>
            Email me a new code
          </Button>
        </form>
        <Button type="button" variant="link" size="sm" onClick={onChangeEmail}>
          Use a different email
        </Button>
      </div>
      <p role="status" className="text-sm text-muted-foreground">
        {state.errors ? "" : (state.message ?? "")}
      </p>
    </div>
  )
}
