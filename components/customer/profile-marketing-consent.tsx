"use client"

import { useActionState, useState } from "react"

import {
  updateHomeMarketingConsentAction,
  type MarketingConsentState,
} from "@/app/home/(authed)/profile/actions"
import { Eyebrow } from "@/components/brand"
import { ProfileSection } from "@/components/customer/profile-section"
import { marketingConsentRowState } from "@/lib/customer/experience/marketing-consent-row"

type MarketingConsent = {
  channel: "email" | "sms" | "whatsapp" | "push"
  optedIn: boolean
}

type DisplayMarketingChannel = Exclude<MarketingConsent["channel"], "push">

const CHANNELS = [
  {
    channel: "email",
    label: "Email",
    helper: "Reward updates and offers by email.",
  },
  {
    channel: "sms",
    label: "SMS",
    helper: "Occasional offers by text message.",
  },
  {
    channel: "whatsapp",
    label: "WhatsApp",
    helper: "Updates and offers on WhatsApp.",
  },
] as const satisfies readonly {
  channel: DisplayMarketingChannel
  label: string
  helper: string
}[]

const initialState: MarketingConsentState = {}

/**
 * Global marketing preferences for the signed-in customer. One toggle per channel
 * applies across every venue; each posts on change (no Save button). The page
 * revalidates after a save, and each row is keyed by the server's standing value
 * so a successful change re-renders the toggle from server truth. Each row gives a
 * quiet, polite confirmation and reflects the switch from server truth so a failed
 * save snaps the toggle back instead of leaving it contradicting the message.
 */
export function CustomerProfileMarketing({
  consents,
}: {
  consents: readonly MarketingConsent[]
}) {
  const optedInByChannel = new Map(
    consents.map((consent) => [consent.channel, consent.optedIn])
  )
  const hasAnyConsent = CHANNELS.some((entry) =>
    optedInByChannel.has(entry.channel)
  )

  return (
    <ProfileSection
      title="Updates from your venues"
      hint={marketingHint(optedInByChannel)}
      className="grid gap-4"
    >
      <p className="text-sm leading-6 text-muted-foreground">
        Optional. Turning these off won&apos;t affect stamps or rewards.
      </p>

      <ul className="grid gap-3">
        {CHANNELS.map((entry) => {
          const optedIn = optedInByChannel.get(entry.channel) ?? false
          return (
            <li key={`${entry.channel}:${optedIn}`}>
              <MarketingChannelRow
                channel={entry.channel}
                label={entry.label}
                helper={entry.helper}
                optedIn={optedIn}
              />
            </li>
          )
        })}
      </ul>

      {!hasAnyConsent ? (
        <p className="text-xs leading-5 text-muted-foreground">
          You choose this when you join a venue — change it here any time.
        </p>
      ) : null}
    </ProfileSection>
  )
}

function MarketingChannelRow({
  channel,
  label,
  helper,
  optedIn,
}: {
  channel: DisplayMarketingChannel
  label: string
  helper: string
  optedIn: boolean
}) {
  const [state, action, pending] = useActionState(
    updateHomeMarketingConsentAction,
    initialState
  )
  // The value the customer just chose, shown while the save is in flight so the
  // switch stays responsive; the server result (success or reverted failure)
  // takes over once the action resolves.
  const [optimistic, setOptimistic] = useState(optedIn)

  const { checked, message } = marketingConsentRowState({
    channel,
    optedIn,
    pending,
    state,
  })
  const displayChecked = pending ? optimistic : checked

  return (
    <form action={action} className="flex items-start justify-between gap-4">
      <input type="hidden" name="channel" value={channel} />
      <div className="grid gap-1">
        <Eyebrow>{label}</Eyebrow>
        <p className="text-sm leading-6 text-muted-foreground">{helper}</p>
        {/* The announcement stays here for assistive tech (it is adjacent to
            the label that names the channel), but it is visually hidden — the
            SIGHTED response now sits beside the control that caused it, below.
            A confirmation rendering in the description column reads as body
            copy, not as an answer to "did that save?". */}
        <p role="status" aria-live="polite" className="sr-only">
          {message}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {/* State at the point of interaction: SAVING… while the action is in
            flight, then the outcome, on the trailing edge of the switch. */}
        <span
          aria-hidden="true"
          className={
            pending
              ? "mono-id text-muted-foreground"
              : message
                ? state.error
                  ? "mono-id text-destructive"
                  : "mono-id text-reward"
                : "sr-only"
          }
        >
          {pending ? "Saving…" : state.error ? "Not saved" : "Saved"}
        </span>
        <label className="-m-3 mt-0.5 inline-flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center p-3">
          <span className="sr-only">Receive {label} updates</span>
          <input
            type="checkbox"
            name="optedIn"
            checked={displayChecked}
            disabled={pending}
            onChange={(event) => {
              setOptimistic(event.currentTarget.checked)
              event.currentTarget.form?.requestSubmit()
            }}
            className="ink-check focus-ring shrink-0 disabled:opacity-60"
          />
        </label>
      </div>
    </form>
  )
}

/** Collapsed-row summary: which channels are on, without opening the section. */
function marketingHint(
  optedInByChannel: Map<MarketingConsent["channel"], boolean>
) {
  const on = CHANNELS.filter(
    (entry) => optedInByChannel.get(entry.channel) ?? false
  )

  if (!on.length) return "All off"
  if (on.length === CHANNELS.length) return "All on"
  return `${on.map((entry) => entry.label).join(", ")} on`
}
