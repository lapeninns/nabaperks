"use client"

import { Eyebrow } from "@/components/brand"
import { FormField } from "@/components/forms/form-field"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export function AuthField({
  id,
  label,
  description,
  error,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  id: string
  label: string
  description?: string
  error?: string
}) {
  return (
    <FormField
      id={id}
      label={<Eyebrow>{label}</Eyebrow>}
      description={description}
      error={error}
    >
      {/* Well styling (border, ground, radius, focus/invalid) comes from the
          unlayered [data-slot=input] layer — only layout classes live here.
          Aria wiring comes from FormField, which injects aria-describedby
          covering BOTH the description (e.g. the password rules hint) and the
          error id, plus aria-invalid — no manual duplicates here. */}
      <Input id={id} className={cn("h-12 text-sm", className)} {...props} />
    </FormField>
  )
}
