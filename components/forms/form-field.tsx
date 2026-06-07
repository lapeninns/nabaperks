"use client"

import type { ReactNode } from "react"

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"

export function FormField({
  id,
  label,
  description,
  error,
  children,
}: {
  id: string
  label: ReactNode
  description?: ReactNode
  error?: ReactNode
  children: ReactNode
}) {
  const descriptionId = description ? `${id}-description` : undefined
  const errorId = error ? `${id}-error` : undefined

  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {children}
      {description ? (
        <FieldDescription id={descriptionId}>{description}</FieldDescription>
      ) : null}
      {error ? <FormMessage id={errorId}>{error}</FormMessage> : null}
    </Field>
  )
}

export function FormMessage({
  id,
  children,
}: {
  id?: string
  children: ReactNode
}) {
  return <FieldError id={id}>{children}</FieldError>
}
