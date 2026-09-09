export type QrPauseState = {
  status: string
  message: string
  challengeId?: string
  maskedEmail?: string
  retryAt?: string
}

const MESSAGES: Record<string, string> = {
  email_required:
    "A verified owner sign-in email is required. Check your account or contact support.",
  unavailable:
    "This QR or verification request is no longer available. Refresh Venue QR and try again.",
  throttled: "Too many requests. Wait before trying again.",
  incorrect: "That code is incorrect. Check the email and try again.",
  expired: "That code has expired. Request a new code.",
  locked:
    "Too many incorrect codes. Request a new code when the resend timer allows.",
  superseded:
    "That code is no longer valid. Request a new code and use the latest email.",
  stale:
    "The QR status changed after this code was requested. Refresh Venue QR and start again.",
  paused:
    "Customer scans are paused. Confirmation emails are queued for the owner and venue.",
  already_completed:
    "This pause was already completed. Venue QR has been refreshed to show its current status.",
}

export function qrPauseResult(status: string): QrPauseState {
  return {
    status,
    message:
      MESSAGES[status] ??
      "Could not complete the request. Refresh Venue QR and try again.",
  }
}

export function maskQrOwnerEmail(email: string) {
  const [local, domain] = email.split("@")
  return `${local.slice(0, 1)}•••@${domain}`
}

export function isQrPauseComplete(status: string) {
  return status === "paused" || status === "already_completed"
}
