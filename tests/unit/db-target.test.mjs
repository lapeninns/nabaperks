import assert from "node:assert/strict"
import test from "node:test"

import { assertLocalSupabaseDbUrl } from "../db/helpers/db-target.mjs"

test("database tests accept only local PostgreSQL targets", () => {
  for (const host of ["127.0.0.1", "localhost", "[::1]"]) {
    assert.equal(
      assertLocalSupabaseDbUrl(
        `postgresql://postgres:secret@${host}:54322/postgres`
      ),
      `postgresql://postgres:secret@${host}:54322/postgres`
    )
  }
})

test("database tests reject hosted and deceptive targets before connecting", () => {
  for (const target of [
    "postgresql://postgres:secret@db.example.supabase.co:5432/postgres",
    "postgresql://postgres:secret@localhost.attacker.example:5432/postgres",
    "https://127.0.0.1:54322/postgres",
    "not-a-url",
  ]) {
    assert.throws(
      () => assertLocalSupabaseDbUrl(target),
      /valid local PostgreSQL URL|must target loopback/
    )
  }
})

test("an absent target remains compatible with DB-free test discovery", () => {
  assert.equal(assertLocalSupabaseDbUrl(undefined), undefined)
  assert.equal(assertLocalSupabaseDbUrl("  "), undefined)
})
