import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const root = process.cwd()
const specPath = join(
  root,
  "micro-specs/09-notifications/01-browser-push-notification-events.md"
)
const traceabilityPath = join(root, "micro-specs/traceability.json")

const requiredEvents = [
  "push_permission_prompt_viewed",
  "push_permission_granted",
  "push_subscription_created",
  "push_subscription_disabled",
  "push_subscription_failed",
  "one_stamp_away",
  "next_stamp_available",
  "reward_unlocked_waiting",
  "reward_ready",
  "profile_required_to_collect",
  "reward_expiring_soon",
  "reward_expired",
  "reward_collected_cycle_started",
  "dormant_progress",
  "venue_announcement",
] as const

describe("browser push notification micro-spec governance", () => {
  it("documents the browser-only event scope and hard exclusions", () => {
    const spec = readFileSync(specPath, "utf8")

    expect(spec).toContain("MS-NOTIFICATIONS-BROWSER-PUSH-EVENTS")
    expect(spec).toContain("Browser/PWA Web Push only")
    expect(spec).toContain("Do not implement native apps")
    expect(spec).toContain("Do not implement Firebase")
    expect(spec).toContain("Do not implement OneSignal")
    expect(spec).toContain("Do not implement SMS")
    expect(spec).toContain("Do not implement WhatsApp")
    expect(spec).toContain("Do not implement email")
    expect(spec).toContain("Do not implement passive near-venue/background geofencing")
    expect(spec).toContain("Do not store raw coordinates for notification targeting")
    expect(spec).toContain("reward_scan_tokens.expires_at")
    expect(spec).toContain("explicit marketing consent plus push preference")

    for (const eventName of requiredEvents) {
      expect(spec).toContain(eventName)
    }
  })

  it("registers every notification requirement in traceability with automated evidence", () => {
    const traceability = JSON.parse(readFileSync(traceabilityPath, "utf8"))
    const spec = traceability.specs.find(
      (entry: { spec_id?: string }) =>
        entry.spec_id === "MS-NOTIFICATIONS-BROWSER-PUSH-EVENTS"
    )

    expect(spec).toBeTruthy()
    expect(spec.status).toBe("active")
    expect(spec.risk_class).toBe("rls-rpc-ledger")
    expect(spec.source_path).toBe(
      "micro-specs/09-notifications/01-browser-push-notification-events.md"
    )

    const serialized = JSON.stringify(spec)
    for (const eventName of requiredEvents) {
      expect(serialized).toContain(eventName)
    }

    const requirementIds = spec.requirements.map(
      (requirement: { requirement_id: string }) => requirement.requirement_id
    )
    expect(requirementIds).toEqual([...requirementIds].sort())

    for (const requirement of spec.requirements) {
      expect(requirement.status).toBe(spec.status)
      expect(requirement.risk_class).toBe(spec.risk_class)
      expect(requirement.evidence).toContain(
        "tests/micro-specs/browser-push-notification-events.test.ts"
      )
      expect(requirement.verification_commands).toContain("pnpm governance")
      expect(requirement.verification_commands).toContain("pnpm typecheck")
      expect(requirement.verification_commands).toContain("pnpm db:verify")
      expect(requirement.edge_cases.length).toBeGreaterThan(0)
      expect(
        requirement.edge_cases.every(
          (edgeCase: { status: string }) => edgeCase.status === "covered"
        )
      ).toBe(true)
    }
  })
})
