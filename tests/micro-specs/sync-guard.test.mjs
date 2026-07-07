import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const syncCli = path.join(projectRoot, "scripts/sync-skill-bundles.mjs")

/**
 * MS-governance-sync-guard — sync-skill-bundles must not clobber uncommitted
 * lockstep edits. The kit is canonical: a dirty repo-side engine/shared-test
 * file that differs from its template is someone's work in flight, so the
 * sync refuses it (exit 1, file named, remedy stated) unless --force. The
 * real CLI runs against disposable fixture repos via GOVERNANCE_SYNC_ROOT.
 */

function makeSyncFixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), "sync-guard-"))
  t.after(() => rmSync(root, { recursive: true, force: true }))

  cpSync(
    path.join(projectRoot, "ai-governance-starter-kit"),
    path.join(root, "ai-governance-starter-kit"),
    { recursive: true }
  )
  mkdirSync(path.join(root, "scripts"), { recursive: true })
  mkdirSync(path.join(root, "tests/micro-specs"), { recursive: true })

  const git = (...args) =>
    execFileSync("git", args, { cwd: root, stdio: ["ignore", "pipe", "ignore"], encoding: "utf8" }).trim()
  git("init", "-q", "-b", "main")
  git("config", "user.email", "fixture@example.com")
  git("config", "user.name", "Fixture")
  git("config", "commit.gpgsign", "false")

  // Bootstrap sync populates the lockstep copies and bundles, then a
  // baseline commit makes everything clean.
  const bootstrap = runSync(root)
  assert.equal(bootstrap.status, 0, `bootstrap sync must succeed: ${bootstrap.stderr}`)
  git("add", "-A")
  git("commit", "-q", "-m", "baseline")

  return root
}

function runSync(root, ...args) {
  try {
    const stdout = execFileSync("node", [syncCli, ...args], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, GOVERNANCE_SYNC_ROOT: root },
    })
    return { status: 0, stdout, stderr: "" }
  } catch (error) {
    return {
      status: error.status ?? 1,
      stdout: error.stdout?.toString() ?? "",
      stderr: error.stderr?.toString() ?? "",
    }
  }
}

test("Given a kit-side edit with a clean repo copy When synced Then it propagates", (t) => {
  const root = makeSyncFixture(t)
  const kitFile = path.join(root, "ai-governance-starter-kit/templates/scripts/governance-glob.mjs")
  writeFileSync(kitFile, `${readFileSync(kitFile, "utf8")}\n// kit-side change\n`)

  const result = runSync(root)

  assert.equal(result.status, 0, result.stderr)
  assert.match(
    readFileSync(path.join(root, "scripts/governance-glob.mjs"), "utf8"),
    /kit-side change/,
    "committed-clean targets keep receiving kit propagation"
  )
})

test("Given a dirty differing repo copy When synced Then it is refused and preserved; --force overrides", (t) => {
  const root = makeSyncFixture(t)
  const target = path.join(root, "scripts/governance-glob.mjs")
  writeFileSync(target, `${readFileSync(target, "utf8")}\n// uncommitted repo-side edit\n`)

  const refused = runSync(root)
  assert.equal(refused.status, 1, "a dirty differing lockstep target refuses the sync")
  assert.match(refused.stderr, /Refusing to overwrite scripts\/governance-glob\.mjs/)
  assert.match(refused.stderr, /kit is canonical/i)
  assert.match(
    readFileSync(target, "utf8"),
    /uncommitted repo-side edit/,
    "the uncommitted edit survives the refusal"
  )

  const forced = runSync(root, "--force")
  assert.equal(forced.status, 0, forced.stderr)
  assert.doesNotMatch(
    readFileSync(target, "utf8"),
    /uncommitted repo-side edit/,
    "--force discards the repo-side edit deliberately"
  )
})

test("Given a missing lockstep target When synced Then it bootstraps without refusing", (t) => {
  const root = makeSyncFixture(t)
  const target = path.join(root, "scripts/governance-glob.mjs")
  rmSync(target)

  const result = runSync(root)

  assert.equal(result.status, 0, result.stderr)
  assert.match(
    readFileSync(target, "utf8"),
    /matchesPattern|Glob matching/,
    "an absent target is bootstrap, not a conflict"
  )
})
