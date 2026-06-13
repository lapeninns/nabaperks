"use client"

import { useActionState, useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import {
  approveStampAction,
  endStaffSessionAction,
  lookupCodeAction,
  redeemRewardAction,
  startStaffSessionAction,
  undoStampAction,
  type ApproveState,
  type CodeEntryState,
  type RedeemState,
  type StartSessionState,
  type UndoState,
} from "@/app/staff/actions"
import { MonoTag } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type StationConsoleProps = {
  stationName: string
  merchantName: string
  session: { id: string; staffName: string; startedAt: string } | null
  staffMembers: Array<{ id: string; displayName: string }>
  stampsToday: number
  redemptionsToday: number
  lastAction: { summary: string; at: string } | null
  lockedUntil: string | null
}

const startSessionInitial: StartSessionState = {}
const codeEntryInitial: CodeEntryState = {}
const approveInitial: ApproveState = {}
const redeemInitial: RedeemState = {}
const undoInitial: UndoState = {}

export function StationConsole(props: StationConsoleProps) {
  const lockedSecondsLeft = useLockCountdown(props.lockedUntil)

  if (lockedSecondsLeft > 0) {
    return <LockedPanel secondsLeft={lockedSecondsLeft} />
  }

  if (!props.session) {
    return <StartSessionPanel staffMembers={props.staffMembers} />
  }

  return <CounterPanel {...props} session={props.session} />
}

/* ----------------------------- locked ----------------------------- */

function useLockCountdown(lockedUntil: string | null) {
  const router = useRouter()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!lockedUntil) return

    const id = setInterval(() => setNow(Date.now()), 1000)

    return () => clearInterval(id)
  }, [lockedUntil])

  const secondsLeft = lockedUntil
    ? Math.max(0, Math.ceil((new Date(lockedUntil).getTime() - now) / 1000))
    : 0

  useEffect(() => {
    if (lockedUntil && secondsLeft <= 0) router.refresh()
  }, [lockedUntil, secondsLeft, router])

  return secondsLeft
}

function LockedPanel({ secondsLeft }: { secondsLeft: number }) {
  const minutes = String(Math.floor(secondsLeft / 60)).padStart(2, "0")
  const seconds = String(secondsLeft % 60).padStart(2, "0")

  return (
    <InkPanel className="text-center">
      <p className="eyebrow text-paper/60">PIN pad locked</p>
      <p
        className="my-5 font-mono text-7xl font-bold tabular-nums"
        role="timer"
        aria-live="polite"
      >
        {minutes}:{seconds}
      </p>
      <p className="font-mono text-[11px] uppercase tracking-wide text-paper/60">
        Three wrong tries · counts down on its own
      </p>
      <p className="mx-auto mt-4 max-w-[32ch] text-sm leading-6 text-paper/75">
        Take a breath — it unlocks itself. The customer&apos;s stamp will keep;
        nothing is lost.
      </p>
    </InkPanel>
  )
}

/* -------------------------- start session ------------------------- */

function StartSessionPanel({
  staffMembers,
}: {
  staffMembers: Array<{ id: string; displayName: string }>
}) {
  const [state, action, pending] = useActionState(
    startStaffSessionAction,
    startSessionInitial
  )
  const [selectedStaff, setSelectedStaff] = useState<string>("")

  if (staffMembers.length === 0) {
    return (
      <InkPanel className="text-center">
        <p className="eyebrow text-paper/60">No staff yet</p>
        <p className="mx-auto mt-4 max-w-[32ch] text-sm leading-6 text-paper/75">
          Ask the owner to add staff members with their own PINs in Settings
          &rsaquo; Staff.
        </p>
      </InkPanel>
    )
  }

  return (
    <section className="surface-card grid gap-5 p-6">
      <div className="grid gap-1 text-center">
        <p className="eyebrow">Start a session</p>
        <p className="text-sm leading-6 text-muted-foreground">
          Stamps are signed with your name, not a shared till login.
        </p>
      </div>

      <form action={action} className="grid gap-4">
        <input type="hidden" name="staffUserId" value={selectedStaff} />
        <div
          className="flex flex-wrap justify-center gap-2"
          role="radiogroup"
          aria-label="Who is on the counter?"
        >
          {staffMembers.map((member) => (
            <button
              key={member.id}
              type="button"
              role="radio"
              aria-checked={selectedStaff === member.id}
              onClick={() => setSelectedStaff(member.id)}
              className={cn(
                "rounded-full border-2 border-ink px-4 py-2 text-sm font-bold transition",
                selectedStaff === member.id
                  ? "bg-ink text-paper"
                  : "bg-card text-foreground hover:bg-accent"
              )}
            >
              {member.displayName}
            </button>
          ))}
        </div>

        <div className="grid gap-2">
          <label htmlFor="staff-session-pin" className="eyebrow text-center">
            Your staff PIN
          </label>
          <input
            id="staff-session-pin"
            name="pin"
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            autoComplete="one-time-code"
            className="h-14 w-full min-w-0 rounded-lg border-2 border-ink bg-card text-center font-mono text-2xl font-bold tracking-[0.4em] outline-none transition focus:ring-3 focus:ring-ring/30 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20"
            aria-invalid={Boolean(state.errors?.pin)}
            aria-describedby={
              state.errors?.pin ? "staff-session-pin-error" : undefined
            }
          />
          {state.errors?.pin ? (
            <p id="staff-session-pin-error" className="text-sm text-destructive">
              {state.errors.pin}
            </p>
          ) : null}
        </div>

        {state.errors?.form ? (
          <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {state.errors.form}
          </p>
        ) : null}

        <Button type="submit" size="lg" disabled={pending || !selectedStaff}>
          {pending ? "Starting..." : "Start session"}
        </Button>
        <p className="text-center font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
          Three misses locks the pad for 10 min
        </p>
      </form>
    </section>
  )
}

/* ----------------------------- counter ---------------------------- */

function CounterPanel(
  props: StationConsoleProps & {
    session: NonNullable<StationConsoleProps["session"]>
  }
) {
  const [flowKey, setFlowKey] = useState(0)

  return (
    <div className="grid gap-4">
      <InkPanel className="text-center">
        <p className="eyebrow text-paper/60">Counter mode · keep this tab open</p>
        <p className="mt-4 font-mono text-[11px] uppercase tracking-wide text-paper/60">
          Stamps today
        </p>
        <p className="text-[88px] font-extrabold leading-none">
          {props.stampsToday}
        </p>
        <p className="mt-3 font-mono text-xs uppercase tracking-wide text-paper/60">
          {props.redemptionsToday}{" "}
          {props.redemptionsToday === 1 ? "reward redeemed" : "rewards redeemed"}{" "}
          today
        </p>
        {props.lastAction ? (
          <p className="mx-auto mt-4 inline-flex max-w-full items-center gap-2 rounded-full border-2 border-paper/30 px-4 py-2 font-mono text-xs">
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-full bg-leaf"
            />
            <span className="truncate uppercase">
              Last: {props.lastAction.summary} · {timeLabel(props.lastAction.at)}
            </span>
          </p>
        ) : null}
      </InkPanel>

      <div className="flex items-center justify-between gap-3 rounded-lg border-2 border-ink bg-card px-4 py-3">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
            On the counter
          </p>
          <p className="truncate text-lg font-extrabold">
            {props.session.staffName}
          </p>
        </div>
        <form action={endStaffSessionAction}>
          <input type="hidden" name="sessionId" value={props.session.id} />
          <Button type="submit" variant="secondary" size="sm">
            End session
          </Button>
        </form>
      </div>

      <CounterFlow
        key={flowKey}
        sessionId={props.session.id}
        onReset={() => setFlowKey((key) => key + 1)}
      />
    </div>
  )
}

function CounterFlow({
  sessionId,
  onReset,
}: {
  sessionId: string
  onReset: () => void
}) {
  const [lookupState, lookupFormAction, lookupPending] = useActionState(
    lookupCodeAction,
    codeEntryInitial
  )
  const [approveState, approveFormAction, approvePending] = useActionState(
    approveStampAction,
    approveInitial
  )
  const [redeemState, redeemFormAction, redeemPending] = useActionState(
    redeemRewardAction,
    redeemInitial
  )
  const [undoState, undoFormAction, undoPending] = useActionState(
    undoStampAction,
    undoInitial
  )

  const approveResult = approveState.result
  const redeemResult = redeemState.result
  const undoResult = undoState.result
  const lookup = lookupState.lookup

  if (undoResult?.status === "undone") {
    return (
      <ResultCard
        tone="neutral"
        title="Stamp undone."
        message={`The card is back to ${undoResult.newStampCount} ${
          undoResult.newStampCount === 1 ? "stamp" : "stamps"
        }. Nothing else changed.`}
        onReset={onReset}
      />
    )
  }

  if (approveResult) {
    if (approveResult.status === "approved") {
      return (
        <div className="grid gap-3">
          <ResultCard
            tone="success"
            title="Stamped. Hand the counter back."
            message={
              approveResult.rewardUnlocked
                ? "That completed their card — the reward is unsealing on their screen right now."
                : `That's stamp ${approveResult.newStampCount}. Their card has already updated.`
            }
            onReset={onReset}
          />
          <form action={undoFormAction} className="grid">
            <input type="hidden" name="sessionId" value={sessionId} />
            <input
              type="hidden"
              name="stampEventId"
              value={approveResult.stampEventId}
            />
            <Button type="submit" variant="secondary" disabled={undoPending}>
              {undoPending ? "Undoing..." : "Undo this stamp"}
            </Button>
          </form>
          {undoResult ? (
            <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {undoResult.status === "window_closed"
                ? "The undo window has closed."
                : undoResult.reason}
            </p>
          ) : null}
        </div>
      )
    }

    return (
      <ResultCard
        tone="error"
        title={approveResult.status === "expired" ? "Code expired" : "Not stamped"}
        message={approveErrorMessage(approveResult)}
        onReset={onReset}
      />
    )
  }

  if (redeemResult) {
    if (redeemResult.status === "redeemed") {
      return (
        <ResultCard
          tone="success"
          title="Reward redeemed."
          message={`${redeemResult.rewardName} — their card has started a fresh cycle.`}
          onReset={onReset}
        />
      )
    }

    return (
      <ResultCard
        tone="error"
        title="Not redeemed"
        message={redeemErrorMessage(redeemResult)}
        onReset={onReset}
      />
    )
  }

  if (lookup && lookup.status === "ready") {
    return (
      <section className="surface-card grid gap-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
              {lookup.customerLabel}
            </p>
            <p className="text-lg font-extrabold">
              {lookup.kind === "stamp" ? "Stamp request" : "Reward redemption"}
            </p>
          </div>
          <MonoTag tone="sun">
            Stamp {Math.min(lookup.stampCount + 1, lookup.stampsRequired)} of{" "}
            {lookup.stampsRequired}
          </MonoTag>
        </div>

        {lookup.duplicateWarning ? (
          <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
            {lookup.duplicateWarning} — one stamp per UK business day.
          </p>
        ) : null}

        {lookup.kind === "redeem" && lookup.reward ? (
          <div className="surface-card p-4">
            <p className="text-lg font-extrabold">{lookup.reward.name}</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {lookup.reward.terms}
              {lookup.reward.minSpendPence !== null
                ? ` Minimum spend ${formatPence(lookup.reward.minSpendPence)}.`
                : null}
            </p>
          </div>
        ) : null}

        <form
          action={lookup.kind === "stamp" ? approveFormAction : redeemFormAction}
          className="grid gap-2"
        >
          <input type="hidden" name="tokenId" value={lookup.tokenId} />
          <input type="hidden" name="sessionId" value={sessionId} />
          <Button
            type="submit"
            size="lg"
            disabled={approvePending || redeemPending}
          >
            {lookup.kind === "stamp"
              ? approvePending
                ? "Checking..."
                : "Approve stamp"
              : redeemPending
                ? "Checking..."
                : "Redeem reward"}
          </Button>
        </form>
        <button
          type="button"
          onClick={onReset}
          className="text-center text-sm font-medium underline underline-offset-4"
        >
          Back to counter
        </button>
      </section>
    )
  }

  if (lookup) {
    return (
      <ResultCard
        tone="error"
        title={lookup.status === "already_used" ? "Already used" : "Code expired"}
        message={
          lookup.status === "already_used"
            ? `This code was used at ${timeLabel(lookup.usedAt)}. No second stamp.`
            : "Ask the customer to tap for a fresh code — it takes a second."
        }
        onReset={onReset}
      />
    )
  }

  return (
    <section className="surface-card grid gap-4 p-5">
      <form action={lookupFormAction} className="grid gap-3">
        <div className="grid gap-2">
          <label htmlFor="customer-code" className="eyebrow text-center">
            Customer&apos;s code
          </label>
          <input
            id="customer-code"
            name="code"
            type="text"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            maxLength={4}
            className="h-16 w-full min-w-0 rounded-lg border-2 border-ink bg-card text-center font-mono text-3xl font-bold uppercase tracking-[0.45em] outline-none transition focus:ring-3 focus:ring-ring/30 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20"
            aria-invalid={Boolean(lookupState.errors?.code)}
            aria-describedby={
              lookupState.errors?.code ? "customer-code-error" : undefined
            }
          />
          {lookupState.errors?.code ? (
            <p id="customer-code-error" className="text-center text-sm text-destructive">
              {lookupState.errors.code}
            </p>
          ) : null}
        </div>
        <Button type="submit" size="lg" disabled={lookupPending}>
          {lookupPending ? "Finding..." : "Find code"}
        </Button>
        <p className="text-center font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
          Customers read their code out — you never touch their phone
        </p>
      </form>
    </section>
  )
}

/* ----------------------------- shared ----------------------------- */

function InkPanel({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border-2 border-ink bg-ink p-6 text-paper",
        className
      )}
    >
      {children}
    </section>
  )
}

function ResultCard({
  tone,
  title,
  message,
  onReset,
}: {
  tone: "success" | "error" | "neutral"
  title: string
  message: string
  onReset: () => void
}) {
  return (
    <section
      className="surface-card grid gap-4 p-6 text-center"
      role="status"
      aria-live="polite"
    >
      <span
        aria-hidden
        className={cn(
          "mx-auto grid size-16 -rotate-6 place-items-center rounded-full border-2 border-ink text-3xl font-extrabold",
          tone === "success" && "bg-leaf text-ink",
          tone === "error" && "bg-destructive/15 text-destructive",
          tone === "neutral" && "bg-accent text-ink"
        )}
      >
        {tone === "success" ? "✓" : tone === "error" ? "!" : "↺"}
      </span>
      <div className="grid gap-2">
        <h2 className="text-2xl font-extrabold leading-tight">{title}</h2>
        <p className="text-sm leading-6 text-muted-foreground">{message}</p>
      </div>
      <Button type="button" size="lg" onClick={onReset}>
        Back to counter
      </Button>
    </section>
  )
}

function approveErrorMessage(
  result: Exclude<
    NonNullable<ApproveState["result"]>,
    { status: "approved" }
  >
) {
  if (result.status === "already_used") {
    return "This code has already been used. No second stamp landed."
  }

  if (result.status === "expired") {
    return "Ask the customer to tap for a fresh code — it takes a second."
  }

  return result.reason
}

function redeemErrorMessage(
  result: Exclude<NonNullable<RedeemState["result"]>, { status: "redeemed" }>
) {
  if (result.status === "already_redeemed") {
    return result.redeemedAt
      ? `This reward was already redeemed at ${timeLabel(result.redeemedAt)}.`
      : "This reward has already been redeemed."
  }

  if (result.status === "expired") {
    return "Ask the customer to reopen their reward for a fresh code."
  }

  return result.reason
}

function timeLabel(value: string) {
  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) return value

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed)
}

function formatPence(pence: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(pence / 100)
}
