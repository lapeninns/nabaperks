export type MerchantOnboardingDraftFields = Readonly<{
  businessName?: string
  businessType?: string
  phone?: string
  addressLine1?: string
  addressLine2?: string
  addressCity?: string
  addressPostcode?: string
}>

export type OnboardingDraftStorage = Pick<
  Storage,
  "getItem" | "removeItem" | "setItem"
>

const LEGACY_DRAFT_STORAGE_KEY = "nabaperks:onboarding-draft"
const ACTIVE_DRAFT_ACCOUNT_STORAGE_KEY =
  "nabaperks:onboarding-draft:active-account"
const PENDING_COMPLETION_ACCOUNT_STORAGE_KEY =
  "nabaperks:onboarding-draft:pending-completion-account"
const DRAFT_VERSION = 1
const DRAFT_TTL_MS = 86_400_000
const MAX_ACCOUNT_ID_LENGTH = 160
const MAX_FIELD_LENGTH = 240
const DRAFT_FIELD_NAMES = new Set([
  "businessName",
  "businessType",
  "phone",
  "addressLine1",
  "addressLine2",
  "addressCity",
  "addressPostcode",
])
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
  return `${LEGACY_DRAFT_STORAGE_KEY}:${accountId}`
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

export function readMerchantOnboardingDraft(
  storage: OnboardingDraftStorage,
  accountId: string,
  now = Date.now()
): MerchantOnboardingDraftFields {
  const key = merchantOnboardingDraftStorageKey(accountId)
  const stored = safelyRead(storage, key)
  if (stored === null) return {}

  let parsed: unknown
  try {
    parsed = JSON.parse(stored)
  } catch (error) {
    safelyRemove(storage, key)
    if (error instanceof SyntaxError) return {}
    throw error
  }

  const envelope = parseEnvelope(parsed)
  if (envelope) {
    const age = now - envelope.savedAt
    if (envelope.accountId !== accountId || age < 0 || age > DRAFT_TTL_MS) {
      safelyRemove(storage, key)
      return {}
    }
    return envelope.fields
  }

  const legacyFields = parseDraftFields(parsed)
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
  now = Date.now()
): boolean {
  if (!isValidAccountId(accountId)) return false
  const parsedFields = parseDraftFields(fields)
  if (!parsedFields) return false

  const envelope = {
    accountId,
    fields: parsedFields,
    savedAt: now,
    version: DRAFT_VERSION,
  }

  try {
    storage.setItem(
      merchantOnboardingDraftStorageKey(accountId),
      JSON.stringify(envelope)
    )
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
  return safelyRemove(storage, LEGACY_DRAFT_STORAGE_KEY)
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

export function clearActiveMerchantOnboardingDraft(
  draftStorage: OnboardingDraftStorage,
  accountStorage: OnboardingDraftStorage
): boolean {
  const accountId = safelyRead(accountStorage, ACTIVE_DRAFT_ACCOUNT_STORAGE_KEY)
  const draftCleared = accountId
    ? clearMerchantOnboardingDraft(draftStorage, accountId)
    : true
  const accountCleared = safelyRemove(
    accountStorage,
    ACTIVE_DRAFT_ACCOUNT_STORAGE_KEY
  )
  return draftCleared && accountCleared
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
  const cleared = clearActiveMerchantOnboardingDraft(
    draftStorage,
    accountStorage
  )
  const pendingCleared =
    clearMerchantOnboardingCompletionPending(accountStorage)
  return cleared && pendingCleared
}

export function activeMerchantOnboardingDraftAccount(
  storage: OnboardingDraftStorage
): string | null {
  const accountId = safelyRead(storage, ACTIVE_DRAFT_ACCOUNT_STORAGE_KEY)
  return accountId && isValidAccountId(accountId) ? accountId : null
}

type DraftEnvelope = Readonly<{
  accountId: string
  fields: MerchantOnboardingDraftFields
  savedAt: number
}>

function parseEnvelope(value: unknown): DraftEnvelope | null {
  if (!isRecord(value)) return null
  const keys = Object.keys(value)
  if (
    keys.length !== 4 ||
    !keys.every((key) =>
      ["accountId", "fields", "savedAt", "version"].includes(key)
    ) ||
    value.version !== DRAFT_VERSION ||
    !isValidAccountId(value.accountId) ||
    typeof value.savedAt !== "number" ||
    !Number.isFinite(value.savedAt)
  ) {
    return null
  }
  const fields = parseDraftFields(value.fields)
  return fields
    ? { accountId: value.accountId, fields, savedAt: value.savedAt }
    : null
}

function parseDraftFields(
  value: unknown
): MerchantOnboardingDraftFields | null {
  if (!isRecord(value)) return null
  if (!Object.keys(value).every((key) => DRAFT_FIELD_NAMES.has(key))) {
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

  return {
    ...(typeof value.businessName === "string"
      ? { businessName: value.businessName }
      : {}),
    ...(typeof value.businessType === "string"
      ? { businessType: value.businessType }
      : {}),
    ...(typeof value.phone === "string" ? { phone: value.phone } : {}),
    ...(typeof value.addressLine1 === "string"
      ? { addressLine1: value.addressLine1 }
      : {}),
    ...(typeof value.addressLine2 === "string"
      ? { addressLine2: value.addressLine2 }
      : {}),
    ...(typeof value.addressCity === "string"
      ? { addressCity: value.addressCity }
      : {}),
    ...(typeof value.addressPostcode === "string"
      ? { addressPostcode: value.addressPostcode }
      : {}),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
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
