import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

/**
 * run-roots.sh — the developer-plane runner's plan, read through --dry-run.
 *
 * The plan is the part that has to stay in step with hosted CI: every e2e
 * pack and accessibility shard the workflow runs must appear exactly once,
 * the longest work must start first, browser work must stay capped at the
 * 8 GiB a sequential pack needs, and a container may only see paths under
 * the cache directory (so restricted Docker file sharing still works).
 * --dry-run touches neither Docker nor the cache, so this runs anywhere.
 */

const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url))
const SCRIPT = join(REPO_ROOT, "ops/local-ci/roots/run-roots.sh")
// Never created: a dry run must not write to the cache directory.
const WORK = join(tmpdir(), `run-roots-dry-run-${process.pid}`)
const CI = readFileSync(join(REPO_ROOT, ".github/workflows/ci.yml"), "utf8")

// Always a dry run: nothing here may reach Docker, git clones or the cache.
function runRoots(args) {
  return spawnSync("bash", [SCRIPT, "HEAD", ...args, "--dry-run"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    env: { ...process.env, LOCAL_CI_WORK: WORK },
  })
}

function matrix(jobId, key) {
  const start = CI.indexOf(`\n  ${jobId}:\n`)
  assert.notEqual(start, -1, `ci.yml must declare ${jobId}`)
  const body = CI.slice(start + 1)
  const end = body.slice(1).search(/\n {2}\S/)
  const values = new RegExp(`\\n {8}${key}: \\[([^\\]]+)\\]`).exec(
    end === -1 ? body : body.slice(0, end + 1)
  )
  assert.ok(values, `${jobId} must declare a ${key} matrix`)
  return values[1].split(",").map((value) => value.trim())
}

test("--jobs N plans one capped container per hosted job, longest first", () => {
  const run = runRoots([
    "fast",
    "quality",
    "e2e",
    "a11y",
    "lighthouse",
    "--jobs",
    "3",
  ])
  assert.equal(run.status, 0, run.stderr)
  const tasks = [
    ...run.stdout.matchAll(
      /^ {2}task (\S+) cpus=(\d+) memory=(\d+)g estimate=(\d+)s$/gm
    ),
  ].map(([, name, cpus, memory, estimate]) => ({
    name,
    cpus: Number(cpus),
    memory: Number(memory),
    estimate: Number(estimate),
  }))

  const expected = ["fast", "quality"]
  for (const project of matrix("e2e", "project"))
    for (const pack of matrix("e2e", "pack"))
      expected.push(`e2e-${project}-${pack}`)
  for (const project of matrix("a11y", "project"))
    for (const shard of matrix("a11y", "shard"))
      expected.push(`a11y-${project}-${shard.split("/")[0]}`)
  assert.deepEqual(tasks.map((task) => task.name).sort(), expected.sort())
  assert.match(run.stdout, /at most 3 at once/)

  for (let index = 1; index < tasks.length; index += 1)
    assert.ok(tasks[index - 1].estimate >= tasks[index].estimate)
  for (const task of tasks.filter(({ name }) => /^(e2e|a11y)-/.test(name)))
    assert.equal(task.memory, 8, `${task.name} must keep the 8 GiB cap`)

  const mounts = /^ {2}mounts: (.*)$/m.exec(run.stdout)?.[1] ?? ""
  const sources = [...mounts.matchAll(/-v ([^:]+):/g)].map(
    ([, source]) => source
  )
  assert.equal(sources.length, 4)
  for (const source of sources)
    assert.ok(
      source.startsWith(`${WORK}/`) || !source.includes("/"),
      `${source} must be under the cache directory or a named volume`
    )
  assert.doesNotMatch(mounts, /\.git/)
  // Clones follow slots, not tasks: at most N copies of the object store.
  assert.ok(
    sources.includes(`${WORK}/tree-slot-<slot>`),
    "each slot must reuse one clone"
  )
  assert.match(run.stdout, /^host, serial: lighthouse$/m)
  assert.equal(existsSync(WORK), false, "a dry run must not create the cache")
})

test("the default keeps one serial container for every container root", () => {
  const run = runRoots([])
  assert.equal(run.status, 0, run.stderr)
  assert.match(
    run.stdout,
    /^serial: one container runs fast coverage quality build a11y visual e2e$/m
  )
  assert.doesNotMatch(run.stdout, /^ {2}task /m)
  assert.match(run.stdout, /^host, serial: lighthouse zap db$/m)
})

test("unknown roots and non-positive job counts are refused", () => {
  for (const args of [["bogus"], ["fast", "--jobs", "0"], ["--jobs=x"]]) {
    const run = runRoots(args)
    assert.equal(run.status, 2, `${args.join(" ")} must be refused`)
  }
})
