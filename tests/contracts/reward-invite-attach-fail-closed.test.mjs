import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)

function readProjectFile(...segments) {
  return readFileSync(path.join(projectRoot, ...segments), "utf8")
}

test("Given a matched reward invite on a billing-gated merchant When attach runs Then it fail-closes without calling the throwing direct RPC", () => {
  const migration = readProjectFile(
    "supabase",
    "migrations",
    "20260710092000_attach_reward_invites_fail_closed.sql"
  )

  const attachStart = migration.indexOf(
    "create or replace function public.attach_matched_reward_invites"
  )
  const attachBody = attachStart === -1 ? "" : migration.slice(attachStart)

  assert.ok(attachBody, "attach RPC replacement migration must exist")
  assert.match(attachBody, /loyalty_availability_reason/)
  assert.match(attachBody, /v_availability_reason in \('billing_required', 'billing_blocked'\)/)
  assert.match(attachBody, /continue;[\s\S]*end if;/)
  assert.doesNotMatch(attachBody, /public\.issue_merchant_direct_reward/)
  assert.match(attachBody, /internal_issue_merchant_direct_reward/)
})
