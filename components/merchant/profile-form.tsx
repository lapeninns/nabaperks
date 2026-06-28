"use client"

import { useActionState, useEffect } from "react"

import {
  updateMerchantProfileAction,
  type MerchantProfileState,
} from "@/app/app/profile/actions"
import { Button } from "@/components/ui/button"

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
  const [state, action, pending] = useActionState(
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
    const firstInvalidId = ["businessName", "businessType", "email", "phone"].find(
      (key) => state.errors?.[key as keyof typeof state.errors]
    )
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
      <div className="grid gap-2">
        <label htmlFor="businessType" className="eyebrow">
          Business type
        </label>
        <select
          id="businessType"
          name="businessType"
          defaultValue={fields?.businessType ?? ""}
          className="h-12 rounded-xl border-2 border-ink bg-secondary/60 px-4 text-sm transition-[border-color,box-shadow] duration-[var(--w-dur-fast)] ease-[var(--w-ease)] outline-none motion-reduce:transition-none focus:border-ring focus:ring-3 focus:ring-ring/25"
          aria-invalid={Boolean(state.errors?.businessType)}
          aria-describedby={
            state.errors?.businessType ? "businessType-error" : undefined
          }
        >
          <option value="" disabled>
            Select type
          </option>
          {businessTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {state.errors?.businessType ? (
          <p id="businessType-error" className="text-sm text-destructive">
            {state.errors.businessType}
          </p>
        ) : null}
      </div>
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
      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Save changes"}
      </Button>
    </form>
  )
}

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
    <div className="grid gap-2">
      <label htmlFor={id} className="eyebrow">
        {label}
      </label>
      <input
        id={id}
        className="h-12 rounded-xl border-2 border-ink bg-secondary/60 px-4 text-sm transition-[border-color,box-shadow] duration-[var(--w-dur-fast)] ease-[var(--w-ease)] outline-none motion-reduce:transition-none focus:border-ring focus:ring-3 focus:ring-ring/25"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      />
      {error ? (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
