import type { MerchantDashboardTrends } from "@/lib/merchant/dashboard-trends"

export type MerchantWeeklyDigestMetrics = {
  readonly members: number
  readonly newMembers: number
  readonly stampsIssued: number
  readonly repeatCustomers: number
  readonly rewardsRedeemed: number
  readonly qrDownloads: number
}

export type MerchantWeeklyDigestEmailInput = {
  readonly businessName: string
  readonly metrics: MerchantWeeklyDigestMetrics
  readonly trends: MerchantDashboardTrends
}

export type MerchantWeeklyDigestEmail = {
  readonly subject: string
  readonly text: string
  readonly html: string
}

type DigestMetricRow = {
  readonly label: string
  readonly value: number
  readonly trendLabel?: string
}

const countFormatter = new Intl.NumberFormat("en-GB")
const optOutCopy =
  "Reply to this email if you'd rather not receive weekly summaries."

export function buildMerchantWeeklyDigestEmail({
  businessName,
  metrics,
  trends,
}: MerchantWeeklyDigestEmailInput): MerchantWeeklyDigestEmail {
  const rows: readonly DigestMetricRow[] = [
    { label: "Members", value: metrics.members },
    {
      label: "New members",
      value: metrics.newMembers,
      trendLabel: trends.newMembers.label,
    },
    {
      label: "Stamps issued",
      value: metrics.stampsIssued,
      trendLabel: trends.stamps.label,
    },
    { label: "Repeat customers", value: metrics.repeatCustomers },
    {
      label: "Rewards redeemed",
      value: metrics.rewardsRedeemed,
      trendLabel: trends.rewards.label,
    },
    {
      label: "QR downloads",
      value: metrics.qrDownloads,
      trendLabel: trends.qrDownloads.label,
    },
  ]
  const subject = `Your week at ${businessName}`
  const text = [
    subject,
    "",
    "Here is the short version from your Nabaperks dashboard.",
    "",
    ...rows.map(textMetricRow),
    "",
    optOutCopy,
  ].join("\n")
  const safeBusinessName = escapeHtml(businessName)

  return {
    subject,
    text,
    html: `<html>
  <body style="margin:0;background:#f6f1e6;font-family:Arial,Helvetica,sans-serif;color:#211c16;padding:24px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#fbf8f1;border:2px solid #211c16;border-radius:10px;box-shadow:4px 4px 0 #211c16">
      <tr><td style="padding:24px">
        <div style="display:inline-block;margin:0 0 16px;background:#cf330a;color:#fff;border:2px solid #211c16;border-radius:999px;padding:8px 11px;font-size:18px;font-weight:800;line-height:1;box-shadow:3px 3px 0 #211c16">*</div>
        <p style="margin:0 0 8px;font:700 11px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;color:#4f473d">Nabaperks weekly digest</p>
        <h1 style="margin:0 0 12px;font-size:24px;line-height:1.15;font-weight:800">Your week at ${safeBusinessName}</h1>
        <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#4f473d">Here is the short version from your Nabaperks dashboard.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#f6f1e6;border:2px solid #211c16;border-radius:10px;overflow:hidden">
          ${rows.map(htmlMetricRow).join("")}
        </table>
        <p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#4f473d">${escapeHtml(optOutCopy)}</p>
      </td></tr>
    </table>
  </body>
</html>`,
  }
}

function textMetricRow(row: DigestMetricRow): string {
  const value = countFormatter.format(row.value)
  return row.trendLabel
    ? `${row.label}: ${value} (${row.trendLabel})`
    : `${row.label}: ${value}`
}

function htmlMetricRow(row: DigestMetricRow): string {
  const value = escapeHtml(countFormatter.format(row.value))
  const trend = row.trendLabel
    ? `<span style="display:block;margin-top:4px;font-size:12px;line-height:1.4;color:#4f473d">${escapeHtml(row.trendLabel)}</span>`
    : ""

  return `<tr>
            <td style="padding:12px 14px;border-bottom:1px solid #211c16;font-size:14px;line-height:1.4;color:#4f473d">${escapeHtml(row.label)}</td>
            <td style="padding:12px 14px;border-bottom:1px solid #211c16;text-align:right;font:800 18px ui-monospace,SFMono-Regular,Menlo,monospace;color:#211c16">${value}${trend}</td>
          </tr>`
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}
