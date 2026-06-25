"use client"

import { useActionState, useState } from "react"

import {
  updateHomeMarketingConsentAction,
  type MarketingConsentState,
} from "@/app/home/(authed)/profile/actions"
import { Eyebrow, SectionHeader } from "@/components/brand"
import { marketingConsentRowState } from "@/lib/customer/experience/marketing-consent-row"

type MarketingConsent = {
  channel: "email" | "sms" | "whatsapp"
  optedIn: boolean
}

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
] as const

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
  const hasAnyConsent = consents.length > 0

  return (
    <section className="surface-card grid gap-4 p-5">
      <SectionHeader eyebrow="Marketing" title="Updates from your venues" />
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
    </section>
  )
}

function MarketingChannelRow({
  channel,
  label,
  helper,
  optedIn,
}: {
  channel: MarketingConsent["channel"]
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
        <p
          role="status"
          aria-live="polite"
          className={
            !message
              ? "sr-only"
              : state.error
                ? "text-sm font-bold text-destructive"
                : "text-sm font-bold text-foreground"
          }
        >
          {message}
        </p>
      </div>
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
          className="size-5 shrink-0 accent-primary disabled:opacity-60"
        />
      </label>
    </form>
  )
}
