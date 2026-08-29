"use client"

import { useState } from "react"
import { ViewIcon, ViewOffSlashIcon } from "@hugeicons/core-free-icons"

import { Icon } from "@/components/brand"
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

  return (
    <FormField
      id={id}
      label={label}
      description={description}
      error={error}
      trailing={
        // A password field with no reveal forces blind typing on a phone
        // keyboard, the biggest single cause of "wrong password" on touch.
        // Passed as `trailing` rather than wrapped around the Input: FormField
        // clones its single child to inject id/aria-describedby/aria-invalid,
        // so a wrapper would swallow that wiring and leave the input unnamed.
        isPassword ? (
          <button
            type="button"
            onClick={() => setRevealed((value) => !value)}
            aria-pressed={revealed}
            aria-controls={id}
            aria-label={revealed ? "Hide password" : "Show password"}
            className="focus-ring absolute top-1/2 right-0.5 grid size-11 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground hover:text-foreground"
          >
            <Icon
              icon={revealed ? ViewOffSlashIcon : ViewIcon}
              size={18}
              aria-hidden="true"
            />
          </button>
        ) : undefined
      }
    >
      {/* Well styling (border, ground, radius, focus/invalid) comes from the
          unlayered [data-slot=input] layer — only layout classes live here. */}
      <Input
        type={isPassword && revealed ? "text" : type}
        className={cn("h-12 text-sm", isPassword && "pr-12", className)}
        {...props}
      />
    </FormField>
  )
}
