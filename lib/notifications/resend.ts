import "server-only"

const RESEND_ENDPOINT = "https://api.resend.com/emails"

async function safeDetail(res: Response) {
  try {
    return (await res.text()).slice(0, 500)
  } catch {
    return "<no body>"
  }
}

function otpEmailHtml(code: string) {
  return `<!doctype html>
<html>
  <body style="margin:0;background:#f6f1e6;font-family:ui-sans-serif,system-ui,sans-serif;color:#211c16;padding:24px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:420px;margin:0 auto;background:#fbf8f1;border:2px solid #211c16;border-radius:10px">
      <tr><td style="padding:24px">
        <p style="margin:0 0 8px;font:700 11px ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;color:#6b6257">Nabaperks wallet</p>
        <h1 style="margin:0 0 12px;font-size:20px;line-height:1.2">Your verification code</h1>
        <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#6b6257">Enter this code to open your wallet. It expires shortly.</p>
        <div style="font:800 32px ui-monospace,monospace;letter-spacing:.18em;background:#f6f1e6;border:2px solid #211c16;border-radius:10px;padding:14px;text-align:center">${code}</div>
        <p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#6b6257">If you didn't request this, you can safely ignore this email.</p>
      </td></tr>
    </table>
  </body>
</html>`
}

/**
 * Send a one-time code by email via Resend. Used by the Supabase Send-Email
 * auth hook. Throws if Resend is not configured or the API rejects the send.
 */
export async function sendEmailOtp({ to, code }: { to: string; code: string }) {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const from = process.env.RESEND_FROM?.trim()

  if (!apiKey || !from) {
    throw new Error("Resend is not configured (RESEND_API_KEY / RESEND_FROM).")
  }

  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `${code} is your Nabaperks code`,
      text: `Your Nabaperks verification code is ${code}. It expires shortly. If you didn't request this, you can ignore this email.`,
      html: otpEmailHtml(code),
    }),
  })

  if (!res.ok) {
    throw new Error(`Resend send failed (${res.status}): ${await safeDetail(res)}`)
  }
}
