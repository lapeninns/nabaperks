import "server-only"

import { logger } from "@/lib/observability/logger"
import type { QrAssetKind } from "@/lib/qr/assets"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

/** Private Supabase Storage bucket holding pre-generated QR print assets. */
export const QR_ASSET_BUCKET = "qr-assets"

export type ReadyQrAsset = {
  storagePath: string
  contentVersion: string
  byteSize: number | null
}

/**
 * Newest `ready` stored asset of a kind for a QR, or null when none exists yet
 * (still generating, failed, superseded) — callers fall back to the synchronous
 * SVG renderer in `lib/qr/assets.ts`.
 */
export async function resolveReadyQrAsset(
  qrCodeId: string,
  assetKind: QrAssetKind
): Promise<ReadyQrAsset | null> {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("qr_asset_jobs")
    .select("storage_path, content_version, byte_size, status")
    .eq("qr_code_id", qrCodeId)
    .eq("asset_kind", assetKind)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null

  const row = data as Record<string, unknown>
  if (row.status !== "ready") return null

  const storagePath = row.storage_path
  const contentVersion = row.content_version
  if (typeof storagePath !== "string" || typeof contentVersion !== "string") {
    return null
  }

  return {
    storagePath,
    contentVersion,
    byteSize: typeof row.byte_size === "number" ? row.byte_size : null,
  }
}

/** Download stored bytes from the private bucket, or null if unavailable. */
export async function downloadStoredQrAsset(
  storagePath: string
): Promise<Uint8Array | null> {
  const supabase = createSupabaseServiceRoleClient()
  const bucket = supabase.storage?.from?.(QR_ASSET_BUCKET)
  if (!bucket) return null

  const { data, error } = await bucket.download(storagePath)
  if (error || !data) return null

  const buffer = await data.arrayBuffer()
  return new Uint8Array(buffer)
}

export type QrPrintContext = {
  merchant: { id: string; business_name: string }
  location: { id: string; name: string }
  activeCard: {
    id: string
    card_name: string
    reward_name: string
    stamps_required: number
  }
  qrCode: { id: string; qr_id: string; is_active: boolean }
}

/** Constant-time-ish bearer check for the render worker (mirrors CRON_SECRET). */
export function verifyQrAssetWorkerToken(token: string | null | undefined) {
  const expected = process.env.QR_ASSET_WORKER_TOKEN?.trim()
  if (!expected || !token) return false
  return token === expected
}

/**
 * Trusted, cookie-less QR context for the render worker (service-role). The
 * print route uses this only after a valid worker token; merchant browsers use
 * the cookie-scoped getOwnedQrAssetContext instead.
 */
export async function getQrAssetContextForWorker(
  qrCodeId: string
): Promise<QrPrintContext | null> {
  const supabase = createSupabaseServiceRoleClient()
  const { data: qrCode } = await supabase
    .from("qr_codes")
    .select("id, qr_id, is_active, merchant_id, location_id, loyalty_card_id")
    .eq("id", qrCodeId)
    .maybeSingle()
  if (!qrCode) return null

  const qr = qrCode as Record<string, unknown>
  const [{ data: merchant }, { data: location }, { data: activeCard }] =
    await Promise.all([
      supabase
        .from("merchants")
        .select("id, business_name")
        .eq("id", qr.merchant_id)
        .maybeSingle(),
      supabase
        .from("merchant_locations")
        .select("id, name")
        .eq("id", qr.location_id)
        .maybeSingle(),
      supabase
        .from("loyalty_cards")
        .select("id, card_name, reward_name, stamps_required")
        .eq("id", qr.loyalty_card_id)
        .maybeSingle(),
    ])

  if (!merchant || !location || !activeCard) return null

  return {
    merchant: merchant as QrPrintContext["merchant"],
    location: location as QrPrintContext["location"],
    activeCard: activeCard as QrPrintContext["activeCard"],
    qrCode: {
      id: String(qr.id),
      qr_id: String(qr.qr_id),
      is_active: Boolean(qr.is_active),
    },
  }
}

/**
 * Resolve and stream the high-fidelity stored asset for a kind, or null when it
 * is not ready or storage is unreachable. Never throws: a miss is the signal to
 * fall back to the synchronous SVG renderer, so downloads never block on this.
 */
export async function loadReadyQrAssetBytes(
  qrCodeId: string,
  assetKind: QrAssetKind
): Promise<Uint8Array | null> {
  try {
    const stored = await resolveReadyQrAsset(qrCodeId, assetKind)
    if (!stored) return null
    return await downloadStoredQrAsset(stored.storagePath)
  } catch (error) {
    logger.warn("qr_asset_store_unavailable", {
      qrCodeId,
      assetKind,
      error,
    })
    return null
  }
}
