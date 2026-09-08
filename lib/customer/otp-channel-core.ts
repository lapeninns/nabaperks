/**
 * Which channel carries a customer's one-time code.
 *
 * WhatsApp is the primary channel: it is where UK guests already read
 * messages, it lands faster and costs the venue less than a text. SMS is the
 * guest's alternative ("Text me instead") and the automatic fallback when
 * the provider rejects a WhatsApp send outright — typically a number with
 * no WhatsApp account — so every phone that can take a text still gets its
 * code. Both ride the same Twilio Verify service, code check and rate limits.
 */
export type OtpChannel = "sms" | "whatsapp"

export const OTP_CHANNELS: readonly OtpChannel[] = ["sms", "whatsapp"]

export function parseOtpChannel(value: unknown): OtpChannel | null {
  return value === "sms" || value === "whatsapp" ? value : null
}

/** The configured primary channel; anything unrecognised or blank is WhatsApp. */
export function primaryOtpChannel(configured: string | undefined): OtpChannel {
  return parseOtpChannel(configured?.trim().toLowerCase()) ?? "whatsapp"
}

export function alternateOtpChannel(channel: OtpChannel): OtpChannel {
  return channel === "sms" ? "whatsapp" : "sms"
}

/**
 * The only channel word a guest ever reads. The code step never says which
 * channel carried the code; when it went out on WhatsApp the step offers a
 * text as the alternative. When it already went by text (the fallback
 * landed there because WhatsApp refused the number) there is nothing to
 * switch to, so no link shows.
 */
export const OTP_TEXT_FALLBACK_LABEL = "Text me instead"

/** The phone step's one button — neutral, because the fallback may reroute it. */
export const OTP_SEND_LABEL = "Send my code"
