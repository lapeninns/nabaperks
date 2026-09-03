// Resilience primitives for outbound calls to third-party services (Twilio,
// Resend, Nominatim, …): bounded exponential-backoff retry and a per-service
// circuit breaker. Both inject their clock/sleep so behaviour is deterministic
// under test and identical on the happy path (a single call, no added latency).

export type RetryOptions = {
  /** Number of retries *after* the first attempt. */
  retries?: number
  minDelayMs?: number
  maxDelayMs?: number
  factor?: number
  shouldRetry?: (error: unknown) => boolean
  onRetry?: (error: unknown, attempt: number) => void
  sleep?: (ms: number) => Promise<void>
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms))

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    retries = 2,
    minDelayMs = 100,
    maxDelayMs = 2_000,
    factor = 2,
    shouldRetry = () => true,
    onRetry,
    sleep = defaultSleep,
  } = options

  let attempt = 0
  for (;;) {
    try {
      return await fn()
    } catch (error) {
      if (attempt >= retries || !shouldRetry(error)) throw error
      const delay = Math.min(maxDelayMs, minDelayMs * factor ** attempt)
      onRetry?.(error, attempt + 1)
      await sleep(delay)
      attempt += 1
    }
  }
}

export class CircuitOpenError extends Error {
  constructor(name: string) {
    super(`Circuit breaker "${name}" is open`)
    this.name = "CircuitOpenError"
  }
}

export type CircuitState = "closed" | "open" | "half-open"

export type CircuitBreakerOptions = {
  name?: string
  failureThreshold?: number
  resetTimeoutMs?: number
  now?: () => number
}

export class CircuitBreaker {
  private readonly name: string
  private readonly failureThreshold: number
  private readonly resetTimeoutMs: number
  private readonly now: () => number
  private failures = 0
  private openedAt = 0
  private current: CircuitState = "closed"

  constructor(options: CircuitBreakerOptions = {}) {
    this.name = options.name ?? "external"
    this.failureThreshold = options.failureThreshold ?? 5
    this.resetTimeoutMs = options.resetTimeoutMs ?? 30_000
    this.now = options.now ?? (() => Date.now())
  }

  get state(): CircuitState {
    if (
      this.current === "open" &&
      this.now() - this.openedAt >= this.resetTimeoutMs
    ) {
      this.current = "half-open"
    }
    return this.current
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "open") {
      throw new CircuitOpenError(this.name)
    }

    try {
      const result = await fn()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  private onSuccess() {
    this.failures = 0
    this.current = "closed"
  }

  private onFailure() {
    this.failures += 1
    if (
      this.current === "half-open" ||
      this.failures >= this.failureThreshold
    ) {
      this.current = "open"
      this.openedAt = this.now()
    }
  }
}

export class HttpError extends Error {
  readonly status: number
  readonly url: string

  constructor(status: number, url: string) {
    super(`Request to ${url} failed with status ${status}`)
    this.name = "HttpError"
    this.status = status
    this.url = url
  }
}

const breakers = new Map<string, CircuitBreaker>()

function breakerFor(name: string, options?: CircuitBreakerOptions) {
  let breaker = breakers.get(name)
  if (!breaker) {
    breaker = new CircuitBreaker({ name, ...options })
    breakers.set(name, breaker)
  }
  return breaker
}

export type ResilientCallOptions = {
  retry?: RetryOptions
  circuit?: Omit<CircuitBreakerOptions, "name">
}

/**
 * Run an outbound call to a named service through its shared circuit breaker
 * with bounded retries. Use one stable `name` per upstream so its failures are
 * tracked together.
 */
export function resilientCall<T>(
  name: string,
  fn: () => Promise<T>,
  options: ResilientCallOptions = {}
): Promise<T> {
  const breaker = breakerFor(name, options.circuit)
  return withRetry(() => breaker.execute(fn), {
    ...options.retry,
    shouldRetry(error) {
      if (error instanceof CircuitOpenError) return false
      return options.retry?.shouldRetry?.(error) ?? true
    },
  })
}

export type ResilientFetchOptions = {
  retries?: number
  initForAttempt?: () => RequestInit
  beforeAttempt?: () => Promise<void>
  sleep?: (ms: number) => Promise<void>
  /** Override for tests; defaults to the global `fetch`. */
  fetchImpl?: typeof fetch
}

/**
 * `fetch` wrapped with the named circuit breaker + bounded retries. Server (5xx)
 * responses and network errors are retried and ultimately surface as
 * `HttpError`; client (4xx) responses are returned unretried so callers can
 * handle them. The happy path is a single fetch with no added latency.
 */
export async function resilientFetch(
  name: string,
  input: string | URL,
  init?: RequestInit,
  options: ResilientFetchOptions = {}
): Promise<Response> {
  const doFetch = options.fetchImpl ?? fetch
  const url = typeof input === "string" ? input : input.toString()

  return resilientCall(
    name,
    async () => {
      await options.beforeAttempt?.()
      const response = await doFetch(input, options.initForAttempt?.() ?? init)
      if (response.status >= 500) throw new HttpError(response.status, url)
      return response
    },
    { retry: { retries: options.retries ?? 0, sleep: options.sleep } }
  )
}
