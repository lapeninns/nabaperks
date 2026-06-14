import type { ReactNode } from "react"

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
  className,
}: {
  state: RewardTicketState
  /** Reward name once revealed, or the sealed mystery title. */
  name: ReactNode
  description?: ReactNode
  /** UK business day the reward opens — printed as a sun chip while waiting. */
  readyDate?: string | null
  className?: string
}) {
  const leaf = state === "ready" || state === "redeemed"
  const redeemed = state === "redeemed"

  return (
    <section
      aria-label="Reward"
      data-ticket-state={state}
      className={cn(
        "flex overflow-hidden rounded-[10px] bg-card text-left",
        state === "sealed"
          ? "border-2 border-dashed border-ink/40"
          : "border-2 border-ink shadow-sm",
        className
      )}
    >
      <div className="relative grid flex-1 content-center gap-1 p-4">
        <span className="eyebrow text-muted-foreground">{KICKER[state]}</span>
        <h3
          className={cn(
            "text-lg leading-tight font-extrabold",
            redeemed && "opacity-40"
          )}
        >
          {name}
        </h3>
        {description ? (
          <p
            className={cn(
              "text-sm leading-6 text-muted-foreground",
              redeemed && "opacity-40"
            )}
          >
            {description}
          </p>
        ) : null}
        {state === "waiting" && readyDate ? (
          <span className="mt-1 w-fit rounded-md border-2 border-ink bg-seal/25 px-2 py-0.5 font-mono text-[0.625rem] font-bold tracking-[0.06em] uppercase">
            Ready · {readyDate}
          </span>
        ) : null}
        {redeemed ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 -rotate-[8deg] rounded-md border-[3px] border-reward bg-reward/10 px-3 py-1 font-mono text-base font-extrabold tracking-[0.08em] text-reward uppercase"
          >
            ✓ Redeemed
          </span>
        ) : null}
      </div>

      {/* perforation tear-line — the chit's reveal seam between face and stub */}
      <span
        aria-hidden="true"
        className={cn(
          "border-l-2 border-dashed",
          state === "sealed" ? "border-ink/40" : "border-ink/50"
        )}
      />

      <div
        className={cn(
          "grid w-[88px] content-center justify-items-center gap-2 p-3 text-center",
          leaf ? "bg-reward/10" : "bg-seal/10"
        )}
      >
        <RewardSeal state={state} size="md" wiggle={state === "sealed"} />
        <span className="font-mono text-[0.625rem] font-bold tracking-[0.06em] text-muted-foreground uppercase">
          {STUB_WORD[state]}
        </span>
      </div>
    </section>
  )
}
