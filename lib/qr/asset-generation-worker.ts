import "server-only"

import { recordProductEvent } from "@/lib/analytics/events"
import { logger } from "@/lib/observability/logger"
import { QR_ASSET_BUCKET } from "@/lib/qr/asset-store"
import type { QrAssetKind } from "@/lib/qr/assets"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export type QrAssetJob = {
  id: string
  qr_code_id: string
  merchant_id: string
  asset_kind: QrAssetKind
  content_version: string
}

/**
 * Renders a job to bytes. Injected so the orchestration is testable without a
 * browser; the deployed worker passes a Playwright-backed implementation that
 * drives the `/qr/print` route.
 */
export type QrAssetRenderer = (job: QrAssetJob) => Promise<Uint8Array>

export type QrAssetWorkerResult = {
  processed: number
  generated: number
  failed: number
  skipped: number
}

type ServiceClient = ReturnType<typeof createSupabaseServiceRoleClient>

const ASSET_EXTENSION: Record<QrAssetKind, string> = {
  poster_pdf: "pdf",
  till_card_png: "png",
  sticker_png: "png",
}

const ASSET_CONTENT_TYPE: Record<QrAssetKind, string> = {
  poster_pdf: "application/pdf",
  till_card_png: "image/png",
  sticker_png: "image/png",
}

/** Content-addressed object path: regenerating a different version never
 * overwrites a live asset, so there is no stale-cache window. */
export function qrAssetStoragePath(job: QrAssetJob) {
  return `${job.qr_code_id}/${job.asset_kind}/${job.content_version}.${ASSET_EXTENSION[job.asset_kind]}`
}

export async function runQrAssetGenerationWorker({
  renderAsset,
  now = new Date(),
  batchSize = 25,
}: {
  renderAsset: QrAssetRenderer
  now?: Date
  batchSize?: number
}): Promise<QrAssetWorkerResult> {
  const supabase = createSupabaseServiceRoleClient()
  const result: QrAssetWorkerResult = {
    processed: 0,
    generated: 0,
    failed: 0,
    skipped: 0,
  }

  const { data, error } = await supabase
    .from("qr_asset_jobs")
    .select("id, qr_code_id, merchant_id, asset_kind, content_version")
    .eq("status", "queued")
    .lte("due_at", now.toISOString())
    .order("due_at", { ascending: true })
    .limit(batchSize)

  if (error) {
    throw new Error(`Unable to load due QR asset jobs: ${error.message}`)
  }

  const jobResults = await Promise.all(
    ((data ?? []) as QrAssetJob[]).map((job) =>
      processQrAssetJob(supabase, renderAsset, job)
    )
  )
  for (const jobResult of jobResults) {
    result.processed += jobResult.processed
    result.generated += jobResult.generated
    result.failed += jobResult.failed
    result.skipped += jobResult.skipped
  }

  void recordWorkerRan(result)
  return result
}

async function processQrAssetJob(
  supabase: ServiceClient,
  renderAsset: QrAssetRenderer,
  job: QrAssetJob
): Promise<QrAssetWorkerResult> {
  const result: QrAssetWorkerResult = {
    processed: 1,
    generated: 0,
    failed: 0,
    skipped: 0,
  }
  const claimed = await claimJob(supabase, job.id)
  if (!claimed) {
    result.skipped = 1
    return result
  }

  try {
    const bytes = await renderAsset(job)
    const storagePath = qrAssetStoragePath(job)
    await uploadAsset(supabase, storagePath, job.asset_kind, bytes)
    const { error } = await supabase.rpc("record_qr_asset_generated", {
      p_qr_code_id: job.qr_code_id,
      p_asset_kind: job.asset_kind,
      p_storage_path: storagePath,
      p_content_version: job.content_version,
      p_byte_size: bytes.byteLength,
    })
    if (error) throw new Error(error.message)
    result.generated = 1
  } catch (renderError) {
    const failure =
      renderError instanceof Error
        ? renderError
        : new Error(String(renderError))
    await failJob(supabase, job.id, failure)
    result.failed = 1
  }

  return result
}

async function claimJob(supabase: ServiceClient, jobId: string) {
  const { data, error } = await supabase
    .from("qr_asset_jobs")
    .update({ status: "rendering" })
    .eq("id", jobId)
    .eq("status", "queued")
    .select("id")

  if (error) return false
  return Array.isArray(data) ? data.length > 0 : Boolean(data)
}

async function uploadAsset(
  supabase: ServiceClient,
  storagePath: string,
  assetKind: QrAssetKind,
  bytes: Uint8Array
) {
  const { error } = await supabase.storage
    .from(QR_ASSET_BUCKET)
    .upload(storagePath, bytes, {
      contentType: ASSET_CONTENT_TYPE[assetKind],
      upsert: true,
    })

  if (error) throw new Error(`Unable to upload QR asset: ${error.message}`)
}

async function failJob(supabase: ServiceClient, jobId: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  await supabase
    .from("qr_asset_jobs")
    .update({ status: "failed", last_error: message })
    .eq("id", jobId)

  void recordProductEvent({
    eventName: "qr_asset_generation_failed",
    actorType: "system",
    metadata: { job_id: jobId, reason: message },
  }).catch(() => {})
}

async function recordWorkerRan(result: QrAssetWorkerResult) {
  try {
    await recordProductEvent({
      eventName: "qr_asset_worker_ran",
      actorType: "system",
      metadata: { ...result },
    })
  } catch (error) {
    const productEventError =
      error instanceof Error ? error : new Error(String(error))
    logger.warn("qr_asset_worker_product_event_failed", {
      error: productEventError,
    })
  }
}
