import "server-only"

import { type OperationalCronJob } from "@/lib/observability/cron-jobs"
import { logger } from "@/lib/observability/logger"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

type ObservedCronOptions<T> = {
  readonly job: OperationalCronJob
  readonly run: () => Promise<T>
  readonly isSuccessful?: (value: T) => boolean
  readonly failureCode?: (value: T) => string
}

export type ObservedCronResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false }

export async function runObservedCron<T>({
  job,
  run,
  isSuccessful = () => true,
  failureCode = () => "job_failed",
}: ObservedCronOptions<T>): Promise<ObservedCronResult<T>> {
  const startedAt = new Date()
  const startedAtMs = Date.now()

  try {
    const value = await run()
    const succeeded = isSuccessful(value)
    const recorded = await recordCronRun({
      job,
      startedAt,
      startedAtMs,
      succeeded,
      errorCode: succeeded ? null : failureCode(value),
    })

    return succeeded && recorded ? { ok: true, value } : { ok: false }
  } catch (error) {
    await recordCronRun({
      job,
      startedAt,
      startedAtMs,
      succeeded: false,
      errorCode: "job_threw",
    })
    logger.warn("operational_cron_job_failed", {
      job,
      reason: error instanceof Error ? error.name : "unknown_error",
    })
    return { ok: false }
  }
}

async function recordCronRun({
  job,
  startedAt,
  startedAtMs,
  succeeded,
  errorCode,
}: {
  readonly job: OperationalCronJob
  readonly startedAt: Date
  readonly startedAtMs: number
  readonly succeeded: boolean
  readonly errorCode: string | null
}): Promise<boolean> {
  try {
    const completedAt = new Date()
    const supabase = createSupabaseServiceRoleClient()
    const { error } = await supabase.rpc("record_operational_cron_run", {
      p_job_name: job,
      p_succeeded: succeeded,
      p_started_at: startedAt.toISOString(),
      p_completed_at: completedAt.toISOString(),
      p_duration_ms: Math.max(0, Date.now() - startedAtMs),
      p_error_code: errorCode,
    })

    if (!error) return true
  } catch {
    // Collapse local configuration and transport failures to one safe signal.
  }

  logger.warn("operational_cron_record_failed", {
    job,
    reason: "database_rejected",
  })
  return false
}
