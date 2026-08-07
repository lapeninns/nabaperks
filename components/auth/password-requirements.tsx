"use client"

import { useEffect, useState } from "react"
import { Tick02Icon } from "@hugeicons/core-free-icons"

import { Icon } from "@/components/brand"
import {
  allPasswordRequirementsMet,
  passwordRequirements,
  type PasswordRequirements as PasswordRequirementsState,
} from "@/lib/auth/password"
import { cn } from "@/lib/utils"

type PasswordRequirementsProps = {
  readonly id: string
  readonly password: string
  readonly className?: string
}

const REQUIREMENT_ITEMS = [
  { key: "minLength", label: "8 or more characters" },
  { key: "hasLetter", label: "At least one letter" },
  { key: "hasDigit", label: "At least one number" },
] as const satisfies ReadonlyArray<{
  readonly key: keyof PasswordRequirementsState
  readonly label: string
}>

const RULE_COUNT = REQUIREMENT_ITEMS.length

export function PasswordRequirements({
  id,
  password,
  className,
}: PasswordRequirementsProps) {
  const requirements = passwordRequirements(password)
  const metCount = REQUIREMENT_ITEMS.filter(
    ({ key }) => requirements[key]
  ).length
  const allMet = allPasswordRequirementsMet(requirements)

  const summary = allMet
    ? "Password meets all 3 rules"
    : `Password meets ${metCount} of ${RULE_COUNT} rules`

  // The live region previously recomputed on every keystroke, so a screen
  // reader announced "Password meets 1 of 3 rules" once per character typed —
  // a running commentary that drowns out the field itself. Announce only once
  // the user pauses; the visual chips still update immediately.
  const [announced, setAnnounced] = useState(summary)

  useEffect(() => {
    const timer = window.setTimeout(() => setAnnounced(summary), 600)
    return () => window.clearTimeout(timer)
  }, [summary])

  return (
    <section
      id={id}
      aria-label="Password requirements"
      className={cn("grid gap-1", className)}
    >
      <ul className="flex flex-wrap gap-x-3 gap-y-0.5">
        {REQUIREMENT_ITEMS.map(({ key, label }) => (
          <RequirementItem key={key} met={requirements[key]} label={label} />
        ))}
      </ul>
      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={cn(
          "mono-id text-right",
          allMet ? "text-reward" : "text-muted-foreground"
        )}
      >
        {/* aria-hidden copy is the immediate visual readout; the live region
            below carries the debounced announcement. */}
        <span aria-hidden="true">{summary}</span>
        <span className="sr-only">{announced}</span>
      </p>
    </section>
  )
}

function RequirementItem({
  met,
  label,
}: {
  readonly met: boolean
  readonly label: string
}) {
  return (
    <li
      className={cn(
        "inline-flex items-center gap-1.5 text-xs leading-5 font-medium transition-colors duration-[var(--w-dur-fast)] ease-[var(--w-ease)] motion-reduce:transition-none",
        met ? "text-reward" : "text-muted-foreground"
      )}
    >
      <span className="sr-only">{met ? "Met: " : "Not met: "}</span>
      <span
        aria-hidden="true"
        className={cn(
          "grid size-4 shrink-0 place-items-center rounded-full border",
          met ? "border-reward bg-reward/10" : "border-current"
        )}
      >
        {met ? (
          <Icon icon={Tick02Icon} size={10} strokeWidth={2.5} aria-hidden />
        ) : (
          <span className="size-1 rounded-full bg-current" />
        )}
      </span>
      <span>{label}</span>
    </li>
  )
}
