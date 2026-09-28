import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
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
 * The admission and db-setup tests run the script for real against stub
 * `docker`, `supabase` and `pnpm` commands in a temporary cache directory;
 * they clone this repository but never reach Docker or Supabase.
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

test("root containers install from the pnpm store volume they are given", () => {
  // /work is a bind mount of the clone, so without an explicit store pnpm
  // writes a store into the clone, the next reset deletes it and every slot
  // downloads the whole dependency tree again; the store volume stays empty.
  const run = runRoots(["fast", "--jobs", "2"])
  assert.equal(run.status, 0, run.stderr)
  const mounts = /^ {2}mounts: (.*)$/m.exec(run.stdout)?.[1] ?? ""
  const storeMount = /-v \S+-pnpm-store:(\S+)/.exec(mounts)?.[1]
  assert.ok(storeMount, "run-roots.sh must mount a pnpm store volume")
  const container = readFileSync(
    join(REPO_ROOT, "ops/local-ci/roots/container-roots.sh"),
    "utf8"
  )
  const install = /^pnpm install .*$/m.exec(container)?.[0] ?? ""
  assert.equal(
    /--store-dir (\S+)/.exec(install)?.[1],
    storeMount,
    "pnpm install must use the mounted store volume"
  )
})

test("--jobs N splits visual into the hosted project shards", () => {
  const run = runRoots(["visual", "--jobs", "2"])
  assert.equal(run.status, 0, run.stderr)
  const tasks = [
    ...run.stdout.matchAll(/^ {2}task (visual\S*) cpus=\d+ memory=(\d+)g /gm),
  ]
  const expected = []
  for (const project of matrix("visual", "project"))
    for (const shard of matrix("visual", "shard"))
      expected.push(`visual-${project}-${shard.split("/")[0]}`)
  assert.deepEqual(tasks.map(([, name]) => name).sort(), expected.sort())
  for (const [, name, memory] of tasks)
    assert.equal(Number(memory), 8, `${name} must keep the 8 GiB cap`)
})

test("every visual run inside a container is one project shard", () => {
  // Unsharded Playwright against one dev server runs out of heap, so the
  // whole visual root (--jobs 1) must also walk the shards one at a time.
  const container = readFileSync(
    join(REPO_ROOT, "ops/local-ci/roots/container-roots.sh"),
    "utf8"
  )
  const invocations = container.match(/^.*test:visual.*$/gm) ?? []
  assert.equal(invocations.length, 1, "one visual invocation, per shard")
  assert.match(invocations[0], /--project="\$1" --shard="\$2"/)
  const whole = /^ {4}visual\) (.*)$/m.exec(container)?.[1] ?? ""
  assert.match(whole, /for project in chromium mobile-safari/)
  assert.match(whole, /for shard in 1 2 3 4; do visual_shard /)
})

// Runs the script for real in a temporary cache with stub commands first on
// PATH; returns the run and a reader for files the stubs wrote.
function runWithStubs(args, stubs, env = {}) {
  const dir = mkdtempSync(join(tmpdir(), "run-roots-stub-"))
  const bin = join(dir, "bin")
  mkdirSync(bin)
  for (const [name, body] of Object.entries(stubs)) {
    writeFileSync(join(bin, name), `#!/usr/bin/env bash\n${body}\n`)
    chmodSync(join(bin, name), 0o755)
  }
  try {
    const run = spawnSync("bash", [SCRIPT, "HEAD", ...args], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        LOCAL_CI_WORK: join(dir, "work"),
        STUB_DIR: dir,
        ...env,
      },
    })
    const files = {}
    for (const name of ["supabase", "pnpm", "config.toml"])
      files[name] = existsSync(join(dir, name))
        ? readFileSync(join(dir, name), "utf8")
        : ""
    return { run, output: run.stdout + run.stderr, files }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

test("each admission re-measures what other containers use now", () => {
  // 20 GiB VM, 2 GiB reserve. Another project's container uses 2 GiB for
  // the first two measurements and 10 GiB afterwards; this run's own two
  // containers (7 GiB between them) must not count, since their caps are
  // already committed. Two ids, one per line, as `docker ps -q` prints them.
  const docker = `
case "$1" in
  info) echo 21474836480 ;;
  ps) case "$*" in *-aq*) ;; *) printf '0wn000000001\n0wn000000002\n' ;; esac ;;
  stats)
    n=$(( $(cat "$STUB_DIR/stats" 2>/dev/null || echo 0) + 1 )); echo "$n" >"$STUB_DIR/stats"
    other=2; [ "$n" -le 2 ] || other=10
    echo "0ther0000001 \${other}GiB / 20GiB"
    echo "0wn000000001 4GiB / 8GiB"; echo "0wn000000002 3GiB / 8GiB" ;;
  run)
    task="\${!#}"; [ "$task" != coverage ] || sleep 6
    echo "=== ROOT $task EXIT 0 00:00:00 0s"; echo "=== ALL DONE" ;;
esac`
  const { run, output } = runWithStubs(
    ["build", "coverage", "fast", "--jobs", "3"],
    { docker }
  )
  assert.equal(run.status, 0, output)
  const starts = Object.fromEntries(
    [
      ...output.matchAll(
        /^=== START (\S+) slot \d+ cpus=\d+ memory=(\d+)g running=(\d+) committed=(\d+)g admissible=(-?\d+)g /gm
      ),
    ].map(([, task, ...numbers]) => {
      const [memory, running, committed, admissible] = numbers.map(Number)
      return [task, { memory, running, committed, admissible }]
    })
  )
  assert.deepEqual(Object.keys(starts).sort(), ["build", "coverage", "fast"])
  for (const [task, start] of Object.entries(starts))
    assert.ok(
      start.running === 0 || start.committed + start.memory <= start.admissible,
      `${task} was admitted beyond the measured headroom`
    )
  assert.equal(starts.build.admissible, 16, "own containers must not count")
  assert.equal(starts.coverage.running, 1)
  // Sampled once, fast would start beside coverage (8 + 8 <= 16) as soon as
  // build finished; re-measured, it waits until only it fits the 8 GiB left.
  assert.equal(starts.fast.admissible, 8)
  assert.equal(starts.fast.running, 0)
})

test("a failed db setup fails the db root and skips seed and tests", () => {
  const stubs = {
    docker: `case "$1" in ps | stats | info) ;; *) exit 0 ;; esac`,
    pnpm: `echo "$*" >>"$STUB_DIR/pnpm"; [ "$1" != test:db ] || echo "# pass 1"`,
    supabase: `echo "$1" >>"$STUB_DIR/supabase"
cp "$3/supabase/config.toml" "$STUB_DIR/config.toml"
[ "$1" != start ] || exit "$STUB_START_RC"`,
  }
  for (const startRc of ["1", "0"]) {
    const { run, output, files } = runWithStubs(["db"], stubs, {
      SUPABASE_CLI: "supabase",
      STUB_START_RC: startRc,
    })
    // Any stack left under this project id is removed first; the
    // candidate's stack is started fresh and always stopped.
    assert.deepEqual(files.supabase.trim().split("\n"), [
      "stop",
      "start",
      "stop",
    ])
    assert.match(files["config.toml"], /^project_id = "nabaperks_local_ci"$/m)
    assert.match(files["config.toml"], /^port = 55722$/m)
    assert.doesNotMatch(files["config.toml"], /^[^#]*port = 543/m)
    if (startRc === "1") {
      assert.notEqual(run.status, 0, "a failed setup must fail the run")
      assert.match(output, /^=== ROOT db-setup EXIT 1 /m)
      assert.doesNotMatch(output, /=== ROOT db-(seed|test) /)
      assert.equal(files.pnpm, "", "seed and tests must not run")
    } else {
      assert.equal(run.status, 0, output)
      for (const root of ["db-setup", "db-seed", "db-test"])
        assert.match(output, new RegExp(`^=== ROOT ${root} EXIT 0 `, "m"))
      assert.deepEqual(files.pnpm.trim().split("\n"), ["db:seed", "test:db"])
    }
  }
})
