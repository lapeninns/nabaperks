import { afterEach, describe, expect, it, vi } from "vitest"

import {
  REQUEST_ID_HEADER,
  generateRequestId,
  normalizeRequestId,
  resolveRequestId,
} from "@/lib/observability/request-id"
import { createLogger } from "@/lib/observability/logger"
import {
  CircuitBreaker,
  CircuitOpenError,
  HttpError,
  resilientFetch,
  withRetry,
} from "@/lib/observability/resilience"

describe("request id propagation", () => {
  it("generates RFC-4122 style unique ids", () => {
    const a = generateRequestId()
    const b = generateRequestId()
    expect(a).not.toBe(b)
    expect(a).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    )
  })

  it("normalizes valid ids and rejects malformed or oversized ones", () => {
    expect(normalizeRequestId("abc-123_DEF.4")).toBe("abc-123_DEF.4")
    expect(normalizeRequestId("  trimmed-id  ")).toBe("trimmed-id")
    expect(normalizeRequestId("")).toBeNull()
    expect(normalizeRequestId(null)).toBeNull()
    expect(normalizeRequestId("bad id with spaces")).toBeNull()
    expect(normalizeRequestId("x".repeat(201))).toBeNull()
  })

  it("reuses an inbound id but mints one when absent or invalid", () => {
    const inbound = new Headers({ [REQUEST_ID_HEADER]: "inbound-trace-1" })
    expect(resolveRequestId(inbound)).toBe("inbound-trace-1")

    const empty = new Headers()
    expect(resolveRequestId(empty)).toMatch(/^[0-9a-f-]{36}$/)

    const invalid = new Headers({ [REQUEST_ID_HEADER]: "no spaces allowed" })
    expect(resolveRequestId(invalid)).toMatch(/^[0-9a-f-]{36}$/)
  })
})

describe("structured logger", () => {
  afterEach(() => vi.restoreAllMocks())

  it("emits a single JSON line with level, message, bound and call context", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {})
    const log = createLogger({ requestId: "trace-9", service: "test" })

    log.info("joined membership", { merchantId: "m-1" })

    expect(spy).toHaveBeenCalledTimes(1)
    const record = JSON.parse(spy.mock.calls[0][0] as string)
    expect(record.level).toBe("info")
    expect(record.message).toBe("joined membership")
    expect(record.requestId).toBe("trace-9")
    expect(record.service).toBe("test")
    expect(record.merchantId).toBe("m-1")
    expect(typeof record.time).toBe("string")
  })

  it("routes error level to console.error and serializes Error objects", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    const log = createLogger()

    log.error("stamp failed", { error: new Error("boom") })

    const record = JSON.parse(spy.mock.calls[0][0] as string)
    expect(record.level).toBe("error")
    expect(record.error.message).toBe("boom")
    expect(record.error.name).toBe("Error")
  })
})

describe("withRetry", () => {
  it("retries transient failures then succeeds without real delay", async () => {
    const sleep = vi.fn(async () => {})
    let calls = 0
    const result = await withRetry(
      async () => {
        calls += 1
        if (calls < 3) throw new Error("transient")
        return "ok"
      },
      { retries: 3, sleep }
    )

    expect(result).toBe("ok")
    expect(calls).toBe(3)
    expect(sleep).toHaveBeenCalledTimes(2)
  })

  it("stops immediately when shouldRetry returns false", async () => {
    const sleep = vi.fn(async () => {})
    let calls = 0
    await expect(
      withRetry(
        async () => {
          calls += 1
          throw new Error("fatal")
        },
        { retries: 5, sleep, shouldRetry: () => false }
      )
    ).rejects.toThrow("fatal")

    expect(calls).toBe(1)
    expect(sleep).not.toHaveBeenCalled()
  })

  it("gives up after exhausting retries", async () => {
    const sleep = vi.fn(async () => {})
    let calls = 0
    await expect(
      withRetry(
        async () => {
          calls += 1
          throw new Error("always")
        },
        { retries: 2, sleep }
      )
    ).rejects.toThrow("always")
    expect(calls).toBe(3)
  })
})

describe("CircuitBreaker", () => {
  it("opens after the failure threshold and short-circuits further calls", async () => {
    const clock = 1000
    const breaker = new CircuitBreaker({
      failureThreshold: 2,
      resetTimeoutMs: 500,
      now: () => clock,
    })
    const failing = async () => {
      throw new Error("down")
    }

    await expect(breaker.execute(failing)).rejects.toThrow("down")
    await expect(breaker.execute(failing)).rejects.toThrow("down")
    expect(breaker.state).toBe("open")

    const protectedFn = vi.fn(failing)
    await expect(breaker.execute(protectedFn)).rejects.toBeInstanceOf(
      CircuitOpenError
    )
    expect(protectedFn).not.toHaveBeenCalled()
  })

  it("half-opens after the reset window and closes on a success", async () => {
    let clock = 1000
    const breaker = new CircuitBreaker({
      failureThreshold: 1,
      resetTimeoutMs: 500,
      now: () => clock,
    })

    await expect(
      breaker.execute(async () => {
        throw new Error("down")
      })
    ).rejects.toThrow("down")
    expect(breaker.state).toBe("open")

    clock += 600
    const result = await breaker.execute(async () => "recovered")
    expect(result).toBe("recovered")
    expect(breaker.state).toBe("closed")
  })
})

describe("resilientFetch", () => {
  it("retries 5xx responses then returns the eventual success", async () => {
    const sleep = vi.fn(async () => {})
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("err", { status: 503 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }))

    const res = await resilientFetch(
      "unit-5xx",
      "https://example.test",
      { method: "GET" },
      { retries: 2, sleep, fetchImpl: fetchMock }
    )

    expect(res.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("does not retry 4xx responses and returns them as-is", async () => {
    const sleep = vi.fn(async () => {})
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("nope", { status: 400 }))

    const res = await resilientFetch(
      "unit-4xx",
      "https://example.test",
      undefined,
      { retries: 3, sleep, fetchImpl: fetchMock }
    )

    expect(res.status).toBe(400)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("surfaces an HttpError when 5xx persists past the retry budget", async () => {
    const sleep = vi.fn(async () => {})
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("down", { status: 500 }))

    await expect(
      resilientFetch("unit-persistent", "https://example.test", undefined, {
        retries: 1,
        sleep,
        fetchImpl: fetchMock,
      })
    ).rejects.toBeInstanceOf(HttpError)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
