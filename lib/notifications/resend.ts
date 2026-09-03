import "server-only"

import {
  buildTransactionalEmailPayload,
  type TransactionalEmailInput,
} from "@/lib/notifications/transactional-email-payload"
import {
  emailOtpCopy,
  type EmailOtpAudience,
} from "@/lib/notifications/email-otp-copy"
import { resilientFetch } from "@/lib/observability/resilience"
import { DefinitiveProviderRejectionError } from "@/lib/notifications/provider-delivery-error"

const RESEND_ENDPOINT = "https://api.resend.com/emails"

type EmailOtpConfig = {
  readonly apiKey: string
  readonly from: string
}

async function safeDetail(res: Response) {
  try {
    return (await res.text()).slice(0, 500)
  } catch (error) {
    if (!(error instanceof Error)) {
      throw error
    }

    return "<no body>"
  }
}

function otpEmailHtml(code: string, audience: EmailOtpAudience) {
  const copy = emailOtpCopy[audience]

  return `<!doctype html>
<html>
  <body style="margin:0;background:#f6f1e6;font-family:Arial,Helvetica,sans-serif;color:#211c16;padding:24px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;margin:0 auto;background:#fbf8f1;border:2px solid #211c16;border-radius:10px;box-shadow:4px 4px 0 #211c16">
      <tr><td style="padding:24px">
        <div style="display:inline-block;margin:0 0 16px;background:#cf330a;color:#fff;border:2px solid #211c16;border-radius:999px;padding:8px 11px;font-size:18px;font-weight:800;line-height:1;box-shadow:3px 3px 0 #211c16">*</div>
        <p style="margin:0 0 8px;font:700 11px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;color:#4f473d">${copy.eyebrow}</p>
        <h1 style="margin:0 0 12px;font-size:24px;line-height:1.15;font-weight:800">${copy.title}</h1>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#4f473d">${copy.intro}</p>
        <div style="font:800 34px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.18em;background:#f6f1e6;border:2px solid #211c16;border-radius:10px;padding:14px;text-align:center">${code}</div>
        <p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#4f473d">${copy.footer}</p>
      </td></tr>
    </table>
  </body>
</html>`
}

export async function sendEmailOtp({
  to,
  code,
  audience = "customer",
  idempotencyKey,
  beforeProviderAttempt,
}: {
  to: string
  code: string
  audience?: EmailOtpAudience
  idempotencyKey?: string
  beforeProviderAttempt?: () => Promise<void>
}) {
  const copy = emailOtpCopy[audience]

  await sendTransactionalEmail({
    to,
    subject: `${code} ${copy.subjectSuffix}`,
    text: `Your Nabaperks verification code is ${code}. Enter it to ${copy.textReason}. It expires shortly. ${copy.footer}`,
    html: otpEmailHtml(code, audience),
    idempotencyKey,
    beforeProviderAttempt,
  })
}

export async function sendTransactionalEmail({
  to,
  subject,
  text,
  html,
  attachments,
  idempotencyKey,
  beforeProviderAttempt,
}: TransactionalEmailInput & {
  beforeProviderAttempt?: () => Promise<void>
}) {
  const { apiKey, from } = readEmailOtpConfig()

  const res = await resilientFetch(
    "resend",
    RESEND_ENDPOINT,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      body: JSON.stringify(
        buildTransactionalEmailPayload(from, {
          to,
          subject,
          text,
          html,
          ...(attachments ? { attachments } : {}),
        })
      ),
    },
    { beforeAttempt: beforeProviderAttempt }
  )

  if (!res.ok) {
    throw new DefinitiveProviderRejectionError(
      `Resend send failed (${res.status}): ${await safeDetail(res)}`
    )
  }
}

export function readEmailOtpConfig(): EmailOtpConfig {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const from = process.env.RESEND_FROM?.trim()

  if (!apiKey || !from) {
    throw new Error("Resend is not configured (RESEND_API_KEY / RESEND_FROM).")
  }

  return { apiKey, from }
}
