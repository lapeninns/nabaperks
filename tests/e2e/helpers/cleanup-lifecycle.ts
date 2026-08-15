const FORBIDDEN_SCOPE_NAMES = new Set(["all", "any", "global", "shared"])
const SCOPE_PATTERN = /^[a-z0-9][a-z0-9-]{2,79}$/

export type CleanupScope = {
  readonly namespace: string
}

export type CleanupStep = {
  readonly label: string
  readonly run: (signal: AbortSignal) => Promise<void>
  readonly scope: CleanupScope
  readonly timeoutMs?: number
}

export class CleanupScopeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "CleanupScopeError"
  }
}

export class CleanupStepError extends Error {
  readonly label: string

  constructor(label: string, cause: unknown) {
    super(`${label} failed.`, { cause })
    this.name = "CleanupStepError"
    this.label = label
  }
}

export class CleanupStepTimeoutError extends Error {
  readonly label: string
  readonly timeoutMs: number

  constructor(label: string, timeoutMs: number) {
    super(`${label} exceeded ${timeoutMs}ms.`)
    this.name = "CleanupStepTimeoutError"
    this.label = label
    this.timeoutMs = timeoutMs
  }
}

export function cleanupScope(namespace: string): CleanupScope {
  const normalized = namespace.trim().toLowerCase()
  if (
    !SCOPE_PATTERN.test(normalized) ||
    FORBIDDEN_SCOPE_NAMES.has(normalized)
  ) {
    throw new CleanupScopeError(
      "Cleanup scope must identify one owned fixture."
    )
  }
  return { namespace: normalized }
}

export async function runCleanupSteps(
  scope: CleanupScope,
  steps: readonly CleanupStep[],
  message: string
): Promise<void> {
  const pending = [...steps]
  const failures: CleanupStepError[] = []

  for (const step of pending.reverse()) {
    if (step.scope.namespace !== scope.namespace) {
      failures.push(
        new CleanupStepError(
          step.label,
          new CleanupScopeError("Cleanup step belongs to a foreign fixture.")
        )
      )
      continue
    }

    try {
      await runBoundedStep(step)
    } catch (error) {
      failures.push(new CleanupStepError(step.label, error))
    }
  }

  if (failures.length > 0) {
    throw new AggregateError(failures, message)
  }
}

async function runBoundedStep(step: CleanupStep): Promise<void> {
  const controller = new AbortController()
  if (step.timeoutMs === undefined) {
    await step.run(controller.signal)
    return
  }

  const timeoutMs = step.timeoutMs
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1) {
    throw new CleanupStepTimeoutError(step.label, timeoutMs)
  }

  let timeout: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => {
      controller.abort()
      reject(new CleanupStepTimeoutError(step.label, timeoutMs))
    }, timeoutMs)
  })

  try {
    await Promise.race([step.run(controller.signal), timeoutPromise])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}
