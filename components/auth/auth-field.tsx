"use client"

import { useId, useState } from "react"
import { ViewIcon, ViewOffSlashIcon } from "@hugeicons/core-free-icons"

import { Eyebrow, Icon } from "@/components/brand"
import { FormField } from "@/components/forms/form-field"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export function AuthField({
  id,
  label,
  description,
  error,
  className,
  type,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  id: string
  label: string
  description?: string
  error?: string
}) {
  const [revealed, setRevealed] = useState(false)
  const isPassword = type === "password"
  const toggleId = useId()

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
      {isPassword ? (
        // A password field with no reveal forces blind typing on a phone
        // keyboard, which is the single biggest cause of "wrong password" on
        // touch. The toggle is a real button inside the well, so the field
        // keeps one focus ring via .focus-ring-within.
        <span className="focus-ring-within relative block min-w-0 rounded-lg">
          <Input
            id={id}
            type={revealed ? "text" : "password"}
            className={cn("h-12 pr-12 text-sm", className)}
            {...props}
          />
          <button
            type="button"
            id={toggleId}
            onClick={() => setRevealed((value) => !value)}
            aria-pressed={revealed}
            aria-controls={id}
            aria-label={revealed ? "Hide password" : "Show password"}
            className="absolute top-1/2 right-1 grid size-10 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground hover:text-foreground"
          >
            <Icon
              icon={revealed ? ViewOffSlashIcon : ViewIcon}
              size={18}
              aria-hidden="true"
            />
          </button>
        </span>
      ) : (
        <Input
          id={id}
          type={type}
          className={cn("h-12 text-sm", className)}
          {...props}
        />
      )}
    </FormField>
  )
}
