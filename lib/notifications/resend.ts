import "server-only"

import { resilientFetch } from "@/lib/observability/resilience"

const RESEND_ENDPOINT = "https://api.resend.com/emails"

type EmailOtpAudience = "customer" | "merchant-verify" | "merchant-reset"

type EmailOtpCopy = {
  readonly eyebrow: string
  readonly title: string
  readonly intro: string
  readonly footer: string
  readonly subjectSuffix: string
  readonly textReason: string
}

type EmailOtpConfig = {
  readonly apiKey: string
  readonly from: string
}

const emailOtpCopy = {
  customer: {
    eyebrow: "My Nabaperks",
    title: "Your verification code",
    intro: "Enter this code to open your cards. It expires shortly.",
    footer: "If you didn't request this, you can safely ignore this email.",
    subjectSuffix: "is your Nabaperks code",
    textReason: "open your Nabaperks cards",
  },
  "merchant-verify": {
    eyebrow: "Nabaperks merchant",
    title: "Verify your venue email",
    intro:
      "Enter this code on Nabaperks to confirm your email and finish creating your venue account.",
    footer:
      "If you did not start a Nabaperks venue signup, you can ignore this email.",
    subjectSuffix: "is your Nabaperks verification code",
    textReason: "confirm your Nabaperks venue email",
  },
  "merchant-reset": {
    eyebrow: "Nabaperks merchant",
    title: "Reset your password",
    intro: "Enter this code on Nabaperks to set a new venue console password.",
    footer:
      "If you did not ask to reset your password, you can ignore this email and your password stays the same.",
    subjectSuffix: "is your Nabaperks password reset code",
    textReason: "reset your Nabaperks password",
  },
} satisfies Record<EmailOtpAudience, EmailOtpCopy>

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
}: {
  to: string
  code: string
  audience?: EmailOtpAudience
}) {
  const { apiKey, from } = readEmailOtpConfig()
  const copy = emailOtpCopy[audience]

  const res = await resilientFetch("resend", RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `${code} ${copy.subjectSuffix}`,
      text: `Your Nabaperks verification code is ${code}. Enter it to ${copy.textReason}. It expires shortly. ${copy.footer}`,
      html: otpEmailHtml(code, audience),
    }),
  })

  if (!res.ok) {
    throw new Error(
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
