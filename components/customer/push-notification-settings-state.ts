export const PUSH_OPERATION_TIMEOUT_MS = 8_000

export type PushOperationResult<Value> =
  | { readonly kind: "fulfilled"; readonly value: Value }
  | { readonly kind: "rejected" }
  | { readonly kind: "timed-out" }

type PreferencePersistenceResult<Preferences> =
  | { readonly kind: "saved" }
  | { readonly kind: "rejected"; readonly rollback: Preferences }

type PersistPushPreferencesInput<Preferences> = {
  readonly next: Preferences
  readonly persist: () => Promise<boolean>
  readonly previous: Preferences
}

type PushPermissionResult = "default" | "denied" | "granted" | "unavailable"

export async function persistPushPreferences<Preferences>({
  previous,
  persist,
}: PersistPushPreferencesInput<Preferences>): Promise<
  PreferencePersistenceResult<Preferences>
> {
  try {
    return (await persist())
      ? { kind: "saved" }
      : { kind: "rejected", rollback: previous }
  } catch {
    return { kind: "rejected", rollback: previous }
  }
}

export async function requestPushPermission(
  request: () => Promise<NotificationPermission>
): Promise<PushPermissionResult> {
  const result = await settlePushOperation(request(), PUSH_OPERATION_TIMEOUT_MS)

  if (result.kind !== "fulfilled") return "unavailable"
  return result.value
}

export function isCurrentPushPreferenceRequest(
  currentRequest: number,
  request: number
): boolean {
  return currentRequest === request
}

export function settlePushOperation<Value>(
  operation: Promise<Value>,
  timeoutMs: number
): Promise<PushOperationResult<Value>> {
  return new Promise((resolve) => {
    const timeout = globalThis.setTimeout(
      () => resolve({ kind: "timed-out" }),
      timeoutMs
    )
    void operation.then(
      (value) => {
        globalThis.clearTimeout(timeout)
        resolve({ kind: "fulfilled", value })
      },
      () => {
        globalThis.clearTimeout(timeout)
        resolve({ kind: "rejected" })
      }
    )
  })
}
