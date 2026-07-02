export type VenueAnnouncementFormErrorTone = "warning" | "error"

export type VenueAnnouncementFormErrorCopy = {
  readonly title: string
  readonly body: string
  readonly tone: VenueAnnouncementFormErrorTone
}

const ERROR_COPY: Record<string, VenueAnnouncementFormErrorCopy> = {
  rate_limited: {
    title: "Daily limit reached",
    body: "Announcements can go out up to 2 a day. Try again tomorrow.",
    tone: "warning",
  },
  invalid_title: {
    title: "Add a clearer title",
    body: "Use a title of at least 3 characters.",
    tone: "error",
  },
  invalid_body: {
    title: "Add a fuller message",
    body: "Use a message of at least 10 characters.",
    tone: "error",
  },
  moderation_rejected: {
    title: "Check the wording",
    body: "Keep it to a plain venue update without links, phone numbers, payment wording, or claims.",
    tone: "error",
  },
  unauthenticated: {
    title: "Sign in again",
    body: "Sign in again before sending this announcement.",
    tone: "error",
  },
} as const

const DEFAULT_ERROR_COPY: VenueAnnouncementFormErrorCopy = {
  title: "Announcement not sent",
  body: "We could not send this announcement. Try again in a moment.",
  tone: "error",
}

export function venueAnnouncementFormErrorCopy(
  error: string
): VenueAnnouncementFormErrorCopy {
  return ERROR_COPY[error] ?? DEFAULT_ERROR_COPY
}
