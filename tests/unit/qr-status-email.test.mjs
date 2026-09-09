import assert from "node:assert/strict"
import { test } from "node:test"
import {
  buildQrPauseCodeEmail,
  buildQrStatusEmail,
} from "../../lib/notifications/qr-status-email.ts"
import {
  deliverQrStatusEmail,
  qrEmailFailureOutcome,
} from "../../lib/notifications/qr-status-worker-core.ts"
import {
  isQrPauseComplete,
  maskQrOwnerEmail,
  qrPauseResult,
} from "../../lib/merchant/qr-pause-state.ts"

const base = {
  venueName: 'The <Crown> & "Friends"',
  isActive: false,
  scansAvailable: false,
  changedAt: "2026-09-09T12:45:00Z",
  workspaceUrl: "https://example.test/app/qr",
}

test("pause and resume confirmation copy escapes HTML and gives London summer/winter time", () => {
  const pause = buildQrStatusEmail(base)
  assert.match(pause.text, /paused on 9 September 2026 at 13:45 BST/)
  assert.match(pause.text, /cannot use this QR to join or collect stamps/)
  assert.doesNotMatch(pause.html, /<Crown>/)
  assert.match(pause.html, /&lt;Crown&gt; &amp; &quot;Friends&quot;/)
  const live = buildQrStatusEmail({
    ...base,
    isActive: true,
    scansAvailable: true,
    changedAt: "2026-01-09T12:45:00Z",
  })
  assert.match(live.text, /12:45 GMT/)
  assert.match(live.text, /Venue QR is live/)
  const blocked = buildQrStatusEmail({ ...base, isActive: true })
  assert.match(blocked.text, /scans remain unavailable/)
  assert.doesNotMatch(blocked.text, /QR is live/)
})

test("pause code explicitly authorises a pause and requesting it leaves QR active", () => {
  const mail = buildQrPauseCodeEmail(base.venueName, "123456")
  assert.match(mail.text, /123456/)
  assert.match(mail.text, /10 minutes/)
  assert.match(mail.text, /has not paused your QR/)
  assert.doesNotMatch(mail.html, /<Crown>/)
  assert.doesNotMatch(mail.subject, /123456/)
})

test("delivery retry keeps a stable recipient idempotency key after ambiguous provider outcome", async () => {
  const row = {
    id: "email-1",
    lease_id: "lease-1",
    recipient: "owner@example.test",
    venue_name: "Crown",
    is_active: false,
    scans_available: false,
    changed_at: base.changedAt,
    provider_payload: null,
  }
  const keys = []
  const bodies = []
  let stored
  const persist = async (candidate) => (stored ??= candidate)
  const outcomes = []
  const finish = async (outcome) => {
    outcomes.push(outcome)
    return true
  }
  assert.equal(
    await deliverQrStatusEmail({
      row,
      workspaceUrl: base.workspaceUrl,
      prepare: JSON.stringify,
      persist,
      finish,
      send: async (payload, key) => {
        bodies.push(payload)
        keys.push(key)
        throw new Error("timeout")
      },
    }),
    false
  )
  assert.equal(
    await deliverQrStatusEmail({
      row: { ...row, lease_id: "lease-2" },
      workspaceUrl: "https://changed.test/app/qr",
      prepare: (input) =>
        JSON.stringify({
          ...input,
          from: "changed@example.test",
          subject: "New template",
        }),
      persist,
      finish,
      send: async (payload, key) => {
        bodies.push(payload)
        keys.push(key)
      },
    }),
    true
  )
  assert.deepEqual(keys, ["qr-status:email-1", "qr-status:email-1"])
  assert.deepEqual(outcomes, ["temporary", "sent"])
  assert.equal(bodies[0], bodies[1])
  assert.match(bodies[1], /example.test/)
  assert.doesNotMatch(bodies[1], /changed.test|New template/)
})

test("delivery failures and lost leases cannot be reported as recorded success", async () => {
  assert.equal(
    qrEmailFailureOutcome(
      new Error("Resend send failed (422): invalid recipient")
    ),
    "permanent"
  )
  for (const status of [408, 409, 429, 500, 503])
    assert.equal(
      qrEmailFailureOutcome(new Error(`Resend send failed (${status}): retry`)),
      "temporary"
    )
  const row = {
    id: "email-2",
    lease_id: "lease",
    recipient: "venue@example.test",
    venue_name: "Crown",
    is_active: true,
    scans_available: true,
    changed_at: base.changedAt,
    provider_payload: null,
  }
  assert.equal(
    await deliverQrStatusEmail({
      row,
      workspaceUrl: base.workspaceUrl,
      prepare: JSON.stringify,
      persist: async (candidate) => candidate,
      send: async () => {},
      finish: async () => false,
    }),
    false
  )
})

test("owner address is masked and replay response never claims a fresh pause", () => {
  assert.equal(maskQrOwnerEmail("owner@example.test"), "o•••@example.test")
  assert.equal(isQrPauseComplete("paused"), true)
  assert.equal(isQrPauseComplete("already_completed"), true)
  assert.equal(isQrPauseComplete("incorrect"), false)
  assert.match(qrPauseResult("already_completed").message, /current status/)
})

test("failed payload persistence prevents the provider request", async () => {
  let sends = 0
  const outcomes = []
  const result = await deliverQrStatusEmail({
    row: {
      id: "email-persist",
      lease_id: "lease",
      recipient: "owner@example.test",
      venue_name: "Crown",
      is_active: false,
      scans_available: false,
      changed_at: base.changedAt,
      provider_payload: null,
    },
    workspaceUrl: base.workspaceUrl,
    prepare: JSON.stringify,
    persist: async () => {
      throw new Error("database unavailable")
    },
    send: async () => {
      sends++
    },
    finish: async (outcome) => {
      outcomes.push(outcome)
      return true
    },
  })
  assert.equal(result, false)
  assert.equal(sends, 0)
  assert.deepEqual(outcomes, ["temporary"])
})
