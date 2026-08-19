export const ONBOARDING_DRAFT_STORAGE_PREFIX = "nabaperks:onboarding-draft"

export type OnboardingDraftStorage = Pick<
  Storage,
  "getItem" | "removeItem" | "setItem"
>

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
  storage: OnboardingDraftStorage,
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
  storage: OnboardingDraftStorage,
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
  storage: OnboardingDraftStorage,
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

export type MerchantOnboardingDraftFields = Readonly<OnboardingDraftFields>

const ACTIVE_DRAFT_ACCOUNT_STORAGE_KEY =
  "nabaperks:onboarding-draft:active-account"
const PENDING_COMPLETION_ACCOUNT_STORAGE_KEY =
  "nabaperks:onboarding-draft:pending-completion-account"
const MAX_ACCOUNT_ID_LENGTH = 160
const MAX_FIELD_LENGTH = 240
const BUSINESS_TYPES = new Set([
  "cafe",
  "dessert",
  "bubble_tea",
  "pub",
  "takeaway",
  "barber",
  "salon",
  "other",
])

export function merchantOnboardingDraftStorageKey(accountId: string): string {
  return onboardingDraftStorageKey(accountId)
}

export function readMerchantOnboardingDraft(
  storage: OnboardingDraftStorage,
  accountId: string,
  now: number = Date.now()
): MerchantOnboardingDraftFields {
  const key = merchantOnboardingDraftStorageKey(accountId)
  const raw = safelyRead(storage, key)
  if (raw === null) return {}

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    safelyRemove(storage, key)
    if (error instanceof SyntaxError) return {}
    throw error
  }

  const envelope = parseOnboardingDraft(raw)
  if (envelope) {
    const age = now - envelope.savedAt
    if (
      envelope.accountId !== accountId ||
      age < 0 ||
      age > ONBOARDING_DRAFT_MAX_AGE_MS
    ) {
      safelyRemove(storage, key)
      return {}
    }
    return envelope.fields
  }

  if (hasEnvelopeKeys(parsed)) {
    safelyRemove(storage, key)
    return {}
  }

  const legacyFields = parseLegacyDraftFields(parsed)
  if (!legacyFields) {
    safelyRemove(storage, key)
    return {}
  }

  writeMerchantOnboardingDraft(storage, accountId, legacyFields, now)
  return legacyFields
}

export function writeMerchantOnboardingDraft(
  storage: OnboardingDraftStorage,
  accountId: string,
  fields: MerchantOnboardingDraftFields,
  now: number = Date.now()
): boolean {
  if (!isValidAccountId(accountId) || !parseLegacyDraftFields(fields)) {
    return false
  }
  try {
    saveOnboardingDraft(storage, accountId, fields, now)
    return true
  } catch (error) {
    if (error instanceof Error) return false
    throw error
  }
}

export function clearMerchantOnboardingDraft(
  storage: OnboardingDraftStorage,
  accountId: string
): boolean {
  return safelyRemove(storage, merchantOnboardingDraftStorageKey(accountId))
}

export function removeLegacyMerchantOnboardingDraft(
  storage: OnboardingDraftStorage
): boolean {
  return safelyRemove(storage, ONBOARDING_DRAFT_STORAGE_PREFIX)
}

export function rememberActiveMerchantOnboardingDraftAccount(
  storage: OnboardingDraftStorage,
  accountId: string
): boolean {
  if (!isValidAccountId(accountId)) return false
  try {
    storage.setItem(ACTIVE_DRAFT_ACCOUNT_STORAGE_KEY, accountId)
    return true
  } catch (error) {
    if (error instanceof Error) return false
    throw error
  }
}

export function activeMerchantOnboardingDraftAccount(
  storage: OnboardingDraftStorage
): string | null {
  const accountId = safelyRead(storage, ACTIVE_DRAFT_ACCOUNT_STORAGE_KEY)
  return accountId && isValidAccountId(accountId) ? accountId : null
}

export function clearActiveMerchantOnboardingDraft(
  draftStorage: OnboardingDraftStorage,
  accountStorage: OnboardingDraftStorage
): boolean {
  const accountId = activeMerchantOnboardingDraftAccount(accountStorage)
  const draftCleared = accountId
    ? clearMerchantOnboardingDraft(draftStorage, accountId)
    : true
  const accountCleared = safelyRemove(
    accountStorage,
    ACTIVE_DRAFT_ACCOUNT_STORAGE_KEY
  )
  return draftCleared && accountCleared
}

export function clearErasedMerchantOnboardingDraft(
  draftStorage: OnboardingDraftStorage,
  accountStorage: OnboardingDraftStorage,
  erasedAccountId: string
): boolean {
  const activeAccountId = activeMerchantOnboardingDraftAccount(accountStorage)
  if (!activeAccountId || activeAccountId !== erasedAccountId) return false
  return clearActiveMerchantOnboardingDraft(draftStorage, accountStorage)
}

export function markMerchantOnboardingCompletionPending(
  storage: OnboardingDraftStorage,
  accountId: string
): boolean {
  if (!isValidAccountId(accountId)) return false
  try {
    storage.setItem(PENDING_COMPLETION_ACCOUNT_STORAGE_KEY, accountId)
    return true
  } catch (error) {
    if (error instanceof Error) return false
    throw error
  }
}

export function clearMerchantOnboardingCompletionPending(
  storage: OnboardingDraftStorage
): boolean {
  return safelyRemove(storage, PENDING_COMPLETION_ACCOUNT_STORAGE_KEY)
}

export function clearCompletedMerchantOnboardingDraft(
  draftStorage: OnboardingDraftStorage,
  accountStorage: OnboardingDraftStorage
): boolean {
  const activeAccountId = activeMerchantOnboardingDraftAccount(accountStorage)
  const pendingAccountId = safelyRead(
    accountStorage,
    PENDING_COMPLETION_ACCOUNT_STORAGE_KEY
  )
  if (!activeAccountId || pendingAccountId !== activeAccountId) return false
  const draftCleared = clearActiveMerchantOnboardingDraft(
    draftStorage,
    accountStorage
  )
  const pendingCleared =
    clearMerchantOnboardingCompletionPending(accountStorage)
  return draftCleared && pendingCleared
}

function parseLegacyDraftFields(
  value: unknown
): MerchantOnboardingDraftFields | null {
  if (!isRecord(value) || !hasOnlyAllowedKeys(value, ONBOARDING_DRAFT_FIELDS)) {
    return null
  }
  for (const fieldValue of Object.values(value)) {
    if (
      typeof fieldValue !== "string" ||
      fieldValue.length > MAX_FIELD_LENGTH
    ) {
      return null
    }
  }
  if (
    typeof value.businessType === "string" &&
    !BUSINESS_TYPES.has(value.businessType)
  ) {
    return null
  }
  return readOnboardingDraftFields(value)
}

function hasEnvelopeKeys(value: unknown): boolean {
  return (
    isRecord(value) &&
    ["version", "accountId", "savedAt", "fields"].some((key) => key in value)
  )
}

function isValidAccountId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= MAX_ACCOUNT_ID_LENGTH
  )
}

function safelyRead(
  storage: OnboardingDraftStorage,
  key: string
): string | null {
  try {
    return storage.getItem(key)
  } catch (error) {
    if (error instanceof Error) return null
    throw error
  }
}

function safelyRemove(storage: OnboardingDraftStorage, key: string): boolean {
  try {
    storage.removeItem(key)
    return true
  } catch (error) {
    if (error instanceof Error) return false
    throw error
  }
}
