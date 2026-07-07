import { Tick02Icon } from "@hugeicons/core-free-icons"

import { Icon } from "@/components/brand"
import {
  allPasswordRequirementsMet,
  passwordRequirements,
  type PasswordRequirements as PasswordRequirementsState,
} from "@/lib/auth/password"
import { cn } from "@/lib/utils"

type PasswordRequirementsProps = {
  readonly password: string
  readonly className?: string
}

const REQUIREMENT_ITEMS = [
  { key: "minLength", label: "8+", title: "At least 8 characters" },
  { key: "hasLowercase", label: "a-z", title: "Lowercase letter" },
  { key: "hasUppercase", label: "A-Z", title: "Uppercase letter" },
  { key: "hasDigit", label: "0-9", title: "Number" },
  { key: "hasSymbol", label: "!@#", title: "Symbol" },
] as const satisfies ReadonlyArray<{
  readonly key: keyof PasswordRequirementsState
  readonly label: string
  readonly title: string
}>

const RULE_COUNT = REQUIREMENT_ITEMS.length

export function PasswordRequirements({
  password,
  className,
}: PasswordRequirementsProps) {
  const requirements = passwordRequirements(password)
  const metCount = REQUIREMENT_ITEMS.filter(({ key }) => requirements[key]).length
  const allMet = allPasswordRequirementsMet(requirements)

  return (
    <section
      aria-label="Password rules"
      className={cn(
        "flex flex-wrap items-center gap-1.5 rounded-xl border border-dashed px-2.5 py-2 transition-[border-color,background-color] duration-[var(--w-dur-fast)] ease-[var(--w-ease)] motion-reduce:transition-none",
        allMet
          ? "border-reward/40 bg-reward/8"
          : "border-ink/20 bg-secondary/40",
        className
      )}
    >
      <ul className="flex flex-wrap items-center gap-1.5">
        {REQUIREMENT_ITEMS.map(({ key, label, title }) => (
          <RequirementChip
            key={key}
            met={requirements[key]}
            label={label}
            title={title}
          />
        ))}
      </ul>
      <span
        className={cn(
          "mono-id ml-auto shrink-0",
          allMet ? "text-reward" : "text-muted-foreground"
        )}
        aria-live="polite"
      >
        {metCount}/{RULE_COUNT}
      </span>
    </section>
  )
}

function RequirementChip({
  met,
  label,
  title,
}: {
  readonly met: boolean
  readonly label: string
  readonly title: string
}) {
  return (
    <li>
      <span
        title={title}
        className={cn(
          "inline-flex min-h-6 items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.65rem] font-bold tracking-wide uppercase transition-[border-color,background-color,color] duration-[var(--w-dur-fast)] ease-[var(--w-ease)] motion-reduce:transition-none",
          met
            ? "border-ink bg-stamp text-stamp-foreground"
            : "border-dashed border-ink/30 bg-card text-muted-foreground"
        )}
      >
        {met ? (
          <Icon icon={Tick02Icon} size={10} strokeWidth={2.5} aria-hidden />
        ) : null}
        <span>{label}</span>
        <span className="sr-only">
          {title}
          {met ? ", met" : ", not met yet"}
        </span>
      </span>
    </li>
  )
}

export { allPasswordRequirementsMet }
