"use client"

import { useActionState, useEffect, useRef } from "react"

import {
  completeOnboardingAction,
  type OnboardingActionState,
} from "@/app/app/onboarding/actions"
import { Eyebrow, VenueMark } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const initialState: OnboardingActionState = {}
const draftStorageKey = "nabaperks:onboarding-draft"

type OnboardingDraft = NonNullable<OnboardingActionState["fields"]>

export function OnboardingForm({
  className,
  initialFields = {},
}: {
  className?: string
  initialFields?: OnboardingDraft
}) {
  const hasInitialFields = Object.values(initialFields).some(Boolean)
  const [state, action, pending] = useActionState(
    completeOnboardingAction,
    hasInitialFields ? { ...initialState, fields: initialFields } : initialState
  )
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    try {
      const savedDraft = window.localStorage.getItem(draftStorageKey)
      const draft = savedDraft ? (JSON.parse(savedDraft) as OnboardingDraft) : {}
      const form = formRef.current
      if (!form || Object.values(state.fields ?? {}).some(Boolean)) return

      restoreField(form, "businessName", draft.businessName)
      restoreField(form, "businessType", draft.businessType)
      restoreField(form, "locationName", draft.locationName)
      restoreField(form, "phone", draft.phone)
    } catch {
      window.localStorage.removeItem(draftStorageKey)
    }
  }, [state.fields])

  function updateDraft(field: keyof OnboardingDraft, value: string) {
    try {
      const currentDraft = JSON.parse(
        window.localStorage.getItem(draftStorageKey) ?? "{}"
      ) as OnboardingDraft
      const nextDraft: OnboardingDraft = {
        ...initialFields,
        ...currentDraft,
        [field]: value,
      }
      window.localStorage.setItem(draftStorageKey, JSON.stringify(nextDraft))
    } catch {
      window.localStorage.removeItem(draftStorageKey)
    }
  }

  return (
    <form
      ref={formRef}
      action={action}
      className={cn(
        "surface-card grid gap-4 p-6",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <VenueMark name="Nabaperks" size={48} />
        <Eyebrow>Merchant setup</Eyebrow>
      </div>
      <hr className="w-rule" />
      <Field
        id="businessName"
        label="Business name"
        name="businessName"
        defaultValue={state.fields?.businessName}
        onChange={(event) => updateDraft("businessName", event.target.value)}
        error={state.errors?.businessName}
      />
      <div className="grid gap-2">
        <label htmlFor="businessType" className="eyebrow">
          Business type
        </label>
        <select
          id="businessType"
          name="businessType"
          defaultValue={state.fields?.businessType ?? ""}
          onChange={(event) => updateDraft("businessType", event.target.value)}
          className="h-12 rounded-xl border-2 border-ink bg-secondary/60 px-4 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/25"
          aria-invalid={Boolean(state.errors?.businessType)}
          aria-describedby={
            state.errors?.businessType ? "businessType-error" : undefined
          }
        >
          <option value="" disabled>
            Select type
          </option>
          <option value="cafe">Cafe</option>
          <option value="dessert">Dessert shop</option>
          <option value="bubble_tea">Bubble tea</option>
          <option value="pub">Pub or bar</option>
          <option value="takeaway">Takeaway / quick service</option>
          <option value="barber">Barber</option>
          <option value="salon">Salon</option>
          <option value="other">Other local business</option>
        </select>
        {state.errors?.businessType ? (
          <p id="businessType-error" className="text-sm text-destructive">
            {state.errors.businessType}
          </p>
        ) : null}
      </div>
      <Field
        id="locationName"
        label="First location name"
        name="locationName"
        defaultValue={state.fields?.locationName}
        onChange={(event) => updateDraft("locationName", event.target.value)}
        error={state.errors?.locationName}
      />
      <Field
        id="phone"
        label="Phone number"
        name="phone"
        type="tel"
        defaultValue={state.fields?.phone}
        onChange={(event) => updateDraft("phone", event.target.value)}
      />
      {state.errors?.form ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.errors.form}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Saving..." : "Finish setup"}
      </Button>
    </form>
  )
}

function restoreField(
  form: HTMLFormElement,
  fieldName: keyof OnboardingDraft,
  value?: string
) {
  const field = form.elements.namedItem(fieldName)
  if (!value || !(field instanceof HTMLInputElement || field instanceof HTMLSelectElement)) {
    return
  }

  field.value = value
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
        className="h-12 rounded-xl border-2 border-ink bg-secondary/60 px-4 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/25"
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
