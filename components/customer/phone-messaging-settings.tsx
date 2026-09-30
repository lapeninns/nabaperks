"use client"

import { useActionState } from "react"

import {
  updateHomePhoneMessagingAction,
  type PhoneMessagingState,
} from "@/app/home/(authed)/profile/actions"
import { SectionHeader } from "@/components/brand"
import { FormField } from "@/components/forms/form-field"
import { SelectField } from "@/components/forms/select-field"
import { SubmitButton } from "@/components/forms/submit-button"
import type { PhoneMessagingPreferences } from "@/lib/customer/profile"

const initialState: PhoneMessagingState = {}
const CHANNEL_LABEL = {
  whatsapp: "WhatsApp",
  sms: "Text message",
} as const

/**
 * Reminders about stamps and rewards by phone (not offers, which are the
 * marketing toggles). One switch, and the WhatsApp-or-text choice only while
 * reminders are on: with them off there is nothing for the choice to steer.
 * `embedded` drops the card and header inside "Messages from venues".
 */
export function PhoneMessagingSettings({
  preferences,
  embedded = false,
}: {
  readonly preferences: PhoneMessagingPreferences | null
  readonly embedded?: boolean
}) {
  const [state, action, pending] = useActionState(
    updateHomePhoneMessagingAction,
    initialState
  )

  return (
    <section
      className={embedded ? "grid gap-4" : "surface-card grid gap-4 p-5"}
      aria-label="Reminders by phone"
    >
      {embedded ? (
        <h3 className="eyebrow">Reminders by phone</h3>
      ) : (
        <SectionHeader eyebrow="Reminders" title="WhatsApp or text" />
      )}
      <p className="text-sm leading-6 text-muted-foreground">
        Reminders about your stamps and rewards. Offers depend on your choices
        above. Reply STOP to switch these off.
      </p>
      {preferences ? (
        <>
          <div className="grid gap-1 text-sm" aria-live="polite">
            <p className="font-bold">
              Reminders: {preferences.phoneMessagesEnabled ? "On" : "Off"}
            </p>
            {preferences.phoneMessagesEnabled ? (
              <p>Sent by {CHANNEL_LABEL[preferences.preferredPhoneChannel]}</p>
            ) : null}
            {preferences.phoneMessagesEnabled &&
            preferences.preferredPhoneChannel === "whatsapp" &&
            preferences.whatsappUnavailableAt ? (
              <p className="text-muted-foreground">
                WhatsApp isn&apos;t reaching your number just now. Reminders can
                go by text instead.
              </p>
            ) : null}
          </div>
          <form action={action} className="grid gap-4">
            <fieldset
              key={`${preferences.phoneMessagesEnabled}:${preferences.preferredPhoneChannel}`}
              disabled={pending}
              className="grid min-w-0 gap-4"
            >
              <legend className="sr-only">Reminders by phone</legend>
              <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4 text-sm font-bold">
                Send me reminders by phone
                <input
                  name="phoneMessagesEnabled"
                  type="checkbox"
                  defaultChecked={preferences.phoneMessagesEnabled}
                  className="focus-ring size-5 shrink-0 accent-primary disabled:opacity-60"
                />
              </label>
              {preferences.phoneMessagesEnabled ? (
                <FormField id="preferred-phone-channel" label="Send them by">
                  <SelectField
                    name="preferredPhoneChannel"
                    defaultValue={preferences.preferredPhoneChannel}
                  >
                    <option value="whatsapp">WhatsApp</option>
                    <option value="sms">Text message</option>
                  </SelectField>
                </FormField>
              ) : (
                // The standing choice is kept while reminders are off.
                <input
                  type="hidden"
                  name="preferredPhoneChannel"
                  value={preferences.preferredPhoneChannel}
                />
              )}
            </fieldset>
            <SubmitButton pendingLabel="Saving…">Save reminders</SubmitButton>
            <p
              role="status"
              aria-live="polite"
              className={state.error ? "text-sm text-destructive" : "text-sm"}
            >
              {state.error ?? state.message}
            </p>
          </form>
        </>
      ) : (
        <p role="status" className="text-sm text-muted-foreground">
          We couldn&apos;t load your reminders. Reload to try again.
        </p>
      )}
    </section>
  )
}
