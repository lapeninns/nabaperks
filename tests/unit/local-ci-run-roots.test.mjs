import assert from "node:assert/strict"
import { spawn, spawnSync } from "node:child_process"
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
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
 * The scheduler, admission, host and db tests run the script for real
 * against stub `docker`, `supabase` and `pnpm` commands in a temporary cache
 * directory; they clone this repository but never reach Docker or Supabase.
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

// A temporary directory holding the stub commands (first on PATH) and
// whatever they record; the cache directory lives inside it too.
function stubSandbox(stubs, env) {
  const dir = mkdtempSync(join(tmpdir(), "run-roots-stub-"))
  const bin = join(dir, "bin")
  mkdirSync(bin)
  for (const [name, body] of Object.entries(stubs)) {
    writeFileSync(join(bin, name), `#!/usr/bin/env bash\n${body}\n`)
    chmodSync(join(bin, name), 0o755)
  }
  const options = {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      LOCAL_CI_WORK: join(dir, "work"),
      STUB_DIR: dir,
      ...env,
    },
  }
  // Every file a stub wrote at the top level, by name.
  const files = () => {
    const found = {}
    for (const name of readdirSync(dir))
      if (statSync(join(dir, name)).isFile())
        found[name] = readFileSync(join(dir, name), "utf8")
    return new Proxy(found, { get: (target, key) => target[key] ?? "" })
  }
  return { dir, options, files }
}

// Runs the script for real in a stub sandbox; returns the run, its output
// and the files the stubs wrote.
function runWithStubs(args, stubs, env = {}) {
  const { dir, options, files } = stubSandbox(stubs, env)
  try {
    const run = spawnSync("bash", [SCRIPT, "HEAD", ...args], {
      ...options,
      encoding: "utf8",
    })
    return { run, output: run.stdout + run.stderr, files: files() }
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

// Docker for the scheduler tests: 100 GiB and nothing else running. A
// container is a file under live/ holding its process id until it exits or
// `docker rm -f` kills it; `ps` with this run's label lists the live ones.
// Each run records its caller (the slot subshell) in slots, and `rm` notes
// any slot still alive when it is called. Tasks named in
// STUB_HANG never finish; the others end as their case says.
const SCHEDULER_DOCKER = `
case "$1" in
  info) echo 107374182400 ;;
  ps) case "$*" in *nabaperks.local-ci.run=*) ls "$STUB_DIR/live" 2>/dev/null ;; esac ;;
  rm) shift; [ "$1" != -f ] || shift
    for pid in $(cat "$STUB_DIR/slots"); do
      ! kill -0 "$pid" 2>/dev/null || echo "$pid" >>"$STUB_DIR/slots-alive-at-rm"
    done
    for id in "$@"; do
      echo "$id" >>"$STUB_DIR/removed"
      kill "$(cat "$STUB_DIR/live/$id")" 2>/dev/null; rm -f "$STUB_DIR/live/$id"
    done ;;
  run)
    name=; prev=; for arg in "$@"; do [ "$prev" != --name ] || name="$arg"; prev="$arg"; done
    task="\${!#}"; mkdir -p "$STUB_DIR/live"
    echo "$PPID" >>"$STUB_DIR/slots"; echo "$$" >"$STUB_DIR/live/$name"
    case " $STUB_HANG " in *" $task "*) exec sleep 60 ;; esac
    rm -f "$STUB_DIR/live/$name"
    case "$task" in
      coverage) echo "=== ROOT coverage EXIT 3 00:00:00 1s"; echo "=== ALL DONE" ;;
      quality) exit 137 ;;
      build) echo "=== ROOT build EXIT 0 00:00:00 1s" ;;
      *) echo "=== ROOT $task EXIT 0 00:00:00 1s"; echo "=== ALL DONE" ;;
    esac ;;
esac`

function isAlive(pid) {
  try {
    process.kill(Number(pid), 0)
    return true
  } catch {
    return false
  }
}

test("concurrent tasks record their own exit codes and fail the run", () => {
  // Two slots for four tasks, so slots are reused. coverage's root fails in
  // a clean container, quality's container dies (137) before printing any
  // root, and build's root passes but its container never finishes.
  const { run, output } = runWithStubs(
    ["fast", "coverage", "quality", "build", "--jobs", "2"],
    { docker: SCHEDULER_DOCKER }
  )
  assert.equal(run.status, 1, output)
  const summary = output.slice(output.indexOf("=== SUMMARY"))
  assert.match(summary, /failed=3/)
  const rows = Object.fromEntries(
    [...summary.matchAll(/^(\S+) +(\S+) +\S+ +\S+$/gm)]
      .filter(([, name]) => name !== "root")
      .map(([, name, exit]) => [name, exit])
  )
  assert.deepEqual(rows, {
    fast: "0",
    coverage: "3",
    "quality(container)": "137",
    build: "0",
    "build(container)": "1",
  })
  for (const task of ["coverage", "quality", "build"])
    assert.match(output, new RegExp(`^--- ${task} failed `, "m"))
  assert.doesNotMatch(output, /^--- fast failed /m)
})

test("SIGTERM stops only this run's live slots and containers", async () => {
  const { dir, options, files } = stubSandbox(
    { docker: SCHEDULER_DOCKER },
    { STUB_HANG: "coverage build" }
  )
  const live = () => {
    try {
      return readdirSync(join(dir, "live"))
    } catch {
      return []
    }
  }
  try {
    const child = spawn(
      "bash",
      [SCRIPT, "HEAD", "fast", "coverage", "build", "--jobs", "3"],
      options
    )
    let output = ""
    child.stdout.on("data", (chunk) => (output += chunk))
    child.stderr.on("data", (chunk) => (output += chunk))
    const status = await new Promise((resolve, reject) => {
      const deadline = setTimeout(() => {
        child.kill("SIGKILL")
        reject(new Error(`run-roots.sh did not stop:\n${output}`))
      }, 60_000)
      // Interrupt once fast has finished and been reaped while coverage and
      // build are still running.
      const poll = setInterval(() => {
        if (/^=== ROOT fast EXIT 0 /m.test(output) && live().length === 2) {
          clearInterval(poll)
          child.kill("SIGTERM")
        }
      }, 100)
      child.on("close", (code) => {
        clearInterval(poll)
        clearTimeout(deadline)
        resolve(code)
      })
    })
    assert.equal(status, 130, output)
    const removed = files().removed.trim().split("\n").sort()
    assert.equal(removed.length, 2, output)
    assert.match(removed[0], /^nabaperks-roots-\d+-\d+-build$/)
    assert.match(removed[1], /^nabaperks-roots-\d+-\d+-coverage$/)
    assert.deepEqual(live(), [], "every container of the run is removed")
    // The live slots were stopped before their containers were removed.
    assert.equal(files()["slots-alive-at-rm"], "", output)
    const slots = files().slots.trim().split("\n")
    assert.equal(slots.length, 3)
    for (const pid of slots)
      assert.equal(isAlive(pid), false, `slot ${pid} outlived the run`)
  } finally {
    for (const name of live())
      try {
        process.kill(Number(readFileSync(join(dir, "live", name), "utf8")))
      } catch {
        // already gone
      }
    rmSync(dir, { recursive: true, force: true })
  }
})

test("a failed host build skips lighthouse and zap and fails them", () => {
  const { run, output, files } = runWithStubs(["lighthouse", "zap"], {
    docker: `echo "$1" >>"$STUB_DIR/docker"`,
    pnpm: `echo "$1" >>"$STUB_DIR/pnpm"; [ "$1" != build ] || exit 4`,
  })
  assert.notEqual(run.status, 0, output)
  for (const root of ["build-host", "lighthouse", "zap"])
    assert.match(output, new RegExp(`^=== ROOT ${root} EXIT 4 `, "m"))
  assert.deepEqual(files.pnpm.trim().split("\n"), ["build"])
  assert.doesNotMatch(files.docker, /^run$/m, "no ZAP container may start")
})
