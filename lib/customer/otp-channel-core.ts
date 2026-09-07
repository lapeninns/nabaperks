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

/** How the guest hears about the channel: "by text" / "on WhatsApp". */
export function otpChannelPhrase(channel: OtpChannel): string {
  return channel === "sms" ? "by text" : "on WhatsApp"
}

/** The switch link on the code step, named for where the code would go next. */
export function otpChannelSwitchLabel(target: OtpChannel): string {
  return target === "sms" ? "Text me instead" : "Send it on WhatsApp instead"
}

/** The phone step's one button, named for where the code will arrive. */
export function otpChannelSendLabel(channel: OtpChannel): string {
  return channel === "sms" ? "Text me the code" : "Send my code on WhatsApp"
}
