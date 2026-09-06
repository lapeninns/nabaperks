import assert from "node:assert/strict"
import { readPinnedEvidence } from "./restore-evidence.mjs"

function identifier(value, label) {
  assert.equal(typeof value, "string", `${label} is required`)
  assert.match(
    value,
    /^[a-zA-Z0-9][a-zA-Z0-9:_.-]{0,127}$/,
    `${label} is invalid`
  )
  return value
}

function timestamp(value, label) {
  assert.equal(typeof value, "string", `${label} is required`)
  const result = new Date(value)
  assert.ok(Number.isFinite(result.getTime()), `${label} is invalid`)
  assert.equal(result.toISOString(), value, `${label} must be canonical UTC`)
  return result
}

function boundedDelay(start, finish, limit, label) {
  assert.ok(Number.isFinite(limit) && limit > 0, `${label} limit is invalid`)
  const minutes = (finish - start) / 60_000
  assert.ok(
    minutes >= 0 && minutes <= limit,
    `${label} exceeds its latency bound or is out of order`
  )
  return Number(minutes.toFixed(2))
}

function dependencies(evidence, forbidden, label) {
  identifier(evidence?.provider, `${label} provider`)
  assert.equal(
    evidence.inventoryComplete,
    true,
    `${label} dependency inventory is incomplete`
  )
  assert.ok(
    Array.isArray(evidence.dependencies) && evidence.dependencies.length > 0,
    `${label} dependencies are required`
  )
  for (const dependency of evidence.dependencies) {
    identifier(dependency, `${label} dependency`)
    assert.equal(
      dependency,
      dependency.toLowerCase(),
      `${label} dependencies must be canonical lowercase`
    )
    assert.ok(
      !forbidden.some(
        (item) => dependency === item || dependency.startsWith(`${item}:`)
      ),
      `${label} depends on a prohibited failure domain`
    )
  }
  assert.ok(
    evidence.dependencies.includes(evidence.provider),
    `${label} provider is absent from dependencies`
  )
}

function phaseEvidence(phase, contract, eventAt, now, action) {
  assert.equal(phase?.action, action, `missing ${action} evidence`)
  const detectedAt = timestamp(phase.detectedAt, `${action} detection`)
  const detectionMinutes = boundedDelay(
    eventAt,
    detectedAt,
    action === "trigger"
      ? contract.maximumDetectionMinutes
      : contract.maximumRecoveryDetectionMinutes,
    `${action} detection`
  )
  const receipt = phase.receiverReceipt
  identifier(receipt?.deliveryId, `${action} receiver delivery ID`)
  assert.equal(
    receipt.signatureVerified,
    true,
    `${action} receiver signature is unverified`
  )
  assert.match(
    receipt.signedReceiptSha256 ?? "",
    /^[a-f0-9]{64}$/,
    `${action} signed receiver receipt digest required`
  )
  const acceptedAt = timestamp(
    receipt.acceptedAt,
    `${action} receiver acceptance`
  )
  const receiverAcceptanceMinutes = boundedDelay(
    detectedAt,
    acceptedAt,
    contract.maximumReceiverAcceptanceMinutes,
    `${action} receiver acceptance`
  )
  const delivery = phase.providerDelivery
  identifier(delivery?.messageId, `${action} provider message ID`)
  assert.equal(
    delivery.deliveryId,
    receipt.deliveryId,
    `${action} provider delivery does not match receiver`
  )
  assert.equal(
    delivery.status,
    "delivered",
    `${action} provider delivery is unproven`
  )
  const deliveredAt = timestamp(
    delivery.deliveredAt,
    `${action} provider delivery`
  )
  const providerDeliveryMinutes = boundedDelay(
    acceptedAt,
    deliveredAt,
    contract.maximumProviderDeliveryMinutes,
    `${action} provider delivery`
  )
  const acknowledgement = phase.humanAcknowledgement
  identifier(acknowledgement?.operatorId, `${action} acknowledging operator`)
  assert.equal(
    acknowledgement.messageId,
    delivery.messageId,
    `${action} operator acknowledgement does not match message`
  )
  const acknowledgedAt = timestamp(
    acknowledgement.acknowledgedAt,
    `${action} operator acknowledgement`
  )
  const humanAcknowledgementMinutes = boundedDelay(
    deliveredAt,
    acknowledgedAt,
    contract.maximumHumanAcknowledgementMinutes,
    `${action} operator acknowledgement`
  )
  assert.ok(acknowledgedAt <= now, `${action} acknowledgement is in the future`)
  return {
    deliveryId: receipt.deliveryId,
    messageId: delivery.messageId,
    acknowledgedAt,
    detectionMinutes,
    receiverAcceptanceMinutes,
    providerDeliveryMinutes,
    humanAcknowledgementMinutes,
  }
}

export function verifyIndependentMonitoringEvidence({
  evidence,
  contract,
  now = new Date(),
}) {
  assert.equal(contract.schema, "nabaperks.independent-monitoring-contract.v1")
  assert.equal(
    evidence.schema,
    contract.evidenceSchema,
    "wrong monitoring evidence schema"
  )
  assert.equal(evidence.service, contract.service, "wrong monitored service")
  assert.equal(
    evidence.environment,
    contract.environment,
    "wrong monitored environment"
  )
  assert.equal(
    evidence.monitoredDependency,
    contract.monitoredDependency,
    "wrong monitored dependency"
  )
  identifier(evidence.rehearsalId, "rehearsal ID")
  assert.ok(
    now instanceof Date && Number.isFinite(now.getTime()),
    "current time is invalid"
  )
  const collectedAt = timestamp(evidence.collectedAt, "evidence collection")
  boundedDelay(
    collectedAt,
    now,
    contract.maximumEvidenceAgeDays * 24 * 60,
    "evidence age"
  )
  dependencies(
    evidence.scheduler,
    contract.forbiddenSchedulerDependencies,
    "scheduler"
  )
  dependencies(evidence.paging, contract.forbiddenPagingDependencies, "paging")
  const outageAt = timestamp(evidence.outageStartedAt, "outage start")
  const recoveredAt = timestamp(evidence.serviceRecoveredAt, "service recovery")
  boundedDelay(
    outageAt,
    now,
    contract.maximumEvidenceAgeDays * 24 * 60,
    "rehearsal age"
  )
  assert.ok(
    outageAt < recoveredAt && recoveredAt <= collectedAt,
    "outage/recovery timeline is invalid"
  )
  const trigger = phaseEvidence(
    evidence.trigger,
    contract,
    outageAt,
    collectedAt,
    "trigger"
  )
  const resolve = phaseEvidence(
    evidence.resolve,
    contract,
    recoveredAt,
    collectedAt,
    "resolve"
  )
  assert.ok(
    trigger.acknowledgedAt <= recoveredAt,
    "outage must be acknowledged before recovery rehearsal"
  )
  assert.notEqual(
    trigger.deliveryId,
    resolve.deliveryId,
    "recovery reuses trigger receiver delivery"
  )
  assert.notEqual(
    trigger.messageId,
    resolve.messageId,
    "recovery reuses trigger provider message"
  )
  return {
    schema: "nabaperks.independent-monitoring-qualification.v1",
    rehearsalId: evidence.rehearsalId,
    qualifiedAt: now.toISOString(),
    evidenceCollectedAt: collectedAt.toISOString(),
    assurance: "protected-reviewed-evidence",
    trigger,
    resolve,
  }
}

export function loadIndependentMonitoringEvidence({
  evidenceFile,
  evidenceSha256,
  contract,
  now,
}) {
  const evidence = readPinnedEvidence(evidenceFile, evidenceSha256)
  return {
    ...verifyIndependentMonitoringEvidence({ evidence, contract, now }),
    evidenceSha256,
  }
}
