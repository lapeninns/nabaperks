import { existsSync, readFileSync } from "node:fs"
import { afterEach, describe, expect, it, vi } from "vitest"

import { createSupabaseMock } from "../helpers/supabase"

function readProjectFile(path: string) {
  return readFileSync(path, "utf8")
}

function form(values: Record<string, string>) {
  const data = new FormData()

  for (const [key, value] of Object.entries(values)) {
    data.set(key, value)
  }

  return data
}

function mockSupabase(mock: ReturnType<typeof createSupabaseMock>) {
  vi.doMock("@/lib/supabase/server", () => ({
    createSupabaseServerClient: async () => mock.client,
    createSupabaseServiceRoleClient: () => mock.client,
  }))
}

function mockCurrentCustomer() {
  vi.doMock("@/lib/customer/identity", () => ({
    getCurrentCustomer: vi.fn(async () => ({
      id: "customer-1",
      authUserId: null,
      email: null,
      emailVerifiedAt: null,
      fullName: "Sam Taylor",
      dateOfBirth: "1990-01-01",
      phone: "Phone ending 2453",
      phoneLast4: "2453",
      phoneCountry: "US",
      createdAt: "2026-06-13T12:00:00.000Z",
    })),
  }))
}

describe("09 self-service stamping micro-specs (MS-06, MS-07, MS-08, MS-09)", () => {
  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.unstubAllGlobals()
    vi.doUnmock("@/lib/supabase/server")
    vi.doUnmock("@/lib/customer/identity")
  })

  it("issues a customer-owned daily stamp directly from the card action RPC", async () => {
    vi.resetModules()
    const mock = createSupabaseMock({
      rpc: {
        issue_self_service_stamp: [
          {
            data: [
              {
                stamp_event_id: "stamp-1",
                new_stamp_count: 2,
                reward_unlocked: false,
                geo_flagged: false,
              },
            ],
            error: null,
          },
        ],
      },
    })
    mockSupabase(mock)
    mockCurrentCustomer()

    const { issueSelfServiceStamp } = await import("@/lib/customer/stamp")
    const result = await issueSelfServiceStamp("membership-1", {
      latitude: 51.524,
      longitude: -0.071,
    })

    expect(result).toEqual({
      status: "issued",
      stampEventId: "stamp-1",
      newStampCount: 2,
      rewardUnlocked: false,
      geoFlagged: false,
    })
    expect(mock.rpcCalls[0]).toEqual({
      name: "issue_self_service_stamp",
      params: {
        p_membership_id: "membership-1",
        p_customer_id: "customer-1",
        p_latitude: 51.524,
        p_longitude: -0.071,
      },
    })
  })

  it("maps duplicate business-day stamping to a safe blocked result", async () => {
    vi.resetModules()
    const mock = createSupabaseMock({
      rpc: {
        issue_self_service_stamp: [
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
    mockCurrentCustomer()

    const { issueSelfServiceStamp } = await import("@/lib/customer/stamp")
    const result = await issueSelfServiceStamp("membership-1")

    expect(result).toEqual({
      status: "blocked",
      reason: "You're already stamped today. Come back tomorrow.",
    })
  })

  it("maps a stamp rate-limit RPC error to calm retry copy instead of throwing", async () => {
    vi.resetModules()
    const mock = createSupabaseMock({
      rpc: {
        issue_self_service_stamp: [
          {
            data: null,
            error: { message: "Rate limit exceeded" },
          },
        ],
      },
    })
    mockSupabase(mock)
    mockCurrentCustomer()

    const { issueSelfServiceStamp } = await import("@/lib/customer/stamp")
    const result = await issueSelfServiceStamp("membership-1")

    expect(result.status).toBe("blocked")
    expect(result).toMatchObject({ status: "blocked" })
    if (result.status === "blocked") {
      expect(result.reason).toMatch(/try again/i)
      expect(result.reason).not.toMatch(/unavailable/i)
    }
  })

  it("maps the reward-pool minimum RPC error to calm copy instead of throwing", async () => {
    vi.resetModules()
    const mock = createSupabaseMock({
      rpc: {
        issue_self_service_stamp: [
          {
            data: null,
            error: {
              message:
                "At least 3 active reward pool items are required before unlocking a reward",
            },
          },
        ],
      },
    })
    mockSupabase(mock)
    mockCurrentCustomer()

    const { issueSelfServiceStamp } = await import("@/lib/customer/stamp")
    const result = await issueSelfServiceStamp("membership-1")

    expect(result.status).toBe("blocked")
    if (result.status === "blocked") {
      expect(result.reason.length).toBeGreaterThan(0)
    }
  })

  it("keeps a geo-flagged stamp as a non-blocking issued result", async () => {
    vi.resetModules()
    const mock = createSupabaseMock({
      rpc: {
        issue_self_service_stamp: [
          {
            data: [
              {
                stamp_event_id: "stamp-1",
                new_stamp_count: 2,
                reward_unlocked: false,
                geo_flagged: true,
              },
            ],
            error: null,
          },
        ],
      },
    })
    mockSupabase(mock)
    mockCurrentCustomer()

    const { issueSelfServiceStamp } = await import("@/lib/customer/stamp")
    const result = await issueSelfServiceStamp("membership-1", {
      latitude: 51.524,
      longitude: -0.071,
    })

    expect(result).toMatchObject({ status: "issued", geoFlagged: true })
  })

  it("never throws an unexpected stamp RPC error into the card error boundary", async () => {
    vi.resetModules()
    const issueSelfServiceStamp = vi.fn(async () => {
      throw new Error("Unable to issue a stamp: connection reset")
    })
    const getStampQrContextForMembership = vi.fn(async () => ({
      qrId: "BELL-QR",
      merchant: { id: "merchant-1" },
    }))
    vi.doMock("next/cache", () => ({ revalidatePath: vi.fn() }))
    vi.doMock("@/lib/customer/join", () => ({
      getStampQrContextForMembership,
    }))
    vi.doMock("@/lib/customer/stamp", () => ({ issueSelfServiceStamp }))
    const { selfStampAction } =
      await import("@/app/card/[membershipId]/actions")

    const result = await selfStampAction(
      { status: "idle" },
      form({ membershipId: "membership-1", qrId: "BELL-QR" })
    )

    expect(result.status).toBe("error")
    if (result.status === "error") {
      expect(result.message).toBeTruthy()
      expect(result.message).not.toContain("connection reset")
    }
  })

  it("geocodes venue addresses through Nominatim at config time", async () => {
    vi.resetModules()
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify([
            {
              lat: "51.524",
              lon: "-0.071",
            },
          ]),
          { status: 200 }
        )
    )
    vi.stubGlobal("fetch", fetchMock)

    const { geocodeAddress } = await import("@/lib/merchant/geocode")
    const result = await geocodeAddress("1 High Street, London")

    expect(result).toEqual({ latitude: 51.524, longitude: -0.071 })
    expect(fetchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        href: expect.stringContaining("nominatim.openstreetmap.org/search"),
      }),
      expect.objectContaining({
        headers: expect.objectContaining({
          "User-Agent": expect.stringContaining("Nabaperks"),
        }),
      })
    )
  })

  it("saves venue location settings with geocoded coordinates", async () => {
    vi.resetModules()
    const revalidatePath = vi.fn()
    const mock = createSupabaseMock({
      from: {
        merchant_locations: [
          { data: { id: "location-1" }, error: null },
          { data: null, error: null },
        ],
      },
    })
    vi.doMock("next/cache", () => ({ revalidatePath }))
    vi.doMock("@/lib/auth/session", () => ({
      getCurrentMerchant: vi.fn(async () => ({ id: "merchant-1" })),
    }))
    vi.doMock("@/lib/merchant/geocode", () => ({
      geocodeAddress: vi.fn(async () => ({
        latitude: 51.524,
        longitude: -0.071,
      })),
    }))
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: vi.fn(async () => mock.client),
    }))
    const { saveVenueLocationAction } = await import("@/app/app/launch/actions")

    await expect(
      saveVenueLocationAction(
        {},
        form({
          venueName: "Old Crown Girton",
          addressLine1: "1 High Street",
          addressCity: "London",
          addressPostcode: "SW1A 1AA",
          geofenceRadiusMeters: "150",
          requireGeofence: "on",
        })
      )
    ).resolves.toMatchObject({ saved: true })

    expect(mock.queryCalls).toContainEqual({
      table: "merchant_locations",
      method: "update",
      args: [
        expect.objectContaining({
          merchant_id: "merchant-1",
          name: "Old Crown Girton",
          address: "1 High Street, London, SW1A 1AA",
          address_line_1: "1 High Street",
          address_city: "London",
          address_postcode: "SW1A 1AA",
          address_country: "GB",
          address_source: "manual_entry",
          latitude: 51.524,
          longitude: -0.071,
          geofence_radius_meters: 150,
          require_geofence: true,
        }),
      ],
    })
    expect(revalidatePath).toHaveBeenCalledWith("/app/launch")
    expect(revalidatePath).toHaveBeenCalledWith("/app")
  })

  it("returns an issued state with the new count instead of redirecting", async () => {
    vi.resetModules()
    const issueSelfServiceStamp = vi.fn(async () => ({
      status: "issued" as const,
      stampEventId: "stamp-1",
      newStampCount: 2,
      rewardUnlocked: false,
      geoFlagged: true,
    }))
    const getStampQrContextForMembership = vi.fn(async () => ({
      qrId: "BELL-QR",
      merchant: { id: "merchant-1" },
    }))
    const revalidatePath = vi.fn()
    vi.doMock("next/cache", () => ({ revalidatePath }))
    vi.doMock("@/lib/customer/join", () => ({
      getStampQrContextForMembership,
    }))
    vi.doMock("@/lib/customer/stamp", () => ({ issueSelfServiceStamp }))
    const { selfStampAction } =
      await import("@/app/card/[membershipId]/actions")

    // The stamp now lands in place: the action returns the new state to the
    // client instead of throwing a full-page redirect that wastes the slam.
    const result = await selfStampAction(
      { status: "idle" },
      form({
        membershipId: "membership-1",
        qrId: "BELL-QR",
        latitude: "51.524",
        longitude: "-0.071",
      })
    )

    expect(result).toEqual({
      status: "issued",
      newStampCount: 2,
      rewardUnlocked: false,
      geoFlagged: true,
    })
    expect(getStampQrContextForMembership).toHaveBeenCalledWith(
      "membership-1",
      "BELL-QR"
    )
    expect(issueSelfServiceStamp).toHaveBeenCalledWith("membership-1", {
      latitude: 51.524,
      longitude: -0.071,
    })
    // The card route is still revalidated so a later visit reflects the stamp.
    expect(revalidatePath).toHaveBeenCalledWith("/card/membership-1")
  })

  it("keeps client action state defaults outside the use-server action module", () => {
    const actions = readProjectFile("app/card/[membershipId]/actions.ts")
    const statePath = "lib/customer/self-stamp-action-state.ts"
    const collector = readProjectFile("components/customer/stamp-collector.tsx")

    expect(actions).toContain('"use server"')
    expect(actions).toContain("export async function selfStampAction")
    expect(actions).not.toContain("export const initialSelfStampState")
    expect(actions).not.toMatch(
      /^export\s+(?:const|let|var)\s+\w+\s*(?::[^=]+)?=\s*\{/m
    )

    expect(existsSync(statePath)).toBe(true)
    expect(readProjectFile(statePath)).toContain(
      "export const initialSelfStampState"
    )
    expect(collector).toContain('from "@/lib/customer/self-stamp-action-state"')
  })

  it("maps a blocked stamp RPC result to a calm error state without revalidating", async () => {
    vi.resetModules()
    const issueSelfServiceStamp = vi.fn(async () => ({
      status: "blocked" as const,
      reason: "You're already stamped today. Come back tomorrow.",
    }))
    const getStampQrContextForMembership = vi.fn(async () => ({
      qrId: "BELL-QR",
      merchant: { id: "merchant-1" },
    }))
    const revalidatePath = vi.fn()
    vi.doMock("next/cache", () => ({ revalidatePath }))
    vi.doMock("@/lib/customer/join", () => ({
      getStampQrContextForMembership,
    }))
    vi.doMock("@/lib/customer/stamp", () => ({ issueSelfServiceStamp }))
    const { selfStampAction } =
      await import("@/app/card/[membershipId]/actions")

    const result = await selfStampAction(
      { status: "idle" },
      form({ membershipId: "membership-1", qrId: "BELL-QR" })
    )

    expect(result).toEqual({
      status: "error",
      message: "You're already stamped today. Come back tomorrow.",
    })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it("blocks direct card-page stamp attempts that did not start from the venue QR", async () => {
    vi.resetModules()
    const issueSelfServiceStamp = vi.fn()
    vi.doMock("next/cache", () => ({ revalidatePath: vi.fn() }))
    vi.doMock("@/lib/customer/join", () => ({
      getStampQrContextForMembership: vi.fn(async () => null),
    }))
    vi.doMock("@/lib/customer/stamp", () => ({ issueSelfServiceStamp }))
    const { selfStampAction } =
      await import("@/app/card/[membershipId]/actions")

    await expect(
      selfStampAction(
        { status: "idle" },
        form({ membershipId: "membership-1" })
      )
    ).resolves.toEqual({
      status: "error",
      message: "Scan the venue code to add your stamp.",
    })
    expect(issueSelfServiceStamp).not.toHaveBeenCalled()
  })

  it("routes existing QR members to the stamp confirmation page with QR context", () => {
    const qrPage = readProjectFile("app/q/[qrId]/page.tsx")

    expect(qrPage).toContain(
      "redirect(`/card/${membership.id}/stamp?qr=${qrContext.qrId}`)"
    )
  })

  it("keeps customer pages self-service and removes short-lived code panels", () => {
    const stampPage = readProjectFile("app/card/[membershipId]/stamp/page.tsx")
    // Card / stamp / reward UI + copy live in the shared experience layer; the
    // routes are thin wrappers that derive an experience and render it.
    const experience = readProjectFile(
      "components/customer/customer-card-experience.tsx"
    )
    const rewardPanels = readProjectFile(
      "components/customer/reward-panels.tsx"
    )
    const rewardCollectionQr = readProjectFile(
      "components/customer/reward-collection-qr.tsx"
    )

    expect(experience).toContain("Scan the venue code to add your stamp.")
    expect(experience).not.toContain("Get today&apos;s stamp")

    expect(experience).toContain("StampCollector")
    expect(stampPage).toContain("searchParams")
    expect(experience).not.toContain("createStampCode")

    expect(experience).toContain("RewardReadyPanel")
    expect(experience).not.toContain("SelfServiceRedeemForm")
    expect(rewardPanels).toContain("RewardCollectionQr")
    expect(rewardCollectionQr).toContain("Merchant scans this QR")
    expect(experience).not.toContain("StampCodePanel")
    expect(experience).not.toContain("createRedeemCode")
  })

  it("holds on the completed card with a See your reward tap-through after the final stamp", () => {
    const experience = readProjectFile(
      "components/customer/customer-card-experience.tsx"
    )
    const collector = readProjectFile("components/customer/stamp-collector.tsx")

    // The stamp screen offers a tap-through to the reward voucher instead of an
    // instant swap, so the customer controls when they leave the full card.
    expect(experience).toContain("See your reward")

    // The completion celebration must not claim the reward is collectable at the
    // counter now — a waiting reward is only redeemable the next UK business day,
    // so that copy contradicts the very next screen.
    expect(collector).not.toContain("claim it at the counter while you're here")
  })

  it("defines the self-service SQL contract and drops station/token tables after migration", () => {
    const migrationPath =
      "supabase/migrations/20260613100000_self_service_stamping.sql"

    expect(existsSync(migrationPath)).toBe(true)

    const migration = readProjectFile(migrationPath)

    for (const marker of [
      "alter table public.merchant_locations",
      "latitude numeric",
      "longitude numeric",
      "geofence_radius_meters",
      "require_geofence",
      "function public.issue_self_service_stamp",
      "function public.redeem_self_service_reward",
      "selfstamp:",
      "fraud_flags",
      "geo_flagged",
      "drop table if exists public.verification_tokens",
      "drop table if exists public.stations",
      "drop table if exists public.staff_sessions",
      "drop table if exists public.station_pin_attempts",
    ]) {
      expect(migration).toContain(marker)
    }

    expect(migration).toMatch(
      /drop function if exists public\.approve_stamp_token/i
    )
    expect(migration).toMatch(
      /drop function if exists public\.redeem_reward_token/i
    )
  })
})
