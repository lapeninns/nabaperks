import { createHash } from "node:crypto"

import { afterEach, describe, expect, it, vi } from "vitest"

import { createSupabaseMock } from "../helpers/supabase"

const RPC_NAME = "enforce_rate_limit"
const RAW_KEY = "otp:+447700900123"
const SHA256_HEX = /^[0-9a-f]{64}$/

function mockSupabase(mock: ReturnType<typeof createSupabaseMock>) {
  vi.doMock("@/lib/supabase/server", () => ({
    createSupabaseServiceRoleClient: () => mock.client,
  }))
}

async function loadModule() {
  return import("@/lib/security/rate-limit")
}

afterEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  vi.doUnmock("@/lib/supabase/server")
})

describe("enforceRateLimit", () => {
  it("resolves without throwing when the RPC reports no error", async () => {
    const supabase = createSupabaseMock({
      rpc: { [RPC_NAME]: [{ data: null, error: null }] },
    })
    mockSupabase(supabase)
    const { enforceRateLimit } = await loadModule()

    await expect(
      enforceRateLimit({ key: RAW_KEY, limit: 5, windowMs: 60_000 })
    ).resolves.toBeUndefined()

    expect(supabase.rpcCalls).toHaveLength(1)
  })

  it("invokes the RPC with the hashed bucket key and the supplied limit window", async () => {
    const supabase = createSupabaseMock({
      rpc: { [RPC_NAME]: [{ data: null, error: null }] },
    })
    mockSupabase(supabase)
    const { enforceRateLimit } = await loadModule()

    await enforceRateLimit({ key: RAW_KEY, limit: 5, windowMs: 60_000 })

    const call = supabase.rpcCalls[0]
    expect(call.name).toBe(RPC_NAME)
    expect(call.params).toEqual({
      p_bucket_key: createHash("sha256").update(RAW_KEY).digest("hex"),
      p_limit: 5,
      p_window_ms: 60_000,
    })
  })

  it("passes a 64-character hex SHA-256 digest, never the raw key", async () => {
    const supabase = createSupabaseMock({
      rpc: { [RPC_NAME]: [{ data: null, error: null }] },
    })
    mockSupabase(supabase)
    const { enforceRateLimit } = await loadModule()

    await enforceRateLimit({ key: RAW_KEY, limit: 3, windowMs: 1_000 })

    const bucketKey = supabase.rpcCalls[0].params?.p_bucket_key as string
    expect(bucketKey).toMatch(SHA256_HEX)
    expect(bucketKey).not.toBe(RAW_KEY)
    expect(bucketKey).not.toContain(RAW_KEY)
  })

  it("derives distinct bucket keys for distinct raw keys", async () => {
    const supabase = createSupabaseMock({
      rpc: {
        [RPC_NAME]: [
          { data: null, error: null },
          { data: null, error: null },
        ],
      },
    })
    mockSupabase(supabase)
    const { enforceRateLimit } = await loadModule()

    await enforceRateLimit({
      key: "otp:+447700900111",
      limit: 5,
      windowMs: 60_000,
    })
    await enforceRateLimit({
      key: "otp:+447700900222",
      limit: 5,
      windowMs: 60_000,
    })

    const first = supabase.rpcCalls[0].params?.p_bucket_key
    const second = supabase.rpcCalls[1].params?.p_bucket_key
    expect(first).not.toBe(second)
  })

  it("throws a RateLimitError when the RPC reports the limit was exceeded", async () => {
    const supabase = createSupabaseMock({
      rpc: {
        [RPC_NAME]: [
          { data: null, error: { message: "rate limit exceeded for bucket" } },
        ],
      },
    })
    mockSupabase(supabase)
    const { enforceRateLimit, RateLimitError } = await loadModule()

    await expect(
      enforceRateLimit({ key: RAW_KEY, limit: 5, windowMs: 60_000 })
    ).rejects.toBeInstanceOf(RateLimitError)
  })

  it("matches the exceeded message case-insensitively", async () => {
    const supabase = createSupabaseMock({
      rpc: {
        [RPC_NAME]: [{ data: null, error: { message: "RATE LIMIT EXCEEDED" } }],
      },
    })
    mockSupabase(supabase)
    const { enforceRateLimit, RateLimitError } = await loadModule()

    await expect(
      enforceRateLimit({ key: RAW_KEY, limit: 5, windowMs: 60_000 })
    ).rejects.toBeInstanceOf(RateLimitError)
  })

  it("surfaces a generic error for unexpected RPC failures", async () => {
    const supabase = createSupabaseMock({
      rpc: {
        [RPC_NAME]: [
          { data: null, error: { message: "connection reset by peer" } },
        ],
      },
    })
    mockSupabase(supabase)
    const { enforceRateLimit, RateLimitError } = await loadModule()

    const rejection = enforceRateLimit({
      key: RAW_KEY,
      limit: 5,
      windowMs: 60_000,
    })

    await expect(rejection).rejects.toThrow(
      "Unable to enforce rate limit: connection reset by peer"
    )
    await expect(rejection).rejects.not.toBeInstanceOf(RateLimitError)
  })
})

describe("RateLimitError", () => {
  it("exposes a British default message and a stable name", async () => {
    const { RateLimitError } = await loadModule()
    const error = new RateLimitError()

    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe("RateLimitError")
    expect(error.message).toBe("Too many attempts. Try again shortly.")
  })

  it("accepts a custom message", async () => {
    const { RateLimitError } = await loadModule()
    const error = new RateLimitError("Slow down, please.")

    expect(error.message).toBe("Slow down, please.")
  })
})

describe("rateLimitIdentityFromHeaders", () => {
  it("hashes request IP and user-agent signals into a stable short key", async () => {
    const { rateLimitIdentityFromHeaders } = await loadModule()

    const identity = rateLimitIdentityFromHeaders(
      new Headers({
        "x-forwarded-for": "203.0.113.10, 10.0.0.1",
        "user-agent": "Vitest Browser",
      })
    )

    expect(identity).toMatch(/^[0-9a-f]{32}$/)
    expect(identity).not.toContain("203.0.113.10")
    expect(
      rateLimitIdentityFromHeaders(
        new Headers({
          "x-forwarded-for": "203.0.113.11",
          "user-agent": "Vitest Browser",
        })
      )
    ).not.toBe(identity)
  })
})

describe("rateLimitIdentityFromHeaders — trusted IP source", () => {
  const USER_AGENT = "Mozilla/5.0 (rate-limit-spoof-test)"
  const VERIFIED_IP = "203.0.113.50"

  it("keys on the platform-verified IP, ignoring a spoofed x-forwarded-for / x-real-ip", async () => {
    const { rateLimitIdentityFromHeaders } = await loadModule()

    const genuine = rateLimitIdentityFromHeaders(
      new Headers({
        "x-vercel-forwarded-for": VERIFIED_IP,
        "user-agent": USER_AGENT,
      })
    )
    const spoofed = rateLimitIdentityFromHeaders(
      new Headers({
        "x-vercel-forwarded-for": VERIFIED_IP,
        "x-forwarded-for": "1.1.1.1",
        "x-real-ip": "2.2.2.2",
        "user-agent": USER_AGENT,
      })
    )

    expect(spoofed).toBe(genuine)
  })

  it("cannot be rotated to mint a fresh bucket by changing x-forwarded-for", async () => {
    const { rateLimitIdentityFromHeaders } = await loadModule()

    const rotated = [
      "10.0.0.1",
      "10.0.0.2",
      "198.51.100.9",
      "203.0.113.99",
    ].map((claimedIp) =>
      rateLimitIdentityFromHeaders(
        new Headers({
          "x-vercel-forwarded-for": VERIFIED_IP,
          "x-forwarded-for": claimedIp,
          "user-agent": USER_AGENT,
        })
      )
    )

    // Every spoofed value collapses to the one verified bucket.
    expect(new Set(rotated).size).toBe(1)
  })

  it("cannot poison another client's bucket by claiming their IP in x-forwarded-for", async () => {
    const { rateLimitIdentityFromHeaders } = await loadModule()

    const victim = rateLimitIdentityFromHeaders(
      new Headers({
        "x-vercel-forwarded-for": "198.51.100.7",
        "user-agent": USER_AGENT,
      })
    )
    const attacker = rateLimitIdentityFromHeaders(
      new Headers({
        "x-vercel-forwarded-for": VERIFIED_IP,
        "x-forwarded-for": "198.51.100.7",
        "user-agent": USER_AGENT,
      })
    )

    expect(attacker).not.toBe(victim)
  })

  it("falls back to the right-most x-forwarded-for hop, never the spoofable left-most entry", async () => {
    const { rateLimitIdentityFromHeaders } = await loadModule()

    // No platform header: the nearest trusted proxy appends the real connecting
    // IP on the right; the client can only prepend on the left.
    const genuine = rateLimitIdentityFromHeaders(
      new Headers({
        "x-forwarded-for": VERIFIED_IP,
        "user-agent": USER_AGENT,
      })
    )
    const prepended = rateLimitIdentityFromHeaders(
      new Headers({
        "x-forwarded-for": `9.9.9.9, ${VERIFIED_IP}`,
        "user-agent": USER_AGENT,
      })
    )

    expect(prepended).toBe(genuine)
  })

  it("still distinguishes genuinely different verified clients", async () => {
    const { rateLimitIdentityFromHeaders } = await loadModule()

    const clientA = rateLimitIdentityFromHeaders(
      new Headers({
        "x-vercel-forwarded-for": "203.0.113.1",
        "user-agent": USER_AGENT,
      })
    )
    const clientB = rateLimitIdentityFromHeaders(
      new Headers({
        "x-vercel-forwarded-for": "203.0.113.2",
        "user-agent": USER_AGENT,
      })
    )

    expect(clientA).not.toBe(clientB)
  })
})
