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

function redirectMock() {
  return vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  })
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

  it("issues a customer-owned redemption QR token from the reward page path", async () => {
    vi.resetModules()
    const mock = createSupabaseMock({
      rpc: {
        create_redemption_token: [
          {
            data: [
              {
                token_id: "token-1",
                public_token: "RDM38E5DB51",
                expires_at: "2026-06-15T08:10:00.000Z",
              },
            ],
            error: null,
          },
        ],
      },
    })
    mockSupabase(mock)
    mockCurrentCustomer()

    const { createRedemptionToken } =
      await import("@/lib/customer/redemption-token")
    const result = await createRedemptionToken("reward-1")

    expect(result).toEqual({
      tokenId: "token-1",
      publicToken: "RDM38E5DB51",
      expiresAt: "2026-06-15T08:10:00.000Z",
    })
    expect(mock.rpcCalls[0]).toEqual({
      name: "create_redemption_token",
      params: {
        p_reward_event_id: "reward-1",
        p_customer_id: "customer-1",
      },
    })
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
          venueName: "Bean & Batch",
          address: "1 High Street, London",
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
          name: "Bean & Batch",
          address: "1 High Street, London",
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

  it("requires a fresh venue QR context before submitting a self-service stamp", async () => {
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
    vi.doMock("next/navigation", () => ({ redirect: redirectMock() }))
    vi.doMock("@/lib/customer/join", () => ({
      getStampQrContextForMembership,
    }))
    vi.doMock("@/lib/customer/stamp", () => ({ issueSelfServiceStamp }))
    const { selfStampAction } =
      await import("@/app/card/[membershipId]/actions")

    await expect(
      selfStampAction(
        {},
        form({
          membershipId: "membership-1",
          qrId: "BELL-QR",
          latitude: "51.524",
          longitude: "-0.071",
        })
      )
    ).rejects.toThrow(
      "NEXT_REDIRECT:/card/membership-1?stamp=issued&geo=flagged"
    )
    expect(getStampQrContextForMembership).toHaveBeenCalledWith(
      "membership-1",
      "BELL-QR"
    )
    expect(issueSelfServiceStamp).toHaveBeenCalledWith("membership-1", {
      latitude: 51.524,
      longitude: -0.071,
    })
    expect(revalidatePath).toHaveBeenCalledWith("/card/membership-1")
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
      selfStampAction({}, form({ membershipId: "membership-1" }))
    ).resolves.toEqual({
      errors: { form: "Scan the venue code to add your stamp." },
    })
    expect(issueSelfServiceStamp).not.toHaveBeenCalled()
  })

  it("polls reward redemption status from the customer reward page", async () => {
    vi.resetModules()
    const getRedemptionTokenStatus = vi.fn(async () => ({
      status: "consumed" as const,
      consumedAt: "2026-06-15T08:03:00.000Z",
      rewardName: "Slice of cake",
    }))
    vi.doMock("@/lib/customer/redemption-token", () => ({
      getRedemptionTokenStatus,
    }))
    const { redemptionStatusAction } =
      await import("@/app/reward/[rewardId]/actions")

    await expect(redemptionStatusAction("reward-1")).resolves.toEqual({
      status: "consumed",
      consumedAt: "2026-06-15T08:03:00.000Z",
      rewardName: "Slice of cake",
    })
    expect(getRedemptionTokenStatus).toHaveBeenCalledWith("reward-1")
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

    expect(experience).toContain("Scan the venue code to add your stamp.")
    expect(experience).not.toContain("Get today&apos;s stamp")

    expect(experience).toContain("SelfServiceStampForm")
    expect(stampPage).toContain("searchParams")
    expect(experience).not.toContain("createStampCode")

    expect(experience).toContain("RewardQrPanel")
    expect(experience).toContain("Show QR at counter")
    expect(experience).not.toContain("SelfServiceRedeemForm")
    expect(experience).not.toContain("StampCodePanel")
    expect(experience).not.toContain("createRedeemCode")
  })

  it("defines the self-service stamp SQL contract and merchant redemption token contract", () => {
    const migrationPath =
      "supabase/migrations/20260613100000_self_service_stamping.sql"
    const redemptionTokenMigrationPath =
      "supabase/migrations/20260615090000_redemption_tokens.sql"

    expect(existsSync(migrationPath)).toBe(true)
    expect(existsSync(redemptionTokenMigrationPath)).toBe(true)

    const migration = readProjectFile(migrationPath)
    const redemptionTokenMigration = readProjectFile(
      redemptionTokenMigrationPath
    )

    for (const marker of [
      "alter table public.merchant_locations",
      "latitude numeric",
      "longitude numeric",
      "geofence_radius_meters",
      "require_geofence",
      "function public.issue_self_service_stamp",
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

    for (const marker of [
      "create table if not exists public.redemption_tokens",
      "function public.create_redemption_token",
      "function public.get_redemption_token_status",
      "function public.lookup_redemption_token_for_merchant",
      "function public.consume_redemption_token",
      "redeemed_by_user_id",
    ]) {
      expect(redemptionTokenMigration).toContain(marker)
    }
  })
})
