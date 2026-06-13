import { readFileSync } from "node:fs"
import { afterEach, describe, expect, it, vi } from "vitest"

import { createSupabaseMock } from "../helpers/supabase"

function readProjectFile(path: string) {
  return readFileSync(path, "utf8")
}

function mockSupabase(mock: ReturnType<typeof createSupabaseMock>) {
  vi.doMock("@/lib/supabase/server", () => ({
    createSupabaseServerClient: async () => mock.client,
    createSupabaseServiceRoleClient: () => mock.client,
  }))
}

const CREDS = { stationId: "station-1", stationSecret: "secret-1" }

describe("09 counter handshake micro-specs (MS-06, MS-07, MS-08, MS-09)", () => {
  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.doUnmock("@/lib/supabase/server")
  })

  it("creates a short-lived single-use stamp code for the customer", async () => {
    vi.resetModules()
    const mock = createSupabaseMock({
      rpc: {
        enforce_rate_limit: [{ data: null, error: null }],
        create_verification_token: [
          {
            data: [
              {
                token_id: "token-1",
                code: "K7F3",
                expires_at: "2026-06-13T10:02:00Z",
              },
            ],
            error: null,
          },
        ],
      },
    })
    mockSupabase(mock)

    const { createStampCode } = await import("@/lib/customer/stamp-code")
    const result = await createStampCode("membership-1")

    expect(result).toEqual({
      status: "created",
      tokenId: "token-1",
      code: "K7F3",
      expiresAt: "2026-06-13T10:02:00Z",
    })

    const tokenCall = mock.rpcCalls.find(
      (call) => call.name === "create_verification_token"
    )
    expect(tokenCall?.params).toMatchObject({
      p_membership_id: "membership-1",
      p_kind: "stamp",
    })
  })

  it("maps duplicate-day and programme errors to blocked states without granting a code", async () => {
    vi.resetModules()
    const mock = createSupabaseMock({
      rpc: {
        enforce_rate_limit: [{ data: null, error: null }],
        create_verification_token: [
          {
            data: null,
            error: {
              message: "Stamp already issued for this UK business day",
            },
          },
        ],
      },
    })
    mockSupabase(mock)

    const { createStampCode } = await import("@/lib/customer/stamp-code")
    const result = await createStampCode("membership-1")

    expect(result.status).toBe("blocked")
    if (result.status === "blocked") {
      expect(result.reason).toContain("already stamped")
    }
  })

  it("reports token status for customer polling without a page refresh", async () => {
    vi.resetModules()
    const mock = createSupabaseMock({
      rpc: {
        get_verification_token_status: [
          {
            data: [
              {
                status: "pending",
                kind: "stamp",
                expires_at: "2026-06-13T10:02:00Z",
                new_stamp_count: null,
                reward_unlocked: false,
                reward_event_id: null,
              },
            ],
            error: null,
          },
          {
            data: [
              {
                status: "approved",
                kind: "stamp",
                expires_at: "2026-06-13T10:02:00Z",
                new_stamp_count: 3,
                reward_unlocked: true,
                reward_event_id: "reward-9",
              },
            ],
            error: null,
          },
        ],
      },
    })
    mockSupabase(mock)

    const { getTokenStatus } = await import("@/lib/customer/stamp-code")

    expect(await getTokenStatus("token-1")).toEqual({
      status: "pending",
      kind: "stamp",
      expiresAt: "2026-06-13T10:02:00Z",
      newStampCount: null,
      rewardUnlocked: false,
      rewardId: null,
    })

    expect(await getTokenStatus("token-1")).toMatchObject({
      status: "approved",
      newStampCount: 3,
      rewardUnlocked: true,
      rewardId: "reward-9",
    })
  })

  it("creates a redemption code tied to an unlocked reward", async () => {
    vi.resetModules()
    const mock = createSupabaseMock({
      rpc: {
        enforce_rate_limit: [{ data: null, error: null }],
        create_verification_token: [
          {
            data: [
              {
                token_id: "token-2",
                code: "RW88",
                expires_at: "2026-06-13T10:05:00Z",
              },
            ],
            error: null,
          },
        ],
      },
    })
    mockSupabase(mock)

    const { createRedeemCode } = await import("@/lib/customer/stamp-code")
    const result = await createRedeemCode("membership-1", "reward-9")

    expect(result.status).toBe("created")

    const tokenCall = mock.rpcCalls.find(
      (call) => call.name === "create_verification_token"
    )
    expect(tokenCall?.params).toMatchObject({
      p_membership_id: "membership-1",
      p_kind: "redeem",
      p_reward_event_id: "reward-9",
    })
  })

  it("pairs a station with a one-time pairing code and rejects bad codes generically", async () => {
    vi.resetModules()
    const mock = createSupabaseMock({
      rpc: {
        enforce_rate_limit: [
          { data: null, error: null },
          { data: null, error: null },
        ],
        pair_station: [
          {
            data: [
              {
                station_id: "station-1",
                station_secret: "secret-1",
                station_name: "Front till",
                merchant_name: "The Old Crown",
              },
            ],
            error: null,
          },
          {
            data: null,
            error: { message: "Pairing code was not accepted" },
          },
        ],
      },
    })
    mockSupabase(mock)

    const { pairStation } = await import("@/lib/staff/station")

    expect(await pairStation("OC-PAIR1")).toEqual({
      status: "paired",
      credentials: { stationId: "station-1", stationSecret: "secret-1" },
      stationName: "Front till",
      merchantName: "The Old Crown",
    })

    expect(await pairStation("WRONG-99")).toEqual({ status: "invalid" })
  })

  it("returns unpaired station state when the device credential is revoked or invalid", async () => {
    vi.resetModules()
    const mock = createSupabaseMock({
      rpc: {
        get_station_state: [
          {
            data: null,
            error: { message: "Station credential was not accepted" },
          },
        ],
      },
    })
    mockSupabase(mock)

    const { getStationState } = await import("@/lib/staff/station")

    expect(await getStationState(CREDS)).toEqual({ status: "unpaired" })
  })

  it("maps full station state for the counter idle screen", async () => {
    vi.resetModules()
    const mock = createSupabaseMock({
      rpc: {
        get_station_state: [
          {
            data: [
              {
                station_name: "Front till",
                merchant_name: "The Old Crown",
                session_id: "session-1",
                session_staff_name: "Maya",
                session_started_at: "2026-06-13T08:00:00Z",
                staff_members: [
                  { id: "staff-1", display_name: "Maya" },
                  { id: "staff-2", display_name: "Jordan" },
                ],
                stamps_today: 14,
                redemptions_today: 2,
                last_action_summary: "STAMP 3/3",
                last_action_at: "2026-06-13T09:41:00Z",
                locked_until: null,
              },
            ],
            error: null,
          },
        ],
      },
    })
    mockSupabase(mock)

    const { getStationState } = await import("@/lib/staff/station")
    const state = await getStationState(CREDS)

    expect(state).toMatchObject({
      status: "ready",
      stationName: "Front till",
      merchantName: "The Old Crown",
      session: { id: "session-1", staffName: "Maya" },
      stampsToday: 14,
      redemptionsToday: 2,
      lockedUntil: null,
    })
    if (state.status === "ready") {
      expect(state.staffMembers).toHaveLength(2)
    }
  })

  it("starts a named staff session and keeps PIN failures generic", async () => {
    vi.resetModules()
    const mock = createSupabaseMock({
      rpc: {
        start_staff_session: [
          {
            data: [{ session_id: "session-1", staff_display_name: "Maya" }],
            error: null,
          },
          {
            data: null,
            error: { message: "Staff PIN was not accepted" },
          },
          {
            data: null,
            error: { message: "PIN pad locked. Try again later" },
          },
        ],
      },
    })
    mockSupabase(mock)

    const { startStaffSession } = await import("@/lib/staff/station")

    expect(await startStaffSession(CREDS, "staff-1", "7312")).toEqual({
      status: "started",
      sessionId: "session-1",
      staffName: "Maya",
    })

    const rejected = await startStaffSession(CREDS, "staff-1", "0000")
    expect(rejected.status).toBe("rejected")

    const locked = await startStaffSession(CREDS, "staff-1", "0000")
    expect(locked.status).toBe("locked")
  })

  it("looks up a customer code and surfaces card context plus duplicate warnings", async () => {
    vi.resetModules()
    const mock = createSupabaseMock({
      rpc: {
        lookup_verification_code: [
          {
            data: [
              {
                status: "ready",
                kind: "stamp",
                token_id: "token-1",
                customer_label: "Card OC-0248",
                stamp_count: 2,
                stamps_required: 3,
                duplicate_warning: "Already stamped today",
                consumed_at: null,
                reward_name: null,
                reward_terms: null,
                min_spend_pence: null,
                redeemable_from: null,
              },
            ],
            error: null,
          },
          {
            data: [
              {
                status: "already_used",
                kind: "stamp",
                token_id: "token-1",
                customer_label: null,
                stamp_count: null,
                stamps_required: null,
                duplicate_warning: null,
                consumed_at: "2026-06-13T09:00:00Z",
                reward_name: null,
                reward_terms: null,
                min_spend_pence: null,
                redeemable_from: null,
              },
            ],
            error: null,
          },
        ],
      },
    })
    mockSupabase(mock)

    const { lookupCode } = await import("@/lib/staff/station")

    expect(await lookupCode(CREDS, "k7f3")).toMatchObject({
      status: "ready",
      kind: "stamp",
      tokenId: "token-1",
      customerLabel: "Card OC-0248",
      stampCount: 2,
      stampsRequired: 3,
      duplicateWarning: "Already stamped today",
    })

    expect(await lookupCode(CREDS, "K7F3")).toMatchObject({
      status: "already_used",
      usedAt: "2026-06-13T09:00:00Z",
    })
  })

  it("approves a stamp token exactly once and reports idempotent replays", async () => {
    vi.resetModules()
    const mock = createSupabaseMock({
      rpc: {
        approve_stamp_token: [
          {
            data: [
              {
                stamp_event_id: "stamp-1",
                new_stamp_count: 3,
                reward_unlocked: true,
                replayed: false,
              },
            ],
            error: null,
          },
          {
            data: [
              {
                stamp_event_id: "stamp-1",
                new_stamp_count: 3,
                reward_unlocked: true,
                replayed: true,
              },
            ],
            error: null,
          },
          {
            data: null,
            error: { message: "Code already used" },
          },
          {
            data: null,
            error: { message: "Code expired" },
          },
        ],
      },
    })
    mockSupabase(mock)

    const { approveStamp } = await import("@/lib/staff/station")

    expect(await approveStamp(CREDS, "session-1", "token-1")).toEqual({
      status: "approved",
      stampEventId: "stamp-1",
      newStampCount: 3,
      rewardUnlocked: true,
      replayed: false,
    })

    // Retry with the same token id (the idempotency key) must not double-stamp.
    expect(await approveStamp(CREDS, "session-1", "token-1")).toMatchObject({
      status: "approved",
      replayed: true,
    })

    expect(await approveStamp(CREDS, "session-1", "token-2")).toEqual({
      status: "already_used",
    })
    expect(await approveStamp(CREDS, "session-1", "token-3")).toEqual({
      status: "expired",
    })
  })

  it("redeems a reward token once and reports prior redemption time", async () => {
    vi.resetModules()
    const mock = createSupabaseMock({
      rpc: {
        redeem_reward_token: [
          {
            data: [
              {
                reward_event_id: "reward-9",
                reward_name: "Slice of cake",
                membership_id: "membership-1",
                new_stamp_count: 0,
                replayed: false,
              },
            ],
            error: null,
          },
          {
            data: null,
            error: {
              message: "Reward already redeemed at 2026-06-13T09:30:00Z",
            },
          },
        ],
      },
    })
    mockSupabase(mock)

    const { redeemRewardToken } = await import("@/lib/staff/station")

    expect(await redeemRewardToken(CREDS, "session-1", "token-9")).toEqual({
      status: "redeemed",
      rewardId: "reward-9",
      rewardName: "Slice of cake",
      membershipId: "membership-1",
      newStampCount: 0,
      replayed: false,
    })

    expect(await redeemRewardToken(CREDS, "session-1", "token-9")).toMatchObject(
      { status: "already_redeemed" }
    )
  })

  it("lets staff undo a recent stamp from the same station within the window", async () => {
    vi.resetModules()
    const mock = createSupabaseMock({
      rpc: {
        undo_recent_stamp: [
          {
            data: [{ new_stamp_count: 2 }],
            error: null,
          },
          {
            data: null,
            error: { message: "Undo window has closed" },
          },
        ],
      },
    })
    mockSupabase(mock)

    const { undoStamp } = await import("@/lib/staff/station")

    expect(await undoStamp(CREDS, "session-1", "stamp-1")).toEqual({
      status: "undone",
      newStampCount: 2,
    })

    expect(await undoStamp(CREDS, "session-1", "stamp-1")).toEqual({
      status: "window_closed",
    })
  })

  it("lets the merchant create station pairings and manage named staff", async () => {
    vi.resetModules()
    const mock = createSupabaseMock({
      rpc: {
        create_station_pairing: [
          {
            data: [
              {
                station_id: "station-1",
                station_name: "Front till",
                pairing_code: "OC-PAIR1",
                pairing_expires_at: "2026-06-13T10:15:00Z",
              },
            ],
            error: null,
          },
        ],
        add_staff_member: [
          {
            data: [{ staff_id: "staff-3" }],
            error: null,
          },
        ],
        set_staff_member_active: [{ data: null, error: null }],
      },
    })
    mockSupabase(mock)

    const stations = await import("@/lib/merchant/stations")

    expect(await stations.createStationPairing("Front till")).toEqual({
      status: "created",
      stationId: "station-1",
      stationName: "Front till",
      pairingCode: "OC-PAIR1",
      pairingExpiresAt: "2026-06-13T10:15:00Z",
    })

    const staff = await import("@/lib/merchant/staff-members")

    expect(await staff.addStaffMember("Jordan", "7312")).toEqual({
      status: "created",
      staffId: "staff-3",
    })

    // PIN format is validated before any request is sent.
    expect(await staff.addStaffMember("Jordan", "12")).toMatchObject({
      status: "invalid",
    })
    expect(
      mock.rpcCalls.filter((call) => call.name === "add_staff_member")
    ).toHaveLength(1)

    await staff.setStaffMemberActive("staff-3", false)
    const deactivate = mock.rpcCalls.find(
      (call) => call.name === "set_staff_member_active"
    )
    expect(deactivate?.params).toMatchObject({
      p_staff_id: "staff-3",
      p_active: false,
    })
  })

  it("defines the handshake schema with single-use tokens, stations, and staff sessions", () => {
    const migration = readProjectFile(
      "supabase/migrations/20260613090000_counter_handshake.sql"
    )

    expect(migration).toContain("create table if not exists public.stations")
    expect(migration).toContain(
      "create table if not exists public.staff_sessions"
    )
    expect(migration).toContain(
      "create table if not exists public.verification_tokens"
    )
    expect(migration).toContain(
      "create table if not exists public.station_pin_attempts"
    )

    // Atomic single-use consumption: conditional update, no lock choreography.
    expect(migration).toMatch(/update public\.verification_tokens[\s\S]*?consumed_at is null[\s\S]*?expires_at > now\(\)/)

    // Approval idempotency key is the token id.
    expect(migration).toContain("verification_token_id")

    // Tokens never expose plaintext PINs; station secret stored hashed.
    expect(migration).toContain("device_credential_hash")
    expect(migration).not.toMatch(/device_credential text/)
  })

  it("keeps the staff station surface free of customer-device PIN entry", () => {
    const stationPage = readProjectFile("app/staff/page.tsx")
    const stationActions = readProjectFile("app/staff/actions.ts")
    const stampRedirect = readProjectFile("app/staff/stamp/page.tsx")

    expect(stationActions).toContain("approveStamp")
    expect(stationActions).toContain("startStaffSession")
    expect(stationPage).toContain("getStationState")

    // The old flow (customer phone handed over for a PIN) is gone.
    expect(stampRedirect).toContain("redirect")
    expect(stampRedirect).not.toContain("issue_stamp_with_staff_pin")
  })

  it("shows the customer a code screen instead of collecting a staff PIN", () => {
    const cardPage = readProjectFile("app/card/[membershipId]/page.tsx")
    const codePanel = readProjectFile(
      "components/customer/stamp-code-panel.tsx"
    )
    const rewardPage = readProjectFile("app/reward/[rewardId]/page.tsx")

    expect(cardPage).toContain("/stamp")
    expect(cardPage).not.toContain("/staff/stamp?membership=")

    expect(codePanel).toContain("countdown")
    expect(codePanel).toContain("poll")

    expect(rewardPage).not.toContain("RewardRedemptionForm")
    expect(rewardPage).not.toContain('name="pin"')
  })
})
