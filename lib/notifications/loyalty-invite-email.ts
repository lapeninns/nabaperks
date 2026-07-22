/**
 * Pure builder for the fixed bulk two-stamp loyalty-invitation email (no
 * server-only / Resend imports, so it unit-tests directly). The copy is
 * controlled British English — venue name, the two-stamp offer, the 30-day
 * expiry, a privacy link and a venue-scoped unsubscribe link. There is no
 * merchant-supplied free text, so nothing here is attacker-controlled beyond
 * the venue name, which is still HTML-escaped defensively.
 *
 * PECR posture: a single merchant-attributed send, a clear sender-identification
 * reason line, and a working unsubscribe mechanism.
 */

export type LoyaltyInviteEmailInput = {
  businessName: string
  claimUrl: string
  unsubscribeUrl: string
  privacyUrl: string
  expiryDays: number
}

export type LoyaltyInviteEmail = {
  subject: string
  text: string
  html: string
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char] ?? char
  )
}

export function buildLoyaltyInviteEmail(
  input: LoyaltyInviteEmailInput
): LoyaltyInviteEmail {
  const business = input.businessName.trim() || "A local venue"
  const expiryDays =
    Number.isFinite(input.expiryDays) && input.expiryDays > 0
      ? Math.floor(input.expiryDays)
      : 30

  const subject = `Two welcome stamps are waiting at ${business}`
  const reason = `You're receiving this because ${business} invited you to join their loyalty card. It's a one-off invitation — we won't email you about it again.`
  const expiry = `This invitation expires in ${expiryDays} days.`

  const text = [
    `${business} has invited you to their loyalty card on Nabaperks.`,
    "Follow the link to collect two welcome stamps — there's no app to download.",
    `Collect your stamps: ${input.claimUrl}`,
    expiry,
    "",
    reason,
    `Privacy notice: ${input.privacyUrl}`,
    `Unsubscribe from ${business}: ${input.unsubscribeUrl}`,
  ].join("\n\n")

  const html = `<!doctype html>
<html lang="en-GB">
  <body style="margin:0;background:#f6f1e6;font-family:Arial,Helvetica,sans-serif;color:#211c16;padding:24px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;margin:0 auto;background:#fbf8f1;border:2px solid #211c16;border-radius:10px;box-shadow:4px 4px 0 #211c16">
      <tr><td style="padding:24px">
        <p style="margin:0 0 8px;font:700 11px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;color:#4f473d">${escapeHtml(business)}</p>
        <h1 style="margin:0 0 12px;font-size:24px;line-height:1.15;font-weight:800">Two stamps to start your card</h1>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#4f473d">${escapeHtml(business)} has invited you to their loyalty card on Nabaperks. Follow the link to collect <strong>two welcome stamps</strong> — there's no app to download.</p>
        <a href="${escapeHtml(input.claimUrl)}" style="display:inline-block;background:#cf330a;color:#fff;border:2px solid #211c16;border-radius:10px;padding:12px 18px;font-weight:800;text-decoration:none;box-shadow:3px 3px 0 #211c16">Collect your two stamps</a>
        <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#4f473d">${escapeHtml(expiry)}</p>
        <p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#4f473d">${escapeHtml(reason)} <a href="${escapeHtml(input.privacyUrl)}" style="color:#4f473d">Privacy notice</a>. <a href="${escapeHtml(input.unsubscribeUrl)}" style="color:#4f473d">Unsubscribe</a>.</p>
      </td></tr>
    </table>
  </body>
</html>`

  return { subject, text, html }
}
