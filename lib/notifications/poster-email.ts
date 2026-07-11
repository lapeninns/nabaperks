export type PosterEmailInput = {
  readonly venueName: string
}

export type PosterEmailContent = {
  readonly subject: string
  readonly text: string
  readonly html: string
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/**
 * Pure builder for the "email me the poster" transactional email — no I/O, so
 * it is unit-testable in isolation. The action layer (app/app/qr/actions) adds
 * the Resend send. Interpolated values are HTML-escaped because `venueName` is
 * merchant-controlled.
 */
export function buildPosterEmailContent({
  venueName,
}: PosterEmailInput): PosterEmailContent {
  const subject = "Your Nabaperks counter poster PDFs"

  const text = [
    `Your five Nabaperks counter poster PDFs for ${venueName} are attached.`,
    "",
    "Choose a layout, then print it on A4 at 100% — no fit-to-page.",
    "",
    "Customers scan the QR on the poster to join in their browser — no app to download.",
  ].join("\n")

  const html = posterEmailHtml({
    venueName: escapeHtml(venueName),
  })

  return { subject, text, html }
}

function posterEmailHtml({ venueName }: PosterEmailInput): string {
  return `<!doctype html>
<html>
  <body style="margin:0;background:#f6f1e6;font-family:Arial,Helvetica,sans-serif;color:#211c16;padding:24px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#fbf8f1;border:2px solid #211c16;border-radius:10px;box-shadow:4px 4px 0 #211c16">
      <tr><td style="padding:24px">
        <div style="display:inline-block;margin:0 0 16px;background:#cf330a;color:#fff;border:2px solid #211c16;border-radius:999px;padding:8px 11px;font-size:18px;font-weight:800;line-height:1;box-shadow:3px 3px 0 #211c16">*</div>
        <p style="margin:0 0 8px;font:700 11px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;color:#4f473d">Nabaperks counter poster</p>
        <h1 style="margin:0 0 12px;font-size:24px;line-height:1.15;font-weight:800">Your five poster PDFs for ${venueName}</h1>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#4f473d">All five A4 layouts are attached to this email. Pick the one you like, print at 100% scale — no fit-to-page — and stand it on the counter.</p>
        <p style="margin:0;font-size:13px;line-height:1.6;color:#4f473d">Customers scan the QR on the poster to join in their browser. No app download needed.</p>
      </td></tr>
    </table>
  </body>
</html>`
}
