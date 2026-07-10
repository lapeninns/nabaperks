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

  return (
    <section
      id={id}
      aria-label="Password requirements"
      className={cn(
        "grid gap-2 rounded-xl border border-dashed px-3 py-2.5 transition-[border-color,background-color] duration-[var(--w-dur-fast)] ease-[var(--w-ease)] motion-reduce:transition-none",
        allMet
          ? "border-reward/40 bg-reward/8"
          : "border-ink/20 bg-secondary/40",
        className
      )}
    >
      <ul className="grid gap-1.5 sm:grid-cols-3">
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
        {allMet
          ? "Password meets all 3 rules"
          : `Password meets ${metCount} of ${RULE_COUNT} rules`}
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
        "flex min-h-9 items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs leading-4 font-semibold",
        met
          ? "border-ink bg-stamp text-stamp-foreground"
          : "border-dashed border-ink/30 bg-card text-muted-foreground"
      )}
    >
      <span className="sr-only">{met ? "Met: " : "Not met: "}</span>
      <span
        aria-hidden="true"
        className="grid size-4 shrink-0 place-items-center rounded-full border border-current"
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
