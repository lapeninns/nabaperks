import { buildQrStatusEmail } from "@/lib/notifications/qr-status-email"

export type QrStatusDeliveryRow = {
  id: string
  lease_id: string
  recipient: string
  venue_name: string
  is_active: boolean
  scans_available: boolean
  changed_at: string
}
export type QrEmailOutcome = "sent" | "temporary" | "permanent"

export function qrEmailFailureOutcome(error: unknown): QrEmailOutcome {
  // The shared adapter includes the HTTP status but may also include provider
  // details. Classify here without exposing the message to logs or the browser.
  const match =
    error instanceof Error
      ? /^Resend send failed \((\d{3})\):/.exec(error.message)
      : null
  const status = match ? Number(match[1]) : 0
  return status >= 400 && status < 500 && ![408, 409, 429].includes(status)
    ? "permanent"
    : "temporary"
}

export async function deliverQrStatusEmail({
  row,
  workspaceUrl,
  send,
  finish,
}: {
  row: QrStatusDeliveryRow
  workspaceUrl: string
  send: (
    input: ReturnType<typeof buildQrStatusEmail> & {
      to: string
      idempotencyKey: string
    }
  ) => Promise<void>
  finish: (outcome: QrEmailOutcome) => Promise<boolean>
}) {
  let outcome: QrEmailOutcome = "sent"
  try {
    await send({
      to: row.recipient,
      idempotencyKey: `qr-status:${row.id}`,
      ...buildQrStatusEmail({
        venueName: row.venue_name,
        isActive: row.is_active,
        scansAvailable: row.scans_available,
        changedAt: row.changed_at,
        workspaceUrl,
      }),
    })
  } catch (error) {
    outcome = qrEmailFailureOutcome(error)
  }
  const recorded = await finish(outcome)
  return recorded && outcome === "sent"
}
