import assert from "node:assert/strict"
import { test } from "node:test"

import { assertPasswordlessRollbackSources } from "../../scripts/check-passwordless-rollback-revision.mjs"

const passwordlessActions = `
  await supabase.auth.signInWithOtp({ email })
`
const guardedSession = `
  await supabase.rpc("current_auth_session_is_passwordless")
`

test("a passwordless entry path with the request-time AMR guard is rollback-compatible", () => {
  assert.doesNotThrow(() =>
    assertPasswordlessRollbackSources({
      actions: passwordlessActions,
      session: guardedSession,
    })
  )
})

test("a pre-cutover password login revision is rejected", () => {
  assert.throws(
    () =>
      assertPasswordlessRollbackSources({
        actions: `await supabase.auth.signInWithPassword({ email, password })`,
        session: guardedSession,
      }),
    /no passwordless merchant entry path|still contains merchant password access/
  )
})

test("a revision without the password-origin request guard is rejected", () => {
  assert.throws(
    () =>
      assertPasswordlessRollbackSources({
        actions: passwordlessActions,
        session: `await supabase.auth.getUser()`,
      }),
    /does not reject password-origin sessions/
  )
})
