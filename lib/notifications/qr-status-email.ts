function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character] ?? character
  )
}

export type QrStatusEmail = {
  venueName: string
  isActive: boolean
  scansAvailable: boolean
  changedAt: string
  workspaceUrl: string
}

function emailContent(subject: string, paragraphs: string[], url?: string) {
  return {
    subject,
    text: [...paragraphs, ...(url ? [`Venue QR: ${url}`] : [])].join("\n\n"),
    html: `<div style="background:#f6f1e6;color:#211c16;font-family:Arial,sans-serif;padding:24px"><div style="max-width:480px;background:#fbf8f1;border:2px solid #211c16;border-radius:10px;padding:24px"><h1 style="font-size:24px">${escapeHtml(subject)}</h1>${paragraphs.map((paragraph) => `<p style="line-height:1.6">${escapeHtml(paragraph)}</p>`).join("")}${url ? `<p><a href="${escapeHtml(url)}">Open Venue QR</a></p>` : ""}</div></div>`,
  }
}

export function buildQrPauseCodeEmail(venueName: string, code: string) {
  return emailContent(`Confirm pausing customer scans — ${venueName}`, [
    `Your verification code is ${code}.`,
    `Enter this code in Venue QR to pause customer scans at ${venueName}. It expires in 10 minutes.`,
    "Requesting this code has not paused your QR. Do not share this code. If you did not request it, leave your QR unchanged and contact support.",
  ])
}

export function buildQrStatusEmail(input: QrStatusEmail) {
  const status = input.isActive ? "resumed" : "paused"
  const when = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(input.changedAt))
  const impact = !input.isActive
    ? "Customers cannot use this QR to join or collect stamps until it is resumed."
    : input.scansAvailable
      ? "Your Venue QR is live. Customers can use it to join and collect stamps, subject to the usual venue rules."
      : "Your QR has been resumed, but customer scans remain unavailable until the remaining setup or billing requirements are resolved."
  return emailContent(
    `Customer scans ${status} — ${input.venueName}`,
    [
      `Customer scans at ${input.venueName} were ${status} on ${when}.`,
      impact,
      "This confirms the change at the time shown. Open Venue QR to check the current status.",
    ],
    input.workspaceUrl
  )
}
