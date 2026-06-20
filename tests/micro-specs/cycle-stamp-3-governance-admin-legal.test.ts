import { readFileSync } from "node:fs"

import { describe, expect, it, vi } from "vitest"

import { createSupabaseMock } from "../helpers/supabase"

function readProjectFile(path: string) {
  return readFileSync(path, "utf8")
}

type TraceEdgeCase = { readonly trigger: string; readonly expected: string }
type TraceRequirement = { readonly requirement_id: string; readonly summary: string; readonly edge_cases?: readonly TraceEdgeCase[] }

function traceRequirements(): TraceRequirement[] {
  return collectTraceRequirements(
    JSON.parse(readProjectFile("micro-specs/traceability.json"))
  )
}

function collectTraceRequirements(value: unknown): TraceRequirement[] {
  if (Array.isArray(value)) return value.flatMap(collectTraceRequirements)
  if (!isRecord(value)) return []

  const nested = Object.values(value).flatMap(collectTraceRequirements)
  return isTraceRequirement(value) ? [value, ...nested] : nested
}

function isTraceRequirement(value: unknown): value is TraceRequirement {
  return (
    isRecord(value) &&
    typeof value.requirement_id === "string" &&
    typeof value.summary === "string" &&
    (value.edge_cases === undefined ||
      (Array.isArray(value.edge_cases) && value.edge_cases.every(isTraceEdgeCase)))
  )
}

function isTraceEdgeCase(value: unknown): value is TraceEdgeCase {
  return (
    isRecord(value) &&
    typeof value.trigger === "string" &&
    typeof value.expected === "string"
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function sourceRequirementSummary(source: string, requirementId: string) {
  const line = source
    .split("\n")
    .find((candidate) => candidate.includes(`**${requirementId}**`))

  if (!line) {
    throw new Error(`Missing source requirement ${requirementId}`)
  }
  return line.replace(`- **${requirementId}** `, "").trim()
}

function traceRequirement(
  requirements: readonly TraceRequirement[],
  requirementId: string
) {
  const requirement = requirements.find((candidate) => {
    return candidate.requirement_id === requirementId
  })

  if (!requirement) {
    throw new Error(`Missing traceability requirement ${requirementId}`)
  }
  return requirement
}

describe("cycle-stamp-3 soft GPS governance, admin, and legal contracts", () => {
  it("redacts raw coordinate metadata from the admin fraud read model", async () => {
    vi.resetModules()
    const supabase = createSupabaseMock({
      from: {
        fraud_flags: [
          {
            data: [
              {
                id: "flag-1",
                signal: "soft_geofence_out_of_range",
                severity: "medium",
                status: "open",
                created_at: "2026-06-19T09:30:00.000Z",
                metadata: {
                  latitude: 51.524,
                  longitude: -0.071,
                  raw_metadata: { latitude: 51.5 },
                  cycle_stamp_number: 3,
                  location_status: "out_of_range",
                  distance_bucket: "out_250_1000m",
                  accuracy_bucket: "trusted_50_100m",
                  confidence: "high",
                  reason: "outside trusted range",
                },
                merchants: { business_name: "Bean House" },
                customers: { email: "alex@example.test", phone: "+447400123456" },
              },
            ],
            error: null,
          },
        ],
        product_events: [{ data: [], error: null }],
      },
    })
    vi.doMock("server-only", () => ({}))
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceRoleClient: vi.fn(() => supabase.client),
    }))
    const { getAdminFraudSignals } = await import("@/lib/admin/data")

    const result = await getAdminFraudSignals()

    expect(result.fraudFlags).toEqual([
      {
        id: "flag-1",
        signal: "soft_geofence_out_of_range",
        severity: "medium",
        status: "open",
        created_at: "2026-06-19T09:30:00.000Z",
        cycleStampNumber: 3,
        locationStatus: "out_of_range",
        distanceBucket: "out_250_1000m",
        accuracyBucket: "trusted_50_100m",
        confidence: "high",
        reason: "outside trusted range",
        merchant: "Bean House",
        maskedCustomer: "al***@example.test",
      },
    ])
    expect(JSON.stringify(result.fraudFlags)).not.toMatch(
      /latitude|longitude|raw_metadata|51\.524|-0\.071/
    )
  })

  it("keeps generic fraud signal and reason readback for non-geofence flags", async () => {
    vi.resetModules()
    const supabase = createSupabaseMock({
      from: {
        fraud_flags: [
          {
            data: [
              {
                id: "flag-volume",
                signal: "unusual_stamp_volume",
                severity: "high",
                status: "open",
                created_at: "2026-06-19T10:30:00.000Z",
                metadata: {
                  reason: "too many stamps in one hour",
                  stamp_count: 42,
                  raw_metadata: { phone: "+447400123456" },
                },
                merchants: { business_name: "Bean House" },
                customers: { email: null, phone: "+447400123456" },
              },
            ],
            error: null,
          },
        ],
        product_events: [{ data: [], error: null }],
      },
    })
    vi.doMock("server-only", () => ({}))
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceRoleClient: vi.fn(() => supabase.client),
    }))
    const { getAdminFraudSignals } = await import("@/lib/admin/data")

    const result = await getAdminFraudSignals()

    expect(result.fraudFlags).toEqual([
      expect.objectContaining({
        id: "flag-volume",
        signal: "unusual_stamp_volume",
        reason: "too many stamps in one hour",
        merchant: "Bean House",
        maskedCustomer: "+447***56",
      }),
    ])
    expect(JSON.stringify(result.fraudFlags)).not.toMatch(
      /stamp_count|raw_metadata|phone|\+447400123456/
    )
  })

  it("keeps the admin fraud page on minimized location-evidence fields", () => {
    const page = readProjectFile("app/admin/fraud/page.tsx")

    for (const heading of [
      "Signal",
      "Cycle stamp",
      "Location status",
      "Distance",
      "Accuracy",
      "Confidence",
      "Reason",
      "Merchant",
      "Customer",
      "Severity",
      "Status",
      "When",
    ]) {
      expect(page).toContain(`header: "${heading}"`)
    }

    expect(page).not.toContain("metadata")
    expect(page).not.toContain("latitude")
    expect(page).not.toContain("longitude")
  })

  it("keeps legal and fraud traceability aligned to source requirement IDs", () => {
    const requirements = traceRequirements()
    const traceabilityMarkdown = readProjectFile("micro-specs/TRACEABILITY.md")
    const fraudSpec = readProjectFile(
      "micro-specs/07-observability-compliance/03-security-fraud-and-rate-limits.md"
    )
    const legalSpec = readProjectFile(
      "micro-specs/07-observability-compliance/02-consent-legal-pages-and-data-requests.md"
    )
    const legalLookupId =
      "MS-OBSERVABILITY-COMPLIANCE-CONSENT-LEGAL-DATA-REQUESTS-006"
    const legalGpsCopyId =
      "MS-OBSERVABILITY-COMPLIANCE-CONSENT-LEGAL-DATA-REQUESTS-007"
    const fraudVolumeId =
      "MS-OBSERVABILITY-COMPLIANCE-SECURITY-FRAUD-RATE-LIMITS-004"
    const fraudGpsReadbackId =
      "MS-OBSERVABILITY-COMPLIANCE-SECURITY-FRAUD-RATE-LIMITS-010"

    for (const [source, requirementId] of [
      [legalSpec, legalLookupId],
      [legalSpec, legalGpsCopyId],
      [fraudSpec, fraudVolumeId],
      [fraudSpec, fraudGpsReadbackId],
    ] as const) {
      const sourceSummary = sourceRequirementSummary(source, requirementId)
      const traced = traceRequirement(requirements, requirementId)
      expect(traced.summary).toBe(sourceSummary)
      expect(traceabilityMarkdown).toContain(`\`${requirementId}\``)
    }

    expect(traceRequirement(requirements, legalLookupId).summary).toContain(
      "admin console SHALL provide enough lookup context"
    )
    expect(traceRequirement(requirements, fraudVolumeId).summary).toContain(
      "stamp volume is unusually high"
    )

    expect(traceRequirement(requirements, legalGpsCopyId).edge_cases).toContainEqual(
      expect.objectContaining({
        trigger: "soft GPS location copy is presented",
        expected:
          "privacy copy discloses minimized location evidence and raw coordinates are not stored by default",
      })
    )
    expect(
      traceRequirement(requirements, fraudGpsReadbackId).edge_cases
    ).toContainEqual(
      expect.objectContaining({
        trigger: "soft GPS evidence needs admin review",
        expected: "admin fraud readback is minimized and bucketed",
      })
    )
  })

  it("discloses minimized non-blocking location evidence in legal copy", () => {
    const legalContent = readProjectFile("lib/legal/content.ts")

    expect(legalContent).toContain("minimized location evidence")
    expect(legalContent).toContain("raw coordinates are not stored by default")
    expect(legalContent).toContain("stamps still save if location is denied")
  })
})
