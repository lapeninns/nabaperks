import type { ReactNode } from "react"
import { CheckmarkCircle02Icon } from "@hugeicons/core-free-icons"

import { Icon } from "@/components/brand"
import { cn } from "@/lib/utils"

import { RewardSeal } from "./reward-seal"

export type RewardTicketState = "sealed" | "waiting" | "ready" | "redeemed"

/** Mono eyebrow printed on the ticket face per state. */
const KICKER: Record<RewardTicketState, string> = {
  sealed: "Mystery reward",
  waiting: "Your reward",
  ready: "Your reward · ready",
  redeemed: "Redeemed",
}

/** Mono status word printed on the stub per state. */
const STUB_WORD: Record<RewardTicketState, string> = {
  sealed: "Sealed",
  waiting: "Unlocked",
  ready: "Ready",
  redeemed: "Done",
}

/**
 * The reward, as one perforated counter chit that changes state in place rather
 * than swapping widgets: dashed with a sun "?" when sealed, solid with the
 * printed name once won, leaf when ready, and a leaf "✓ REDEEMED" slam once
 * claimed. This replaces the flat RewardTeaser panel *and* the pint-specific
 * hero — the reward *name* is the art, so it stays merchant-agnostic for any
 * reward (or none, while sealed).
 */
export function RewardTicket({
  state,
  name,
  description,
  readyDate,
  sealSlammed = false,
  eyebrow,
  className,
  headingLevel: Heading = "h3",
}: {
  state: RewardTicketState
  /** Reward name once revealed, or the sealed mystery title. */
  name: ReactNode
  description?: ReactNode
  /** UK business day the reward opens — printed as a sun chip while waiting. */
  readyDate?: string | null
  /** Fire the print-pop on the stub seal — e.g. hero reveal loop. */
  sealSlammed?: boolean
  /** Override the state kicker — e.g. "Clear reward" on merchant previews. */
  eyebrow?: string
  className?: string
  /**
   * Outline level for the reward name. `"p"` is for decorative sample tickets
   * on marketing pages, where the reward name is illustration rather than a
   * real section — as a heading it outranks the page's own section headings.
   */
  headingLevel?: "h2" | "h3" | "p"
}) {
  const leaf = state === "ready" || state === "redeemed"
  const redeemed = state === "redeemed"

  return (
    <section
      aria-label="Reward"
      data-ticket-state={state}
      className={cn(
        "flex w-full min-w-0 overflow-hidden rounded-lg bg-card text-left",
        state === "sealed"
          ? "border-2 border-dashed border-line-strong"
          : "border-2 border-ink shadow-sm",
        className
      )}
    >
      <div
        className={cn(
          "relative grid min-w-0 flex-1 content-center gap-1 p-3 sm:p-4",
          // Reserve a clear band for the redeemed stamp so it never sits on
          // top of the reward name.
          redeemed && "pb-12 sm:pb-12"
        )}
      >
        <span className="eyebrow text-muted-foreground">
          {eyebrow ?? KICKER[state]}
        </span>
        <Heading
          className={cn(
            "text-lg leading-tight font-extrabold text-balance break-words",
            redeemed && "text-muted-foreground"
          )}
        >
          {name}
        </Heading>
        {description ? (
          <p className="text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        ) : null}
        {state === "waiting" && readyDate ? (
          // mono-meta, not mono-id: the ready date is the one fact a customer
          // must read to claim the prize — it stays above the 10px floor.
          <span className="mono-meta mt-1 w-fit rounded-md border-2 border-ink bg-seal/25 px-2 py-0.5">
            Ready · {readyDate}
          </span>
        ) : null}
        {redeemed ? (
          // Stamped across the reserved band below the copy — clear of the
          // title, still hand-slammed off-square.
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-2.5 left-4 flex -rotate-[8deg] items-center gap-1.5 rounded-md border-2 border-reward bg-reward/10 px-3 py-1 font-mono text-base font-extrabold tracking-[0.08em] text-reward uppercase"
          >
            <Icon icon={CheckmarkCircle02Icon} size={18} strokeWidth={2.5} />
            Redeemed
          </span>
        ) : null}
      </div>

      {/* perforation tear-line — the chit's reveal seam between face and stub */}
      <span
        aria-hidden="true"
        className="border-l-2 border-dashed border-line-strong"
      />

      <div
        className={cn(
          "grid w-20 shrink-0 content-center justify-items-center gap-2 p-2 text-center sm:w-[88px] sm:p-3",
          leaf ? "bg-reward/10" : "bg-seal/10"
        )}
      >
        <RewardSeal
          state={state}
          size="md"
          wiggle={state === "sealed"}
          breathe={state === "waiting" || state === "ready"}
          slammed={sealSlammed}
        />
        <span className="mono-id text-muted-foreground">
          {STUB_WORD[state]}
        </span>
      </div>
    </section>
  )
}
