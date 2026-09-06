import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"
import {
  loadIndependentMonitoringEvidence,
  verifyIndependentMonitoringEvidence,
} from "../../scripts/recovery/monitoring-evidence.mjs"

const contract = JSON.parse(
  readFileSync(
    new URL(
      "../../config/independent-monitoring-contract.json",
      import.meta.url
    ),
    "utf8"
  )
)
const now = new Date("2026-09-06T12:00:00.000Z")

function phase(action, hour) {
  const at = (minutes) => `2026-09-06T${hour}:${minutes}:00.000Z`
  return {
    action,
    detectedAt: at("05"),
    receiverReceipt: {
      deliveryId: `${action}-receipt`,
      signatureVerified: true,
      signedReceiptSha256: "a".repeat(64),
      acceptedAt: at("06"),
    },
    providerDelivery: {
      messageId: `${action}-message`,
      deliveryId: `${action}-receipt`,
      status: "delivered",
      deliveredAt: at("07"),
    },
    humanAcknowledgement: {
      operatorId: "operator-1",
      messageId: `${action}-message`,
      acknowledgedAt: at("08"),
    },
  }
}

function fixture() {
  return {
    schema: contract.evidenceSchema,
    service: "nabaperks",
    environment: "production",
    monitoredDependency: contract.monitoredDependency,
    rehearsalId: "rehearsal-123",
    collectedAt: "2026-09-06T11:10:00.000Z",
    outageStartedAt: "2026-09-06T10:00:00.000Z",
    serviceRecoveredAt: "2026-09-06T11:00:00.000Z",
    scheduler: {
      provider: "independent-monitor",
      inventoryComplete: true,
      dependencies: ["independent-monitor", "independent-dns"],
    },
    paging: {
      provider: "independent-pager",
      inventoryComplete: true,
      dependencies: ["independent-pager", "independent-store"],
    },
    trigger: phase("trigger", "10"),
    resolve: phase("resolve", "11"),
  }
}

const verify = (evidence) =>
  verifyIndependentMonitoringEvidence({ evidence, contract, now })

test("independent monitoring keeps receiver acceptance, provider delivery and human acknowledgement distinct", () => {
  const result = verify(fixture())
  assert.equal(result.assurance, "protected-reviewed-evidence")
  assert.equal(result.trigger.detectionMinutes, 5)
  assert.equal(result.trigger.receiverAcceptanceMinutes, 1)
  assert.equal(result.trigger.providerDeliveryMinutes, 1)
  assert.equal(result.trigger.humanAcknowledgementMinutes, 1)
  assert.notEqual(result.trigger.messageId, result.resolve.messageId)
})

test("GitHub or monitored Supabase dependencies cannot qualify scheduler or paging", () => {
  for (const role of ["scheduler", "paging"]) {
    for (const dependency of [
      "github",
      "github:actions",
      contract.monitoredDependency,
      `${contract.monitoredDependency}:database`,
    ]) {
      const evidence = fixture()
      evidence[role].dependencies.push(dependency)
      assert.throws(() => verify(evidence), /prohibited failure domain/)
    }
    const evidence = fixture()
    evidence[role].inventoryComplete = false
    assert.throws(() => verify(evidence), /inventory is incomplete/)
  }
})

test("HTTP acceptance or unrelated provider and operator receipts cannot stand in for delivered pages", () => {
  const changes = [
    (e) => {
      e.trigger.receiverReceipt.signatureVerified = false
    },
    (e) => {
      delete e.trigger.receiverReceipt.signedReceiptSha256
    },
    (e) => {
      e.trigger.providerDelivery.status = "accepted"
    },
    (e) => {
      e.trigger.providerDelivery.deliveryId = "different"
    },
    (e) => {
      delete e.trigger.humanAcknowledgement
    },
    (e) => {
      e.resolve.humanAcknowledgement.messageId = "different"
    },
  ]
  for (const change of changes) {
    const evidence = fixture()
    change(evidence)
    assert.throws(() => verify(evidence))
  }
})

test("missing, stale, future, late and wrong-target monitoring evidence fail closed", () => {
  const changes = [
    (e) => {
      e.monitoredDependency = "supabase:other"
    },
    (e) => {
      e.environment = "staging"
    },
    (e) => {
      delete e.scheduler
    },
    (e) => {
      e.collectedAt = "2026-07-01T11:10:00.000Z"
    },
    (e) => {
      e.collectedAt = "2026-09-07T11:10:00.000Z"
    },
    (e) => {
      e.outageStartedAt = "2026-07-01T10:00:00.000Z"
    },
    (e) => {
      e.trigger.detectedAt = "2026-09-06T10:21:00.000Z"
    },
    (e) => {
      e.resolve.detectedAt = "2026-09-06T11:21:00.000Z"
    },
    (e) => {
      e.trigger.receiverReceipt.acceptedAt = "2026-09-06T10:11:00.000Z"
    },
    (e) => {
      e.trigger.providerDelivery.deliveredAt = "2026-09-06T10:12:00.000Z"
    },
    (e) => {
      e.trigger.humanAcknowledgement.acknowledgedAt = "2026-09-06T10:23:00.000Z"
    },
  ]
  for (const change of changes) {
    const evidence = fixture()
    change(evidence)
    assert.throws(() => verify(evidence))
  }
})

test("monitoring evidence file must match the protected reviewed digest", (t) => {
  const root = mkdtempSync(path.join(tmpdir(), "monitor-proof-"))
  t.after(() => rmSync(root, { force: true, recursive: true }))
  const evidenceFile = path.join(root, "evidence.json")
  const bytes = JSON.stringify(fixture())
  const evidenceSha256 = createHash("sha256").update(bytes).digest("hex")
  writeFileSync(evidenceFile, bytes)
  assert.equal(
    loadIndependentMonitoringEvidence({
      evidenceFile,
      evidenceSha256,
      contract,
      now,
    }).evidenceSha256,
    evidenceSha256
  )
  writeFileSync(
    evidenceFile,
    JSON.stringify({ ...fixture(), rehearsalId: "changed" })
  )
  assert.throws(
    () =>
      loadIndependentMonitoringEvidence({
        evidenceFile,
        evidenceSha256,
        contract,
        now,
      }),
    /protected digest/
  )
})
