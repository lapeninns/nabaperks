"use client"

import { type FormEvent, useId, useState } from "react"
import { Megaphone01Icon } from "@hugeicons/core-free-icons"

import { EmptyState, Icon, SectionHeader } from "@/components/brand"
import { StatusBanner } from "@/components/loyalty/status-banner"
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
  VenueAnnouncementResult,
} from "@/lib/notifications/venue-announcements"

const TITLE_LIMIT = 80
const BODY_LIMIT = 180

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
  | AnnouncementSubmitSuccess
  | AnnouncementSubmitFailure

export type AnnouncementSubmit = (
  input: AnnouncementSubmitInput
) => Promise<AnnouncementSubmitResult>

export type AnnouncementComposeProps = {
  readonly audienceSummary: VenueAnnouncementAudienceSummary
  readonly submitAnnouncement?: AnnouncementSubmit
  readonly className?: string
}

export function AnnouncementCompose({
  audienceSummary,
  submitAnnouncement = submitVenueAnnouncement,
  className,
}: AnnouncementComposeProps) {
  const fieldId = useId()
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<AnnouncementSubmitResult | null>(null)

  const trimmedTitle = title.trim()
  const trimmedBody = body.trim()
  const hasEligibleAudience = audienceSummary.eligible > 0
  const canSubmit =
    hasEligibleAudience &&
    trimmedTitle.length > 0 &&
    trimmedBody.length > 0 &&
    !pending

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
        "surface-card grid min-w-0 gap-5 rounded-lg border-2 border-ink bg-card p-4 shadow-xs sm:p-5",
        className
      )}
    >
      <SectionHeader
        eyebrow="Announcement"
        title="Send a venue update"
        description="Short member updates for today, tomorrow, or a quiet shift that needs regulars."
      />

      <AudiencePreview audienceSummary={audienceSummary} />

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

      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor={`${fieldId}-title`}>Announcement title</Label>
          <span
            id={`${fieldId}-title-count`}
            className="numeric-tabular text-xs font-semibold text-muted-foreground"
          >
            {title.length}/{TITLE_LIMIT}
          </span>
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
          <span
            id={`${fieldId}-body-count`}
            className="numeric-tabular text-xs font-semibold text-muted-foreground"
          >
            {body.length}/{BODY_LIMIT}
          </span>
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-md text-xs leading-5 text-muted-foreground">
          Sent only to members with push updates enabled for this venue.
        </p>
        <Button
          type="submit"
          disabled={!canSubmit}
          className="w-full sm:w-auto"
        >
          <Icon icon={Megaphone01Icon} size={16} />
          {pending ? "Sending" : "Send announcement"}
        </Button>
      </div>
    </form>
  )
}

function AudiencePreview({
  audienceSummary,
}: {
  readonly audienceSummary: VenueAnnouncementAudienceSummary
}) {
  return (
    <div className="rounded-lg border-2 border-dashed border-ink/30 bg-secondary/45 px-4 py-3">
      <p className="text-sm font-extrabold text-foreground">
        About {formatNumber(audienceSummary.eligible)} of your{" "}
        {formatNumber(audienceSummary.members)} members can receive this.
      </p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        Eligibility is based on membership, push subscription, and marketing
        consent.
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
