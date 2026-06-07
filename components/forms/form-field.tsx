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
  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {children}
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      {error ? <FormMessage>{error}</FormMessage> : null}
    </Field>
  )
}

export function FormMessage({ children }: { children: ReactNode }) {
  return <FieldError>{children}</FieldError>
}
