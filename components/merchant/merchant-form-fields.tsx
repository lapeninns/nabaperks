"use client"

import { Eyebrow } from "@/components/brand"
import { FormField } from "@/components/forms"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

/** A quiet inline toggle shared by merchant setup forms. */
export function ToggleRow({
  name,
  label,
  hint,
  checked,
  disabled = false,
  onChange,
}: {
  name: string
  label: string
  hint: string
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg bg-secondary px-3 py-3 has-disabled:cursor-wait has-disabled:opacity-70 sm:gap-4 sm:px-4">
      <span className="grid min-w-0 gap-0.5">
        <span className="text-sm font-bold text-foreground">{label}</span>
        <span className="text-xs leading-5 text-muted-foreground">{hint}</span>
      </span>
      <input
        name={name}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="size-5 shrink-0 accent-[var(--w-leaf)]"
      />
    </label>
  )
}

/** The standard themed input composition used by merchant forms. */
export function Field({
  id,
  label,
  hint,
  error,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  id: string
  label: string
  hint?: string
  error?: string
}) {
  return (
    <FormField
      id={id}
      label={<Eyebrow>{label}</Eyebrow>}
      description={hint}
      error={error}
    >
      <Input id={id} className="h-12" {...props} />
    </FormField>
  )
}

export function TextareaField({
  id,
  label,
  hint,
  error,
  rows = 4,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  id: string
  label: string
  hint?: string
  error?: string
}) {
  return (
    <FormField
      id={id}
      label={<Eyebrow>{label}</Eyebrow>}
      description={hint}
      error={error}
    >
      <Textarea id={id} rows={rows} {...props} />
    </FormField>
  )
}
