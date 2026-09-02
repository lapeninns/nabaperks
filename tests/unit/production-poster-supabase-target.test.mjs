import assert from "node:assert/strict"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"

import {
  assertProductionPosterSupabaseTarget,
  readCanonicalProductionSupabaseRef,
  resolveProductionPosterCredentials,
} from "../../scripts/production-poster-supabase-target.mjs"

const REF = "skonlhwstejberyzobep"
const CANONICAL = `https://${REF}.supabase.co`

test("production poster export accepts only the canonical project origin", () => {
  assert.equal(
    assertProductionPosterSupabaseTarget(`${CANONICAL}/`, {
      productionRef: REF,
    }),
    CANONICAL
  )

  for (const value of [
    "https://attacker-project.supabase.co",
    `http://${REF}.supabase.co`,
    `https://${REF}.supabase.co.attacker.example`,
    `https://user:pass@${REF}.supabase.co`,
    `${CANONICAL}/rest/v1`,
    `${CANONICAL}?redirect=1`,
    `${CANONICAL}#fragment`,
  ]) {
    assert.throws(
      () => assertProductionPosterSupabaseTarget(value, { productionRef: REF }),
      (error) =>
        error instanceof Error &&
        /not authorised/.test(error.message) &&
        !error.message.includes(value)
    )
  }
})

test("local poster export requires the explicit local mode", () => {
  assert.throws(() =>
    assertProductionPosterSupabaseTarget("http://127.0.0.1:54321", {
      productionRef: REF,
    })
  )
  assert.equal(
    assertProductionPosterSupabaseTarget("http://127.0.0.1:54321/", {
      allowLocal: true,
      productionRef: REF,
    }),
    "http://127.0.0.1:54321"
  )
})

test("invalid target errors never echo the supplied value", () => {
  const supplied = "not-a-url-with-sensitive-text"
  assert.throws(
    () =>
      assertProductionPosterSupabaseTarget(supplied, { productionRef: REF }),
    (error) => error instanceof Error && !error.message.includes(supplied)
  )
})

test("the canonical project ref is module-relative, not selected by cwd", async (t) => {
  const decoyRoot = await mkdtemp(
    path.join(tmpdir(), "nabaperks-poster-decoy-")
  )
  t.after(() => rm(decoyRoot, { recursive: true, force: true }))
  await mkdir(path.join(decoyRoot, "config"))
  await writeFile(
    path.join(decoyRoot, "config", "supabase-governance-contract.json"),
    JSON.stringify({ productionProject: { ref: "attackerrefattackerref" } })
  )

  const originalCwd = process.cwd()
  process.chdir(decoyRoot)
  try {
    assert.equal(readCanonicalProductionSupabaseRef(), REF)
  } finally {
    process.chdir(originalCwd)
  }
})

test("an explicit environment file cannot be mixed with process credentials", () => {
  assert.throws(() =>
    resolveProductionPosterCredentials({
      envFileSelected: true,
      fileEnv: { NEXT_PUBLIC_SUPABASE_URL: CANONICAL },
      processEnv: { SUPABASE_SERVICE_ROLE_KEY: "process-secret" },
    })
  )
  assert.throws(() =>
    resolveProductionPosterCredentials({
      envFileSelected: true,
      fileEnv: { SUPABASE_SERVICE_ROLE_KEY: "file-secret" },
      processEnv: { NEXT_PUBLIC_SUPABASE_URL: CANONICAL },
    })
  )
})

test("complete process and explicit-file credential pairs remain supported", () => {
  assert.deepEqual(
    resolveProductionPosterCredentials({
      envFileSelected: false,
      fileEnv: {},
      processEnv: {
        NEXT_PUBLIC_SUPABASE_URL: CANONICAL,
        SUPABASE_SERVICE_ROLE_KEY: "process-secret",
      },
    }),
    {
      serviceRoleKey: "process-secret",
      supabaseUrl: CANONICAL,
    }
  )
  assert.deepEqual(
    resolveProductionPosterCredentials({
      envFileSelected: true,
      fileEnv: {
        NEXT_PUBLIC_SUPABASE_URL: CANONICAL,
        SUPABASE_SERVICE_ROLE_KEY: "file-secret",
      },
      processEnv: {},
    }),
    {
      serviceRoleKey: "file-secret",
      supabaseUrl: CANONICAL,
    }
  )
})
