import { trustedSupabaseProjectOrigin } from "@/lib/observability/readiness"
import {
  OPERATIONAL_CRON_JOBS,
  type OperationalCronJob,
} from "@/lib/observability/cron-jobs"

type CronJobState = "warming" | "ok" | "failing" | "stale"

export type OperationalSignals = {
  readonly notificationQueueAgeMinutes: number
  readonly loyaltyInviteQueueAgeMinutes: number
  readonly providerDeliveryAttempts24h: number
  readonly providerDeliveryFailures24h: number
  readonly providerDeliveryFailureRate24h: number
  readonly cronJobs: readonly {
    readonly name: OperationalCronJob
    readonly state: CronJobState
    readonly consecutiveFailures: number
    readonly lastCompletedAt: string | null
  }[]
}

export type OperationalReadiness = {
  readonly operational: "ok" | "error"
  readonly signals: OperationalSignals | null
}

type OperationalThresholds = {
  readonly notificationQueueAgeMinutes: number
  readonly loyaltyInviteQueueAgeMinutes: number
  readonly providerDeliveryFailureRate: number
  readonly consecutiveCronFailures: number
}

type OperationalReadinessOptions = {
  readonly supabaseUrl: string | undefined
  readonly serviceRoleKey: string | undefined
  readonly thresholds: OperationalThresholds
  readonly requireCronHealth?: boolean
  readonly fetcher?: typeof fetch
  readonly timeoutMs?: number
}

export async function checkOperationalReadiness({
  supabaseUrl,
  serviceRoleKey,
  thresholds,
  requireCronHealth = true,
  fetcher = fetch,
  timeoutMs = 3_000,
}: OperationalReadinessOptions): Promise<OperationalReadiness> {
  if (!supabaseUrl?.trim() || !serviceRoleKey?.trim()) {
    return operationalError()
  }

  try {
    const origin = trustedSupabaseProjectOrigin(supabaseUrl)
    if (!origin || !validThresholds(thresholds)) return operationalError()

    const response = await fetcher(
      new URL("/rest/v1/rpc/production_operational_signals", origin),
      {
        method: "POST",
        headers: {
          apikey: serviceRoleKey,
          authorization: `Bearer ${serviceRoleKey}`,
          "content-type": "application/json",
        },
        body: "{}",
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(timeoutMs),
      }
    )
    if (!response.ok) return operationalError()

    const signals = parseOperationalSignals(await response.json())
    if (!signals) return operationalError()

    return {
      operational: signalsAreHealthy(signals, thresholds, requireCronHealth)
        ? "ok"
        : "error",
      signals,
    }
  } catch {
    return operationalError()
  }
}

function operationalError(): OperationalReadiness {
  return { operational: "error", signals: null }
}

function signalsAreHealthy(
  signals: OperationalSignals,
  thresholds: OperationalThresholds,
  requireCronHealth: boolean
): boolean {
  const cronHealthy =
    !requireCronHealth ||
    signals.cronJobs.every(
      (job) =>
        (job.state === "ok" || job.state === "warming") &&
        job.consecutiveFailures < thresholds.consecutiveCronFailures
    )

  return (
    signals.notificationQueueAgeMinutes <=
      thresholds.notificationQueueAgeMinutes &&
    signals.loyaltyInviteQueueAgeMinutes <=
      thresholds.loyaltyInviteQueueAgeMinutes &&
    signals.providerDeliveryFailureRate24h <=
      thresholds.providerDeliveryFailureRate &&
    cronHealthy
  )
}

function parseOperationalSignals(value: unknown): OperationalSignals | null {
  if (!isRecord(value)) return null

  const {
    notificationQueueAgeMinutes,
    loyaltyInviteQueueAgeMinutes,
    providerDeliveryAttempts24h,
    providerDeliveryFailures24h,
    providerDeliveryFailureRate24h,
    cronJobs,
  } = value

  if (
    !isNonNegativeNumber(notificationQueueAgeMinutes) ||
    !isNonNegativeNumber(loyaltyInviteQueueAgeMinutes) ||
    !isNonNegativeInteger(providerDeliveryAttempts24h) ||
    !isNonNegativeInteger(providerDeliveryFailures24h) ||
    providerDeliveryFailures24h > providerDeliveryAttempts24h ||
    !isRate(providerDeliveryFailureRate24h) ||
    !Array.isArray(cronJobs)
  ) {
    return null
  }

  const parsedCronJobs = cronJobs.map(parseCronJob)
  if (parsedCronJobs.some((job) => job === null)) return null

  const jobs = parsedCronJobs as OperationalSignals["cronJobs"]
  if (
    jobs.length !== OPERATIONAL_CRON_JOBS.length ||
    new Set(jobs.map(({ name }) => name)).size !==
      OPERATIONAL_CRON_JOBS.length ||
    OPERATIONAL_CRON_JOBS.some((name) => !jobs.some((job) => job.name === name))
  ) {
    return null
  }

  return {
    notificationQueueAgeMinutes,
    loyaltyInviteQueueAgeMinutes,
    providerDeliveryAttempts24h,
    providerDeliveryFailures24h,
    providerDeliveryFailureRate24h,
    cronJobs: jobs,
  }
}

function parseCronJob(
  value: unknown
): OperationalSignals["cronJobs"][number] | null {
  if (!isRecord(value)) return null
  const { name, state, consecutiveFailures, lastCompletedAt } = value
  if (
    !isCronJobName(name) ||
    !isCronJobState(state) ||
    !isNonNegativeInteger(consecutiveFailures) ||
    !isTimestampOrNull(lastCompletedAt)
  ) {
    return null
  }
  return { name, state, consecutiveFailures, lastCompletedAt }
}

function validThresholds(value: OperationalThresholds): boolean {
  return (
    isNonNegativeNumber(value.notificationQueueAgeMinutes) &&
    isNonNegativeNumber(value.loyaltyInviteQueueAgeMinutes) &&
    isRate(value.providerDeliveryFailureRate) &&
    Number.isInteger(value.consecutiveCronFailures) &&
    value.consecutiveCronFailures >= 1
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
}

function isNonNegativeInteger(value: unknown): value is number {
  return isNonNegativeNumber(value) && Number.isInteger(value)
}

function isRate(value: unknown): value is number {
  return isNonNegativeNumber(value) && value <= 1
}

function isCronJobName(value: unknown): value is OperationalCronJob {
  return (
    typeof value === "string" &&
    (OPERATIONAL_CRON_JOBS as readonly string[]).includes(value)
  )
}

function isCronJobState(value: unknown): value is CronJobState {
  return (
    value === "warming" ||
    value === "ok" ||
    value === "failing" ||
    value === "stale"
  )
}

function isTimestampOrNull(value: unknown): value is string | null {
  return (
    value === null ||
    (typeof value === "string" && Number.isFinite(Date.parse(value)))
  )
}
