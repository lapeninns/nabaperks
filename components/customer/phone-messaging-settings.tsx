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
  sms: "Text message (SMS)",
} as const

export function PhoneMessagingSettings({
  preferences,
}: {
  readonly preferences: PhoneMessagingPreferences | null
}) {
  const [state, action, pending] = useActionState(
    updateHomePhoneMessagingAction,
    initialState
  )

  return (
    <section
      className="surface-card grid gap-4 p-5"
      aria-label="Phone messages"
    >
      <SectionHeader eyebrow="Phone messages" title="WhatsApp or text" />
      <p className="text-sm leading-6 text-muted-foreground">
        Choose how to receive reward updates and reminders. Offers still depend
        on your marketing choices above. Reply STOP to switch phone messages
        off.
      </p>
      {preferences ? (
        <>
          <div className="grid gap-1 text-sm" aria-live="polite">
            <p className="font-bold">
              Phone messages: {preferences.phoneMessagesEnabled ? "On" : "Off"}
            </p>
            <p>
              Preferred channel:{" "}
              {CHANNEL_LABEL[preferences.preferredPhoneChannel]}
            </p>
            {preferences.phoneMessagesEnabled &&
            preferences.preferredPhoneChannel === "whatsapp" &&
            preferences.whatsappUnavailableAt ? (
              <p className="text-muted-foreground">
                WhatsApp is currently unavailable for your number. Messages can
                use text instead.
              </p>
            ) : null}
          </div>
          <form action={action} className="grid gap-4">
            <fieldset
              key={`${preferences.phoneMessagesEnabled}:${preferences.preferredPhoneChannel}`}
              disabled={pending}
              className="grid min-w-0 gap-4"
            >
              <legend className="sr-only">Phone message preferences</legend>
              <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4 text-sm font-bold">
                Receive phone messages
                <input
                  name="phoneMessagesEnabled"
                  type="checkbox"
                  defaultChecked={preferences.phoneMessagesEnabled}
                  className="focus-ring size-5 shrink-0 accent-primary disabled:opacity-60"
                />
              </label>
              <FormField id="preferred-phone-channel" label="Preferred channel">
                <SelectField
                  name="preferredPhoneChannel"
                  defaultValue={preferences.preferredPhoneChannel}
                >
                  <option value="whatsapp">WhatsApp</option>
                  <option value="sms">Text message (SMS)</option>
                </SelectField>
              </FormField>
            </fieldset>
            <SubmitButton pendingLabel="Saving…">
              Save phone preferences
            </SubmitButton>
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
          We couldn&apos;t load your phone preferences. Reload to try again.
        </p>
      )}
    </section>
  )
}
