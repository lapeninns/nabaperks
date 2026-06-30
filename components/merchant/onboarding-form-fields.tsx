"use client"

import type { InputHTMLAttributes, ReactNode } from "react"

export const onboardingInputClassName =
  "h-12 rounded-lg border-2 border-ink bg-background px-4 text-sm outline-none transition-[border-color,box-shadow] duration-[var(--w-dur-fast)] ease-[var(--w-ease)] motion-reduce:transition-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/35"

export type BusinessTypeOption = {
  readonly value: string
  readonly label: string
}

export function OnboardingField({
  id,
  label,
  error,
  required,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  readonly id: string
  readonly label: string
  readonly error?: string
}) {
  return (
    <div className="grid gap-2">
      <RequiredLabel htmlFor={id} required={required}>
        {label}
      </RequiredLabel>
      <input
        id={id}
        className={onboardingInputClassName}
        required={required}
        aria-required={required || undefined}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      />
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
      <select
        id="businessType"
        name="businessType"
        required
        aria-required="true"
        defaultValue={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        className={onboardingInputClassName}
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
      </select>
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
      role="alert"
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
    <p id={`${id}-error`} className="text-sm text-destructive">
      {error}
    </p>
  ) : null
}
