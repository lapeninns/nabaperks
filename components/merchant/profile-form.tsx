"use client"

import { useActionState } from "react"

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
 * Business/account identity for the signed-in merchant. Venue name and address
 * are edited in Launch -> Your venue (the single venue editor), so this form
 * deliberately does not carry them.
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

  return (
    <form action={action} className="surface-card grid gap-4 p-6">
      <p className="eyebrow">Business</p>
      <Field
        id="businessName"
        name="businessName"
        label="Business name"
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
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.errors.form}
        </p>
      ) : null}
      {state.message ? (
        <p className="rounded-xl border border-reward/30 bg-accent px-3 py-2 text-sm text-accent-foreground">
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
