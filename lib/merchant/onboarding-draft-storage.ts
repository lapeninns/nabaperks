export const ONBOARDING_DRAFT_STORAGE_PREFIX = "nabaperks:onboarding-draft"

const ONBOARDING_DRAFT_VERSION = 1
const ONBOARDING_DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000
const ONBOARDING_DRAFT_FIELDS = [
  "businessName",
  "businessType",
  "phone",
  "addressLine1",
  "addressLine2",
  "addressCity",
  "addressPostcode",
] as const

type OnboardingDraftField = (typeof ONBOARDING_DRAFT_FIELDS)[number]

export type OnboardingDraftFields = {
  readonly businessName?: string
  readonly businessType?: string
  readonly phone?: string
  readonly addressLine1?: string
  readonly addressLine2?: string
  readonly addressCity?: string
  readonly addressPostcode?: string
}

type OnboardingDraftEnvelope = {
  readonly version: typeof ONBOARDING_DRAFT_VERSION
  readonly accountId: string
  readonly savedAt: number
  readonly fields: OnboardingDraftFields
}

export function onboardingDraftStorageKey(accountId: string): string {
  return `${ONBOARDING_DRAFT_STORAGE_PREFIX}:${accountId}`
}

export function readOnboardingDraft(
  storage: Storage,
  accountId: string,
  now: number = Date.now()
): OnboardingDraftFields | null {
  const key = onboardingDraftStorageKey(accountId)
  const raw = storage.getItem(key)
  if (!raw) return null

  const envelope = parseOnboardingDraft(raw)
  if (
    !envelope ||
    envelope.accountId !== accountId ||
    envelope.savedAt > now ||
    now - envelope.savedAt >= ONBOARDING_DRAFT_MAX_AGE_MS
  ) {
    storage.removeItem(key)
    return null
  }

  return envelope.fields
}

export function saveOnboardingDraft(
  storage: Storage,
  accountId: string,
  fields: OnboardingDraftFields,
  now: number = Date.now()
): void {
  const key = onboardingDraftStorageKey(accountId)
  storage.setItem(
    key,
    JSON.stringify({
      version: ONBOARDING_DRAFT_VERSION,
      accountId,
      savedAt: now,
      fields: compactOnboardingDraftFields(fields),
    } satisfies OnboardingDraftEnvelope)
  )
}

export function clearOnboardingDraft(
  storage: Storage,
  accountId: string
): void {
  storage.removeItem(onboardingDraftStorageKey(accountId))
}

function parseOnboardingDraft(raw: string): OnboardingDraftEnvelope | null {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) return null
    if (
      parsed.version !== ONBOARDING_DRAFT_VERSION ||
      typeof parsed.accountId !== "string" ||
      !parsed.accountId ||
      typeof parsed.savedAt !== "number" ||
      !Number.isFinite(parsed.savedAt) ||
      !isRecord(parsed.fields) ||
      !hasOnlyAllowedKeys(parsed.fields, ONBOARDING_DRAFT_FIELDS)
    ) {
      return null
    }

    const fields = readOnboardingDraftFields(parsed.fields)
    return fields
      ? {
          version: ONBOARDING_DRAFT_VERSION,
          accountId: parsed.accountId,
          savedAt: parsed.savedAt,
          fields,
        }
      : null
  } catch (error) {
    if (error instanceof SyntaxError) return null
    throw error
  }
}

function readOnboardingDraftFields(
  value: Record<string, unknown>
): OnboardingDraftFields | null {
  const fields: { [K in OnboardingDraftField]?: string } = {}

  for (const field of ONBOARDING_DRAFT_FIELDS) {
    const candidate = value[field]
    if (candidate === undefined) continue
    if (typeof candidate !== "string") return null
    fields[field] = candidate
  }

  return fields
}

function compactOnboardingDraftFields(
  fields: OnboardingDraftFields
): OnboardingDraftFields {
  const compacted: { [K in OnboardingDraftField]?: string } = {}

  for (const field of ONBOARDING_DRAFT_FIELDS) {
    const value = fields[field]
    if (typeof value === "string" && value.length > 0) compacted[field] = value
  }

  return compacted
}

function hasOnlyAllowedKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[]
): boolean {
  return Object.keys(value).every((key) => allowedKeys.includes(key))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
