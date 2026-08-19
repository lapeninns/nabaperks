export type PushPreferences = {
  transactionalEnabled: boolean
  reminderEnabled: boolean
  marketingEnabled: boolean
  quietHoursStart: string | null
  quietHoursEnd: string | null
  activeSubscriptionCount: number
}

export const PUSH_OPERATION_TIMEOUT_MS = 8_000

export class PushOperationTimeoutError extends Error {
  override readonly name = "PushOperationTimeoutError"
}

export type PushPreferenceSaveResult =
  | { readonly kind: "saved"; readonly response: Response }
  | { readonly kind: "failed" }

export type PushPermissionResult = "granted" | "denied" | "default"

export async function awaitPushOperation<T>(
  operation: Promise<T>,
  timeoutMs = PUSH_OPERATION_TIMEOUT_MS
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () => reject(new PushOperationTimeoutError("Push operation timed out.")),
      timeoutMs
    )
  })

  try {
    return await Promise.race([operation, timeout])
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}

export async function savePushPreferences(
  preferences: PushPreferences
): Promise<PushPreferenceSaveResult> {
  try {
    const response = await fetch("/api/notifications/push/preferences", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(preferences),
    })
    return response.ok ? { kind: "saved", response } : { kind: "failed" }
  } catch {
    return { kind: "failed" }
  }
}

export function requestPushPermission(
  currentPermission: PushPermissionResult,
  requestPermission: () => Promise<PushPermissionResult>
): Promise<PushPermissionResult> {
  return currentPermission === "granted"
    ? Promise.resolve("granted")
    : awaitPushOperation(requestPermission())
}
