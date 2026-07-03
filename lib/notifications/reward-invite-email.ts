/**
 * Pure builder for the one-off reward-invite email (no server-only / Resend
 * imports, so it unit-tests directly). PECR posture: single merchant-attributed
 * send, a clear reason line, and an unsubscribe link (D9).
 */

export type RewardInviteEmailInput = {
  businessName: string
  rewardName: string
  personalMessage?: string | null
  claimUrl: string
  unsubscribeUrl: string
}

export type RewardInviteEmail = {
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

export function buildRewardInviteEmail(
  input: RewardInviteEmailInput
): RewardInviteEmail {
  const business = input.businessName.trim() || "A local venue"
  const reward = input.rewardName.trim() || "a reward"
  const message = input.personalMessage?.trim() || null

  const subject = `A reward is waiting for you at ${business}`
  const reason = `You're getting this one-off email because ${business} entered your address to send you a reward. We won't email you again about it.`

  const text = [
    `${business} has sent you a reward: ${reward}.`,
    message,
    `Claim it: ${input.claimUrl}`,
    "",
    reason,
    `Unsubscribe: ${input.unsubscribeUrl}`,
  ]
    .filter((line) => line !== null)
    .join("\n\n")

  const messageHtml = message
    ? `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#4f473d">${escapeHtml(message)}</p>`
    : ""

  const html = `<!doctype html>
<html>
  <body style="margin:0;background:#f6f1e6;font-family:Arial,Helvetica,sans-serif;color:#211c16;padding:24px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;margin:0 auto;background:#fbf8f1;border:2px solid #211c16;border-radius:10px;box-shadow:4px 4px 0 #211c16">
      <tr><td style="padding:24px">
        <p style="margin:0 0 8px;font:700 11px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;color:#4f473d">${escapeHtml(business)}</p>
        <h1 style="margin:0 0 12px;font-size:24px;line-height:1.15;font-weight:800">A reward is waiting for you</h1>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#4f473d">${escapeHtml(business)} has sent you <strong>${escapeHtml(reward)}</strong>.</p>
        ${messageHtml}
        <a href="${escapeHtml(input.claimUrl)}" style="display:inline-block;background:#cf330a;color:#fff;border:2px solid #211c16;border-radius:10px;padding:12px 18px;font-weight:800;text-decoration:none;box-shadow:3px 3px 0 #211c16">Claim your reward</a>
        <p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#4f473d">${escapeHtml(reason)} <a href="${escapeHtml(input.unsubscribeUrl)}" style="color:#4f473d">Unsubscribe</a>.</p>
      </td></tr>
    </table>
  </body>
</html>`

  return { subject, text, html }
}
