export type PosterEmailInput = {
  readonly venueName: string
  readonly posterUrl: string
  readonly shareUrl: string
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
  posterUrl,
  shareUrl,
}: PosterEmailInput): PosterEmailContent {
  const subject = "Print your Nabaperks counter poster"

  const text = [
    `Your Nabaperks counter poster for ${venueName} is ready to print.`,
    "",
    "Open your posters (on a computer, then print A4 at 100% — no fit-to-page):",
    posterUrl,
    "",
    "Your permanent venue link (share it anywhere you talk about loyalty):",
    shareUrl,
    "",
    "Customers scan the poster or open the link to join in their browser — no app to download.",
  ].join("\n")

  const html = posterEmailHtml({
    venueName: escapeHtml(venueName),
    posterUrl: escapeHtml(posterUrl),
    shareUrl: escapeHtml(shareUrl),
  })

  return { subject, text, html }
}

function posterEmailHtml({
  venueName,
  posterUrl,
  shareUrl,
}: PosterEmailInput): string {
  return `<!doctype html>
<html>
  <body style="margin:0;background:#f6f1e6;font-family:Arial,Helvetica,sans-serif;color:#211c16;padding:24px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#fbf8f1;border:2px solid #211c16;border-radius:10px;box-shadow:4px 4px 0 #211c16">
      <tr><td style="padding:24px">
        <div style="display:inline-block;margin:0 0 16px;background:#cf330a;color:#fff;border:2px solid #211c16;border-radius:999px;padding:8px 11px;font-size:18px;font-weight:800;line-height:1;box-shadow:3px 3px 0 #211c16">*</div>
        <p style="margin:0 0 8px;font:700 11px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;color:#4f473d">Nabaperks counter poster</p>
        <h1 style="margin:0 0 12px;font-size:24px;line-height:1.15;font-weight:800">Print your poster for ${venueName}</h1>
        <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#4f473d">Open this on a computer, pick a layout, and print A4 at 100% scale — no fit-to-page. Stand it on the counter and customers scan to join in their browser.</p>
        <a href="${posterUrl}" style="display:inline-block;background:#cf330a;color:#fff;border:2px solid #211c16;border-radius:999px;padding:12px 20px;font-size:15px;font-weight:800;text-decoration:none;box-shadow:3px 3px 0 #211c16">Open your posters</a>
        <p style="margin:20px 0 4px;font:700 11px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;color:#4f473d">Permanent venue link</p>
        <p style="margin:0;font-size:13px;line-height:1.6;word-break:break-all"><a href="${shareUrl}" style="color:#cf330a">${shareUrl}</a></p>
      </td></tr>
    </table>
  </body>
</html>`
}
