"use client"

import {
  AnnouncementCompose,
  type AnnouncementSubmitInput,
  type AnnouncementSubmitResult,
} from "@/components/merchant/announcements/announcement-compose"

const ANNOUNCEMENT_AUDIENCE = {
  members: 24,
  eligible: 18,
} as const

const DEFAULT_DAILY_USAGE = {
  used: 0,
  limit: 2,
} as const

const EMPTY_AUDIENCE = {
  members: 12,
  eligible: 0,
} as const

export function AnnouncementsHarnessClient() {
  return (
    <div className="grid gap-6">
      <section aria-label="Announcement composer">
        <AnnouncementCompose
          audienceSummary={ANNOUNCEMENT_AUDIENCE}
          dailyUsage={DEFAULT_DAILY_USAGE}
          submitAnnouncement={submitAnnouncement}
        />
      </section>

      <section aria-label="Empty announcement composer">
        <AnnouncementCompose
          audienceSummary={EMPTY_AUDIENCE}
          dailyUsage={DEFAULT_DAILY_USAGE}
          submitAnnouncement={submitAnnouncement}
        />
      </section>
    </div>
  )
}

function submitAnnouncement(
  input: AnnouncementSubmitInput
): Promise<AnnouncementSubmitResult> {
  const title = input.title.toLowerCase()

  if (title.includes("rate limit")) {
    return Promise.resolve({
      ok: false,
      status: 429,
      error: "rate_limited",
    })
  }

  if (title.includes("moderation")) {
    return Promise.resolve({
      ok: false,
      status: 400,
      error: "moderation_rejected",
    })
  }

  return Promise.resolve({
    ok: true,
    eligible: 18,
    queued: 14,
    skipped: 4,
  })
}
