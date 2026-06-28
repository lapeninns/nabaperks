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
      <Input
        id={id}
        className={cn(
          "h-12 rounded-xl border-2 border-ink bg-secondary/60 px-4 text-sm",
          className
        )}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      />
    </FormField>
  )
}
