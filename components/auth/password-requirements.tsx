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
  { key: "minLength", label: "8+", tip: "At least 8 characters" },
  { key: "hasLowercase", label: "a-z", tip: "Include a lowercase letter (a–z)" },
  { key: "hasUppercase", label: "A-Z", tip: "Include an uppercase letter (A–Z)" },
  { key: "hasDigit", label: "0-9", tip: "Include a number (0–9)" },
  {
    key: "hasSymbol",
    label: "!@#",
    tip: "Include a symbol, such as ! @ # $ % & *",
  },
] as const satisfies ReadonlyArray<{
  readonly key: keyof PasswordRequirementsState
  readonly label: string
  readonly tip: string
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
        {REQUIREMENT_ITEMS.map(({ key, label, tip }) => (
          <RequirementChip
            key={key}
            met={requirements[key]}
            label={label}
            tip={tip}
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
  tip,
}: {
  readonly met: boolean
  readonly label: string
  readonly tip: string
}) {
  const statusLabel = met ? "Met" : "Not met yet"

  return (
    <li className="group/chip relative">
      <span
        className={cn(
          "inline-flex min-h-6 cursor-help items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.65rem] font-bold tracking-wide uppercase transition-[border-color,background-color,color] duration-[var(--w-dur-fast)] ease-[var(--w-ease)] motion-reduce:transition-none",
          met
            ? "border-ink bg-stamp text-stamp-foreground"
            : "border-dashed border-ink/30 bg-card text-muted-foreground"
        )}
      >
        {met ? (
          <Icon icon={Tick02Icon} size={10} strokeWidth={2.5} aria-hidden />
        ) : null}
        <span aria-hidden>{label}</span>
        <span className="sr-only">{`${tip}. ${statusLabel}.`}</span>
      </span>
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute bottom-[calc(100%+0.375rem)] left-1/2 z-20 w-max max-w-[min(16rem,calc(100vw-3rem))] -translate-x-1/2 rounded-md border border-ink bg-card px-2 py-1 text-center text-[0.7rem] leading-4 font-medium tracking-normal text-foreground normal-case shadow-[2px_2px_0_var(--w-shadow-color)] opacity-0 transition-[opacity,transform] duration-[var(--w-dur-fast)] ease-[var(--w-ease)] motion-reduce:transition-none group-hover/chip:translate-y-0 group-hover/chip:opacity-100 group-focus-within/chip:translate-y-0 group-focus-within/chip:opacity-100",
          "translate-y-0.5"
        )}
      >
        {tip}
      </span>
    </li>
  )
}

export { allPasswordRequirementsMet }
