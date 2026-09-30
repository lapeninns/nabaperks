import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

const read = (path) => readFileSync(path, "utf8")
const ZAP_IMAGE =
  /docker_name: ghcr\.io\/zaproxy\/zaproxy@sha256:[a-f0-9]{64}\n/

function rules() {
  return read(".zap/rules.tsv")
    .split("\n")
    .filter((line) => line.trim() && !line.startsWith("#"))
    .map((line) => {
      const [id, action, reason, ...extra] = line.split("\t")
      assert.equal(extra.length, 0, `malformed rule line: ${line}`)
      return { id, action, reason: reason ?? "" }
    })
}

test("the ZAP policy is well formed and every exception is owned and expiring", () => {
  const entries = rules()
  const ids = entries.map(({ id }) => id)
  assert.equal(new Set(ids).size, ids.length, "duplicate ZAP rule ids")
  const today = new Date().toISOString().slice(0, 10)
  for (const { id, action, reason } of entries) {
    assert.match(id, /^[0-9]+$/, `rule id ${id}`)
    assert.ok(["IGNORE", "WARN", "FAIL"].includes(action), `${id}: ${action}`)
    assert.ok(reason.trim().length > 0, `${id} needs a reason`)
    if (action === "FAIL") continue
    const owner = reason.match(/\bowner=(\S+)/)?.[1]
    const expires = reason.match(/\bexpires=(\d{4}-\d{2}-\d{2})\b/)?.[1]
    assert.ok(owner, `${id} ${action} exception needs owner=`)
    assert.ok(expires, `${id} ${action} exception needs expires=YYYY-MM-DD`)
    assert.ok(
      expires >= today,
      `${id} ${action} exception expired on ${expires}; re-review it`
    )
  }
  // The blocking set must not be empty, or fail_action proves nothing.
  const blocking = entries.filter(({ action }) => action === "FAIL")
  assert.ok(blocking.length >= 10, "blocking ZAP rules are missing")
  for (const header of ["10020", "10021", "10038"])
    assert.ok(ids.includes(header) && blocking.some(({ id }) => id === header))
})

test("the required ZAP root blocks on policy failures and proves the scan ran", () => {
  const ci = read(".github/workflows/ci.yml")
  const job = ci.slice(ci.indexOf("\n  zap-baseline:"), ci.indexOf("\n  db:"))
  assert.match(job, /uses: zaproxy\/action-baseline@[0-9a-f]{40} # v/)
  assert.match(job, ZAP_IMAGE)
  assert.match(job, /rules_file_name: \.zap\/rules\.tsv\n/)
  // -I keeps WARN non-blocking; FAIL rules and an unscannable target (exit 3)
  // still fail the action once fail_action is true.
  // The pinned action appends `-c` only when the rules file has IGNORE lines,
  // so the FAIL policy is loaded only if `-c` is passed here explicitly.
  assert.match(job, /cmd_options: -I -c \.zap\/rules\.tsv\n/)
  assert.match(job, /fail_action: true\n/)
  assert.match(
    job,
    /jq -e '\.site \| length == 1 and \.\[0\]\."@name" == "http:\/\/127\.0\.0\.1:3000"' report_json\.json/
  )
})

test("nightly full scans use the same pinned scanner image", () => {
  const ci = read(".github/workflows/ci.yml").match(ZAP_IMAGE)?.[0]
  const nightly = read(".github/workflows/nightly.yml").match(ZAP_IMAGE)?.[0]
  assert.ok(ci && nightly)
  assert.equal(nightly, ci)
})
