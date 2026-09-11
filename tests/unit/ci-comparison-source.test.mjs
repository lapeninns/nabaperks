import assert from "node:assert/strict"
import { test } from "node:test"
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { spawnSync } from "node:child_process"
import { git } from "../../scripts/ci/impact-git.mjs"

const workflow = readFileSync(
  new URL("../../.github/workflows/ci.yml", import.meta.url),
  "utf8"
)
const job = workflow.slice(
  workflow.indexOf("\n  selection-comparison:"),
  workflow.indexOf("\n  fast:")
)
const script = job.match(
  /      - name: Select the immutable comparison verifier[\s\S]*?        run: \|\n([\s\S]*?)\n      - name: Check out the immutable verifier/
)?.[1]
assert.ok(script)
const selector = script
  .split("\n")
  .map((line) => line.replace(/^          /, ""))
  .join("\n")

function fixture(t) {
  const cwd = mkdtempSync(join(tmpdir(), "ci-comparison-source-"))
  t.after(() => rmSync(cwd, { recursive: true, force: true }))
  git(["init", "-q"], { cwd })
  git(["config", "user.name", "CI fixture"], { cwd })
  git(["config", "user.email", "ci@example.test"], { cwd })
  const put = (path, text) => {
    mkdirSync(join(cwd, path, ".."), { recursive: true })
    writeFileSync(join(cwd, path), text)
  }
  const commit = () => {
    git(["add", "--all"], { cwd })
    git(["-c", "core.hooksPath=/dev/null", "commit", "-qm", "fixture"], { cwd })
    return git(["rev-parse", "HEAD"], { cwd }).trim()
  }
  const select = (sha, event = "pull_request") => {
    const output = join(cwd, "selection-output")
    rmSync(output, { force: true })
    const run = spawnSync("bash", ["-e", "-c", selector], {
      cwd,
      encoding: "utf8",
      env: {
        ...process.env,
        REVIEWED_REVISION: sha,
        GITHUB_EVENT_NAME: event,
        GITHUB_OUTPUT: output,
      },
    })
    return {
      status: run.status,
      text: run.status === 0 ? readFileSync(output, "utf8") : "",
    }
  }
  return { cwd, put, commit, select }
}

test("comparison checks out reviewed code and dependencies before reading reports", () => {
  assert.match(
    job,
    /ref: \$\{\{ github.event_name == 'pull_request' && github.event.pull_request.base.sha \|\| github.sha \}\}/
  )
  assert.match(job, /ref: \$\{\{ steps.verifier.outputs.revision \}\}/)
  assert.ok(
    job.indexOf("Check out the immutable verifier") <
      job.indexOf("uses: ./.github/actions/setup")
  )
  assert.ok(
    job.indexOf("Verify the comparison source revision") <
      job.indexOf("run: node scripts/ci/compare-targeted-evidence.mjs")
  )
  assert.match(
    job,
    /result.verifier = \{ revision: process.env.VERIFIER_REVISION, source: process.env.VERIFIER_SOURCE \}/
  )
})

test("a weakened candidate verifier cannot replace the selected base verdict", (t) => {
  const f = fixture(t),
    path = "scripts/ci/compare-targeted-evidence.mjs"
  f.put(
    path,
    'if (process.env.PROOF !== "valid") throw new Error("Invalid raw proof")'
  )
  f.put(
    "scripts/ci/documentation-evidence-contract.mjs",
    "export const schema = 'v1'"
  )
  const base = f.commit()
  f.put(path, 'console.log("success without checking proof")')
  const candidate = f.commit()
  git(["checkout", "--detach", base], f)
  const selection = f.select(base)
  assert.equal(selection.status, 0)
  assert.match(selection.text, new RegExp(`revision=${base}`))
  assert.doesNotMatch(selection.text, new RegExp(candidate))
  const run = spawnSync(process.execPath, [path], {
    cwd: f.cwd,
    env: { ...process.env, PROOF: "invalid" },
    encoding: "utf8",
  })
  assert.notEqual(run.status, 0)
  assert.match(run.stderr, /Invalid raw proof/)
  assert.notEqual(f.select(candidate).status, 0)
})

test("integration requires a reviewed verifier that consumes the documentation contract", (t) => {
  const f = fixture(t)
  f.put("README.md", "# Before foundation")
  assert.notEqual(f.select(f.commit()).status, 0)
  f.put(
    "scripts/ci/compare-targeted-evidence.mjs",
    "export const legacy = true"
  )
  assert.notEqual(f.select(f.commit()).status, 0)
  f.put(
    "scripts/ci/documentation-evidence-contract.mjs",
    "export const schema = 'v1'"
  )
  const base = f.commit()
  assert.equal(f.select(base).status, 0)
  assert.match(f.select(base).text, new RegExp(`revision=${base}`))
  assert.match(f.select(base).text, /source=reviewed-base/)
  assert.doesNotMatch(job, /reviewed-bootstrap|1a503961/)
})

test("missing foundation stops selection before application jobs can start", (t) => {
  const f = fixture(t)
  f.put("README.md", "# Before foundation")
  f.commit()
  const body = workflow.match(
    /name: Classify the immutable candidate with reviewed policy[\s\S]*?run: \|\n([\s\S]*?)\n\n  documentation:/
  )?.[1]
  assert.ok(body)
  const command = body
    .split("\n")
    .map((line) => line.replace(/^          /, ""))
    .join("\n")
  const output = join(f.cwd, "plan-output"),
    summary = join(f.cwd, "summary")
  const execute = () =>
    spawnSync("bash", ["-e", "-c", command], {
      cwd: f.cwd,
      encoding: "utf8",
      env: {
        ...process.env,
        GITHUB_OUTPUT: output,
        GITHUB_STEP_SUMMARY: summary,
      },
    })
  const missing = execute()
  assert.notEqual(missing.status, 0)
  assert.match(
    missing.stdout,
    /Land the reviewed CI selection verifier foundation/
  )
  f.put(
    "scripts/ci/compare-targeted-evidence.mjs",
    "export const verifier = true"
  )
  f.put(
    "scripts/ci/documentation-evidence-contract.mjs",
    "export const schema = 'v1'"
  )
  assert.equal(execute().status, 0)
  assert.match(readFileSync(output, "utf8"), /profile=full\ncomparison=true/)
})
