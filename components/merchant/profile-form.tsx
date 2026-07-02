"use client"

import { useActionState, useEffect } from "react"

import {
  updateMerchantProfileAction,
  type MerchantProfileState,
} from "@/app/app/profile/actions"
import { Eyebrow } from "@/components/brand"
import { FormField, SelectField, SubmitButton } from "@/components/forms"
import { Input } from "@/components/ui/input"

const businessTypeOptions = [
  { value: "cafe", label: "Cafe" },
  { value: "dessert", label: "Dessert shop" },
  { value: "bubble_tea", label: "Bubble tea" },
  { value: "pub", label: "Pub or bar" },
  { value: "takeaway", label: "Takeaway / quick service" },
  { value: "barber", label: "Barber" },
  { value: "salon", label: "Salon" },
  { value: "other", label: "Other local business" },
]

/**
 * Business/account identity for the signed-in merchant. The business name is
 * the customer-facing merchant name used across cards, QR flows, and receipts.
 * Venue address/GPS details stay in Launch -> Business & venue.
 */
export function MerchantProfileForm({
  businessName,
  businessType,
  email,
  phone,
}: {
  businessName: string
  businessType: string
  email: string
  phone: string
}) {
  const initialState: MerchantProfileState = {
    fields: {
      businessName,
      businessType,
      email,
      phone,
    },
  }
  const [state, action] = useActionState(
    updateMerchantProfileAction,
    initialState
  )
  const fields = state.fields ?? initialState.fields

  // Move focus to the first invalid field after a failed submit so the error is
  // discoverable for keyboard and screen-reader users (errors are otherwise only
  // associated via aria-invalid/aria-describedby). Keyed on `state` because
  // useActionState returns a fresh state object on every dispatch.
  useEffect(() => {
    if (!state.errors) return
    const firstInvalidId = [
      "businessName",
      "businessType",
      "email",
      "phone",
    ].find((key) => state.errors?.[key as keyof typeof state.errors])
    const target = firstInvalidId
      ? document.getElementById(firstInvalidId)
      : null
    if (target instanceof HTMLElement) target.focus()
  }, [state])

  return (
    <form action={action} className="surface-card grid gap-4 p-6">
      <div className="grid gap-1">
        <p className="eyebrow">Business profile</p>
        <p className="text-sm leading-6 text-muted-foreground">
          This is the name customers see on cards, rewards, and QR flows.
        </p>
      </div>
      <Field
        id="businessName"
        name="businessName"
        label="Customer-facing business name"
        defaultValue={fields?.businessName}
        error={state.errors?.businessName}
      />
      <FormField
        id="businessType"
        label={<Eyebrow>Business type</Eyebrow>}
        error={state.errors?.businessType}
      >
        <SelectField
          name="businessType"
          defaultValue={fields?.businessType ?? ""}
        >
          <option value="" disabled>
            Select type
          </option>
          {businessTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectField>
      </FormField>
      <Field
        id="email"
        name="email"
        type="email"
        label="Contact email"
        defaultValue={fields?.email}
        error={state.errors?.email}
      />
      <Field
        id="phone"
        name="phone"
        type="tel"
        label="Phone number"
        defaultValue={fields?.phone}
        error={state.errors?.phone}
      />
      {state.errors?.form ? (
        <p
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {state.errors.form}
        </p>
      ) : null}
      {state.message ? (
        <p
          role="status"
          aria-live="polite"
          className="rounded-xl border border-reward/30 bg-accent px-3 py-2 text-sm text-accent-foreground"
        >
          {state.message}
        </p>
      ) : null}
      <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
    </form>
  )
}

/**
 * Thin composition over the one input story (FormField + the themed slot
 * well) — no private styling or aria wiring lives here. Mirrors AuthField.
 */
function Field({
  id,
  label,
  error,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  id: string
  label: string
  error?: string
}) {
  return (
    <FormField id={id} label={<Eyebrow>{label}</Eyebrow>} error={error}>
      <Input id={id} className="h-12" {...props} />
    </FormField>
  )
}
