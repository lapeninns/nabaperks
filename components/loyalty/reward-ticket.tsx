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
  hideStubSeal = false,
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
  /**
   * Drop the stub's seal, keeping the stub word.
   *
   * The system's rule (CustomerStampCard) is that the sealed mystery shows
   * ONCE — as the stamp row's terminal chip, or once revealed on this ticket —
   * "never two seals competing in one view". But a sealed card rendered both:
   * a `size="sm"` seal as the row chip AND this `size="md"` one in the stub.
   * The card passes this so the row keeps its terminal chip and the ticket
   * stops repeating it. (02#31)
   */
  hideStubSeal?: boolean
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
          // One padding, not a viewport-keyed pair. The ticket lives inside the
          // 410px customer column, which is already at its cap by ~700px — so
          // `sm:p-4` (640px) enlarged the padding on a screen where the ticket
          // is exactly as wide as it was at 375px, taking measure away from the
          // terms it wraps. Measured: column 375px -> 410px and then flat.
          // (02#6)
          "relative grid min-w-0 flex-1 content-center gap-1 p-3",
          // Reserve a clear band for the redeemed stamp so it never sits on
          // top of the reward name.
          redeemed && "pb-12"
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
            className="pointer-events-none absolute bottom-2.5 left-4 flex -rotate-[8deg] items-center gap-1.5 rounded-md border-2 border-reward bg-reward/10 px-3 py-1 font-mono text-base font-extrabold tracking-tag text-reward uppercase"
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
          // w-18 (72px), measured not guessed. The stub's floor is set by the
          // longest stub word: "REDEEMED" at .mono-id measures 54px, plus p-2
          // either side = 70px. 72px is the nearest rung that clears it. The
          // audit's suggested w-14 (56px) is NOT viable — it would leave 40px
          // of content box for a 54px word. (02#30)
          //
          // Flat, not responsive. `sm:w-[88px]` widened the stub by 8px at >=640px — but
          // the customer column is capped at 410px, so that only ever ate
          // measure on the surface where the terms are already squeezed into a
          // 213px newspaper column (CUS 02#30). The base width is set by the
          // stub word at the mono-id floor ("REDEEMED"), so shrinking it
          // further needs a rendered measurement, not a guess.
          "grid w-18 shrink-0 content-center justify-items-center gap-2 p-2 text-center",
          leaf ? "bg-reward/10" : "bg-seal/10"
        )}
      >
        {hideStubSeal ? null : (
          <RewardSeal
            state={state}
            size="md"
            wiggle={state === "sealed"}
            breathe={state === "waiting" || state === "ready"}
            slammed={sealSlammed}
          />
        )}
        <span className="mono-id text-muted-foreground">
          {STUB_WORD[state]}
        </span>
      </div>
    </section>
  )
}
