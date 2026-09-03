import assert from "node:assert/strict"
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { spawnSync } from "node:child_process"
import test from "node:test"

const repositoryRoot = process.cwd()
const scriptPath = resolve(repositoryRoot, "scripts/env-keys.mjs")
const scriptSource = readFileSync(scriptPath, "utf8")

function makeFixture({ existing = false, validTarget = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), "nabaperks-vercel-sync-"))
  const bin = join(root, "bin")
  const log = join(root, "vercel-args.log")
  mkdirSync(join(root, "config"), { recursive: true })
  mkdirSync(bin)
  writeFileSync(
    join(root, "config/env-contract.json"),
    JSON.stringify([
      {
        name: "SAFE_TEST_VALUE",
        description: "Fixture value",
        optional: false,
      },
    ])
  )
  writeFileSync(
    join(root, "config/vercel-governance-contract.json"),
    JSON.stringify(
      validTarget
        ? {
            scope: "canonical-scope",
            project: { id: "prj_canonical", name: "canonical-project" },
          }
        : { scope: "canonical-scope", project: {} }
    )
  )
  writeFileSync(join(root, ".env.local"), "SAFE_TEST_VALUE=fixture-only\n")

  const fakePnpm = join(bin, "pnpm")
  writeFileSync(
    fakePnpm,
    `#!/bin/sh
printf '%s\\n' "$*" >> "$VERCEL_ARGS_LOG"
case "$*" in
  *"env ls"*) ${existing ? "printf 'SAFE_TEST_VALUE  Encrypted\\n'" : ":"} ;;
esac
exit 0
`
  )
  chmodSync(fakePnpm, 0o755)

  return { root, log, bin }
}

function runFixture(fixture, args) {
  return spawnSync(process.execPath, [scriptPath, "push-vercel", ...args], {
    cwd: fixture.root,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${fixture.bin}:${process.env.PATH ?? ""}`,
      VERCEL_ARGS_LOG: fixture.log,
    },
  })
}

test("Vercel env sync ignores ambient linkage and targets the governed project", () => {
  const fixture = makeFixture()
  const result = runFixture(fixture, ["preview"])

  assert.equal(result.status, 0, result.stderr)
  const calls = readFileSync(fixture.log, "utf8").trim().split("\n")
  assert.equal(calls.length, 2)
  for (const call of calls) {
    assert.match(call, /--project prj_canonical --scope canonical-scope/)
    assert.doesNotMatch(call, /fixture-only/)
  }
})

test("replacement is non-destructive and remains bound to the governed project", () => {
  const fixture = makeFixture({ existing: true })
  const result = runFixture(fixture, ["preview", "--replace"])

  assert.equal(result.status, 0, result.stderr)
  const calls = readFileSync(fixture.log, "utf8").trim().split("\n")
  assert.equal(calls.length, 2)
  assert.match(calls[1], /env add SAFE_TEST_VALUE preview --yes --force/)
  assert.match(calls[1], /--project prj_canonical --scope canonical-scope/)
  assert.doesNotMatch(calls.join("\n"), /env rm/)
})

test("production requires explicit selection and confirmation before any CLI call", () => {
  assert.match(
    scriptSource,
    /pnpm env:push-vercel production --replace --confirm-production/
  )
  const omitted = makeFixture()
  const omittedResult = runFixture(omitted, [])
  assert.notEqual(omittedResult.status, 0)

  const unconfirmed = makeFixture()
  const unconfirmedResult = runFixture(unconfirmed, ["production"])
  assert.notEqual(unconfirmedResult.status, 0)

  const confirmed = makeFixture()
  const confirmedResult = runFixture(confirmed, [
    "production",
    "--confirm-production",
  ])
  assert.equal(confirmedResult.status, 0, confirmedResult.stderr)
})

test("an incomplete target contract fails before env values reach a CLI", () => {
  const fixture = makeFixture({ validTarget: false })
  const result = runFixture(fixture, ["preview"])

  assert.notEqual(result.status, 0)
  assert.throws(() => readFileSync(fixture.log, "utf8"), /ENOENT/)
})
