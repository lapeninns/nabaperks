"use client"

import { useActionState, useState } from "react"

import {
  updateHomeMarketingConsentAction,
  type MarketingConsentState,
} from "@/app/home/(authed)/profile/actions"
import { Eyebrow } from "@/components/brand"
import {
  marketingConsentRowState,
  type DisplayMarketingChannel,
} from "@/lib/customer/experience/marketing-consent-row"

const CHANNEL_COPY = {
  email: {
    label: "Email",
    helper: "Reward updates and offers by email.",
  },
  sms: {
    label: "SMS",
    helper: "Occasional offers by text message.",
  },
  whatsapp: {
    label: "WhatsApp",
    helper: "Updates and offers on WhatsApp.",
  },
} as const satisfies Record<
  DisplayMarketingChannel,
  { label: string; helper: string }
>

const initialState: MarketingConsentState = {}

/**
 * The profile's marketing toggles, one per channel the wallet can choose. Each
 * posts on change (no Save button). The page revalidates after a save, and each
 * row is keyed by the server's standing value so a successful change
 * re-renders the toggle from server truth. Each row gives a quiet, polite
 * confirmation and reflects the switch from server truth so a failed or
 * refused save snaps the toggle back instead of leaving it contradicting the
 * message.
 */
export function CustomerProfileMarketingRows({
  channels,
  optedInByChannel,
}: {
  channels: readonly DisplayMarketingChannel[]
  optedInByChannel: Partial<Record<DisplayMarketingChannel, boolean>>
}) {
  return (
    <ul className="grid gap-3">
      {channels.map((channel) => {
        const optedIn = optedInByChannel[channel] ?? false
        return (
          <li key={`${channel}:${optedIn}`}>
            <MarketingChannelRow
              channel={channel}
              label={CHANNEL_COPY[channel].label}
              helper={CHANNEL_COPY[channel].helper}
              optedIn={optedIn}
            />
          </li>
        )
      })}
    </ul>
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
