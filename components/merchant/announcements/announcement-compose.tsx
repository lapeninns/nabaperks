"use client"

import { type FormEvent, useId, useState, useSyncExternalStore } from "react"
import { Megaphone01Icon } from "@hugeicons/core-free-icons"

import { Eyebrow, EmptyState, Icon, SectionHeader } from "@/components/brand"
import { StatusBanner } from "@/components/loyalty/status-banner"
import { FormActionBar } from "@/components/merchant/launch/form-action-bar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  venueAnnouncementFormErrorCopy,
  type VenueAnnouncementFormErrorTone,
} from "@/lib/notifications/venue-announcement-form-copy"
import { cn } from "@/lib/utils"
import type {
  VenueAnnouncementAudienceSummary,
  VenueAnnouncementDailyUsage,
  VenueAnnouncementResult,
} from "@/lib/notifications/venue-announcements"
import type { AnnouncementTemplate } from "@/lib/notifications/announcement-templates"

const TITLE_LIMIT = 80
const BODY_LIMIT = 180

function subscribeToHydration(callback: () => void) {
  const frameId = window.requestAnimationFrame(callback)

  return () => {
    window.cancelAnimationFrame(frameId)
  }
}

function getHydratedSnapshot() {
  return true
}

function getServerHydrationSnapshot() {
  return false
}

function useHydrated() {
  return useSyncExternalStore(
    subscribeToHydration,
    getHydratedSnapshot,
    getServerHydrationSnapshot
  )
}

export type AnnouncementSubmitInput = {
  readonly title: string
  readonly body: string
}

export type AnnouncementSubmitSuccess = VenueAnnouncementResult & {
  readonly ok: true
}

export type AnnouncementSubmitFailure = {
  readonly ok: false
  readonly status: number
  readonly error: string
}

export type AnnouncementSubmitResult =
  AnnouncementSubmitSuccess | AnnouncementSubmitFailure

export type AnnouncementSubmit = (
  input: AnnouncementSubmitInput
) => Promise<AnnouncementSubmitResult>

export type AnnouncementComposeProps = {
  readonly audienceSummary: VenueAnnouncementAudienceSummary
  readonly dailyUsage: VenueAnnouncementDailyUsage
  readonly submitAnnouncement?: AnnouncementSubmit
  /** Business-typed quick-fill templates. Prefill only — never auto-sent. */
  readonly templates?: readonly AnnouncementTemplate[]
  readonly className?: string
}

export function AnnouncementCompose({
  audienceSummary,
  dailyUsage,
  submitAnnouncement = submitVenueAnnouncement,
  templates = [],
  className,
}: AnnouncementComposeProps) {
  const fieldId = useId()
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<AnnouncementSubmitResult | null>(null)
  const [sentToday, setSentToday] = useState(dailyUsage.used)
  const quickFillReady = useHydrated()

  const trimmedTitle = title.trim()
  const trimmedBody = body.trim()
  const hasEligibleAudience = audienceSummary.eligible > 0
  const dailyLimitReached = sentToday >= dailyUsage.limit
  const resultShowsDailyLimit =
    result !== null && !result.ok && result.error === "rate_limited"
  const showDailyLimitBanner = dailyLimitReached && !resultShowsDailyLimit
  const canSubmit =
    hasEligibleAudience &&
    !dailyLimitReached &&
    trimmedTitle.length > 0 &&
    trimmedBody.length > 0 &&
    !pending
  // A disabled primary action with no stated cause is a dead end — two of the
  // five blocking conditions already had banners, the other three were silent
  // and a screen reader announced only "Send announcement, dimmed" (03#56).
  const blockedReason = !hasEligibleAudience
    ? "No members can receive announcements yet."
    : dailyLimitReached
      ? "You have sent today's announcements."
      : trimmedTitle.length === 0
        ? "Add a title to send this."
        : trimmedBody.length === 0
          ? "Add a message to send this."
          : null
  const blockedReasonId = `${fieldId}-send-blocked`

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) return

    setPending(true)
    setResult(null)

    try {
      const nextResult = await submitAnnouncement({
        title: trimmedTitle,
        body: trimmedBody,
      })
      setResult(nextResult)
      if (nextResult.ok) {
        setSentToday((current) => Math.min(current + 1, dailyUsage.limit))
        // A sent announcement clears the fields: the disabled button then
        // reads as "nothing to send" instead of inviting a duplicate submit
        // of the same copy (server-side dedupe would only soften that to
        // "skipped").
        setTitle("")
        setBody("")
      } else if (nextResult.error === "rate_limited") {
        setSentToday(dailyUsage.limit)
      }
    } catch {
      setResult({ ok: false, status: 0, error: "network_error" })
    } finally {
      setPending(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        // `.surface-card` already carries the 2px ink border, the 10px radius,
        // the card ground and the 4px hard shadow. Restating three of them and
        // overriding the elevation to `shadow-xs` put the composer at a
        // different elevation from every other console card (03#54).
        "surface-card grid min-w-0 gap-5 p-4 sm:p-5",
        className
      )}
    >
      <SectionHeader
        eyebrow="Announcement"
        title="Send a venue update"
        description="Short member updates for today, tomorrow, or a quiet shift that needs regulars."
      />

      <AudiencePreview
        audienceSummary={audienceSummary}
        dailyUsage={{ used: sentToday, limit: dailyUsage.limit }}
      />

      {showDailyLimitBanner ? (
        <StatusBanner title="Daily limit reached" tone="warning">
          You have sent {formatNumber(dailyUsage.limit)} announcements today.
          You can send more tomorrow.
        </StatusBanner>
      ) : null}

      {!hasEligibleAudience ? (
        <EmptyState
          title="No members can receive this yet"
          description="Members need push permission and venue marketing consent before announcements can go out."
          icon={Megaphone01Icon}
          headingLevel={3}
          className="bg-background"
        />
      ) : null}

      {result ? <AnnouncementResultBanner result={result} /> : null}

      {templates.length > 0 ? (
        <div className="grid gap-2 rounded-lg bg-secondary/60 p-3">
          <Eyebrow>Quick fill</Eyebrow>
          <div
            role="group"
            aria-label="Announcement templates"
            className="flex flex-wrap gap-2"
          >
            {templates.map((template) => (
              <button
                key={template.id}
                type="button"
                disabled={!quickFillReady}
                onClick={() => {
                  // Prefill only: fills the draft fields. The announcement is
                  // not sent until the merchant presses Send.
                  setTitle(template.title)
                  setBody(template.body)
                }}
                className="focus-ring rounded-lg border-2 border-dashed border-ink/25 bg-transparent px-3 py-1.5 text-sm font-bold text-foreground transition-[background-color,border-color,opacity] duration-[var(--w-dur-fast)] ease-[var(--w-ease)] hover:border-ink hover:bg-card disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none [@media(pointer:coarse)]:min-h-11"
              >
                {template.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor={`${fieldId}-title`}>Announcement title</Label>
          <CharacterCounter
            id={`${fieldId}-title-count`}
            noun="Title"
            length={title.length}
            limit={TITLE_LIMIT}
          />
        </div>
        <Input
          id={`${fieldId}-title`}
          name="title"
          value={title}
          maxLength={80}
          required
          aria-describedby={`${fieldId}-title-count`}
          placeholder="Kitchen open from noon"
          onChange={(event) => setTitle(event.currentTarget.value)}
        />
      </div>

      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor={`${fieldId}-body`}>Announcement body</Label>
          <CharacterCounter
            id={`${fieldId}-body-count`}
            noun="Message"
            length={body.length}
            limit={BODY_LIMIT}
          />
        </div>
        <Textarea
          id={`${fieldId}-body`}
          name="body"
          value={body}
          maxLength={180}
          required
          aria-describedby={`${fieldId}-body-count`}
          placeholder="Fresh pies, cask ale, and a few tables free for lunch."
          onChange={(event) => setBody(event.currentTarget.value)}
        />
      </div>

      {/* 03#49: this form measures 883-948px on a 390x844 phone, so the send
          control sat below the fold behind the keyboard. FormActionBar sticks
          it to the bottom under `sm` and returns it to the flow from `sm` up.
          `offset="tab-bar"` because /app/announcements is a full-shell route
          and the md:hidden bottom tab bar would otherwise cover it. */}
      <FormActionBar
        offset="tab-bar"
        className="-mx-6 px-6 sm:px-0"
        // `hint` renders inside a <p>, so this slot must stay phrasing content —
        // a <div> here is invalid HTML and produced a hydration mismatch.
        hint={
          <span className="grid max-w-md gap-1">
            <span className="text-xs leading-5 text-muted-foreground">
              Sent only to members with push updates enabled for this venue.
            </span>
            {/* The visible half of the disabled button's reason, named by
              aria-describedby below so it is announced with the control
              instead of only on focus (03#56). */}
            {blockedReason && !pending ? (
              <span
                id={blockedReasonId}
                className="text-xs leading-5 font-bold text-foreground"
              >
                {blockedReason}
              </span>
            ) : null}
          </span>
        }
      >
        {/* Muted secondary while unsendable: a half-opacity vermillion reads
            as an off-palette pink button rather than a disabled state. Real
            ellipsis on the pending label (console-wide convention). */}
        <Button
          type="submit"
          variant={canSubmit || pending ? "default" : "secondary"}
          disabled={!canSubmit}
          aria-describedby={
            blockedReason && !pending ? blockedReasonId : undefined
          }
          className="w-full sm:w-auto"
        >
          <Icon icon={Megaphone01Icon} size={16} />
          {pending ? "Sending…" : "Send announcement"}
        </Button>
      </FormActionBar>
    </form>
  )
}

/**
 * The character counter for a limited field (03#55).
 *
 * Two deliberate choices. The visible count turns `text-destructive` inside the
 * last 10% so the ceiling is seen before it is hit, rather than staying muted
 * until typing silently stops. And the announcement is NOT on the count itself
 * — a polite live region on a per-keystroke number is unusable — but on a
 * separate sr-only line that only changes when the field crosses into the last
 * 10% and again when it fills, so assistive tech hears the threshold, not the
 * typing.
 *
 * `maxLength` stays on both controls: it is pinned by
 * `tests/contracts/merchant-venue-announcements-ui`, which is authoritative
 * over the audit's "replace the hard limit with soft validation".
 */
function CharacterCounter({
  id,
  noun,
  length,
  limit,
}: {
  readonly id: string
  readonly noun: string
  readonly length: number
  readonly limit: number
}) {
  const remaining = limit - length
  const isNearLimit = remaining <= Math.ceil(limit * 0.1)
  const isFull = remaining <= 0

  return (
    <>
      <span
        id={id}
        className={cn(
          "numeric-tabular text-xs font-semibold",
          isNearLimit ? "text-destructive" : "text-muted-foreground"
        )}
      >
        {length}/{limit}
      </span>
      <span aria-live="polite" className="sr-only">
        {isFull
          ? `${noun} is full at ${limit} characters. Trim it to add more.`
          : isNearLimit
            ? `${remaining} characters left in the ${noun.toLowerCase()}.`
            : ""}
      </span>
    </>
  )
}

function AudiencePreview({
  audienceSummary,
  dailyUsage,
}: {
  readonly audienceSummary: VenueAnnouncementAudienceSummary
  readonly dailyUsage: VenueAnnouncementDailyUsage
}) {
  return (
    <div className="rounded-lg border-2 border-dashed border-ink/30 bg-secondary/45 px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm font-extrabold text-foreground">
          About {formatNumber(audienceSummary.eligible)} of your{" "}
          {formatNumber(audienceSummary.members)} members can receive this.
        </p>
        <p className="numeric-tabular text-xs font-semibold text-muted-foreground">
          Daily announcements{" "}
          <span
            className={cn(
              "font-extrabold text-foreground",
              dailyUsage.used >= dailyUsage.limit && "text-destructive"
            )}
          >
            {formatNumber(dailyUsage.used)}/{formatNumber(dailyUsage.limit)}
          </span>
        </p>
      </div>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        Eligibility is based on membership, push subscription, and marketing
        consent. You can send up to {formatNumber(dailyUsage.limit)} venue
        announcements per day.
      </p>
    </div>
  )
}

function AnnouncementResultBanner({
  result,
}: {
  readonly result: AnnouncementSubmitResult
}) {
  if (result.ok) {
    return (
      <StatusBanner title="Announcement queued" tone="success">
        <span className="grid gap-1">
          <span>
            Eligible audience: {formatNumber(result.eligible)}{" "}
            {memberLabel(result.eligible)}.
          </span>
          <span>
            Queued for {formatNumber(result.queued)}{" "}
            {memberLabel(result.queued)}.
          </span>
          <span>
            Skipped: {formatNumber(result.skipped)}{" "}
            {memberLabel(result.skipped)}.
          </span>
          {result.skipped > 0 ? (
            <span>
              {formatNumber(result.skipped)} were skipped because this
              announcement was already queued for them.
            </span>
          ) : null}
        </span>
      </StatusBanner>
    )
  }

  const copy = venueAnnouncementFormErrorCopy(result.error)

  return (
    <StatusBanner
      title={copy.title}
      tone={statusTone(copy.tone)}
      className="scroll-mt-20"
    >
      {copy.body}
    </StatusBanner>
  )
}

function statusTone(tone: VenueAnnouncementFormErrorTone) {
  return tone
}

async function submitVenueAnnouncement(
  input: AnnouncementSubmitInput
): Promise<AnnouncementSubmitResult> {
  const response = await fetch("/api/notifications/venue-announcements", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  })
  const responseBody: unknown = await response.json().catch(() => null)

  if (response.ok) {
    return {
      ok: true,
      eligible: readNumber(responseBody, "eligible"),
      queued: readNumber(responseBody, "queued"),
      skipped: readNumber(responseBody, "skipped"),
    }
  }

  return {
    ok: false,
    status: response.status,
    error: readString(responseBody, "error") || "unknown",
  }
}

function readNumber(value: unknown, key: string) {
  if (!isRecord(value)) return 0

  const field = value[key]
  return typeof field === "number" && Number.isFinite(field) ? field : 0
}

function readString(value: unknown, key: string) {
  if (!isRecord(value)) return ""

  const field = value[key]
  return typeof field === "string" ? field : ""
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function formatNumber(value: number) {
  return value.toLocaleString("en-GB")
}

function memberLabel(value: number) {
  return value === 1 ? "member" : "members"
}
