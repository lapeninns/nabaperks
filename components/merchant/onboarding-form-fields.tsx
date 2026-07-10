"use client"

import type { InputHTMLAttributes, ReactNode } from "react"

import { SelectField } from "@/components/forms"
import { Input } from "@/components/ui/input"

/**
 * One input story: the well (2px ink border, card ground, focus and invalid
 * states) comes from the themed `[data-slot=input]` layer — callers add
 * layout only. Kept as an export because onboarding-form passes it into
 * VenueAddressFields.
 */
export const onboardingInputClassName = "h-12 text-sm"

export type BusinessTypeOption = {
  readonly value: string
  readonly label: string
}

export function OnboardingField({
  id,
  label,
  error,
  hint,
  required,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  readonly id: string
  readonly label: string
  readonly error?: string
  readonly hint?: string
}) {
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined

  return (
    <div className="grid gap-2">
      <RequiredLabel htmlFor={id} required={required}>
        {label}
      </RequiredLabel>
      <Input
        id={id}
        className={onboardingInputClassName}
        required={required}
        aria-required={required || undefined}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        {...props}
      />
      {hint ? (
        <p id={hintId} className="text-xs leading-5 text-muted-foreground">
          {hint}
        </p>
      ) : null}
      <FieldError id={id} error={error} />
    </div>
  )
}

export function BusinessTypeField({
  error,
  value,
  options,
  onChange,
}: {
  readonly error?: string
  readonly value?: string
  readonly options: readonly BusinessTypeOption[]
  readonly onChange: (value: string) => void
}) {
  return (
    <div className="grid gap-2">
      <RequiredLabel htmlFor="businessType" required>
        Business type
      </RequiredLabel>
      <SelectField
        id="businessType"
        name="businessType"
        required
        aria-required="true"
        defaultValue={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? "businessType-error" : undefined}
      >
        <option value="" disabled>
          Select type
        </option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </SelectField>
      <FieldError id="businessType" error={error} />
    </div>
  )
}

export function OnboardingFormError({
  children,
}: {
  readonly children: ReactNode
}) {
  return (
    <p
      id="onboarding-form-error"
      role="alert"
      tabIndex={-1}
      className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      {children}
    </p>
  )
}

function RequiredLabel({
  htmlFor,
  required,
  children,
}: {
  readonly htmlFor: string
  readonly required?: boolean
  readonly children: ReactNode
}) {
  return (
    <label htmlFor={htmlFor} className="eyebrow">
      {children}
      {required ? (
        <>
          {" "}
          <span aria-hidden="true" className="text-destructive">
            *
          </span>
          <span className="sr-only"> (required)</span>
        </>
      ) : null}
    </label>
  )
}

function FieldError({
  id,
  error,
}: {
  readonly id: string
  readonly error?: string
}) {
  return error ? (
    <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
      {error}
    </p>
  ) : null
}
