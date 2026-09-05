import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { pathToFileURL } from "node:url"
import { buildLaneScript } from "../../ops/local-ci/agent/runner.mjs"
import { buildWorkspacePreparationScript } from "../../ops/local-ci/agent/main.mjs"

function command(cmd, args, cwd) {
  const result = spawnSync(cmd, args, { cwd, encoding: "utf8" })
  assert.equal(result.status, 0, result.stderr)
  return result.stdout.trim()
}

test("job checkout survives relocation and cannot modify mirror objects through hardlinks", () => {
  const root = mkdtempSync(join(tmpdir(), "local ci checkout-"))
  try {
    const upstream = join(root, "upstream")
    command("git", ["init", "--initial-branch=main", upstream])
    writeFileSync(join(upstream, "tracked.txt"), "reviewed\n")
    command("git", ["add", "tracked.txt"], upstream)
    command(
      "git",
      [
        "-c",
        "user.name=Fixture",
        "-c",
        "user.email=fixture@example.test",
        "commit",
        "-m",
        "fixture",
      ],
      upstream
    )
    command("git", ["checkout", "-b", "qualification"], upstream)
    writeFileSync(join(upstream, "feature.txt"), "new branch\n")
    command("git", ["add", "feature.txt"], upstream)
    command(
      "git",
      [
        "-c",
        "user.name=Fixture",
        "-c",
        "user.email=fixture@example.test",
        "commit",
        "-m",
        "new branch",
      ],
      upstream
    )
    const sha = command("git", ["rev-parse", "HEAD"], upstream)
    const vmRoot = join(root, "vm")
    command("git", [
      "clone",
      "--depth=1",
      "--single-branch",
      "--branch=main",
      pathToFileURL(upstream).href,
      join(vmRoot, "repo"),
    ])
    const script = buildWorkspacePreparationScript({
      root: vmRoot,
      remoteUrl: upstream,
      headSha: sha,
    })
    command("bash", ["-c", script])
    const workspace = join(vmRoot, "runs", sha)
    assert.ok(statSync(join(workspace, ".git")).isDirectory())
    assert.equal(
      command("git", ["rev-parse", "--is-shallow-repository"], workspace),
      "false"
    )
    assert.equal(
      readFileSync(join(workspace, "feature.txt"), "utf8"),
      "new branch\n"
    )
    assert.equal(
      existsSync(join(workspace, ".git/objects/info/alternates")),
      false
    )
    const object = `objects/${sha.slice(0, 2)}/${sha.slice(2)}`
    assert.notEqual(
      statSync(join(workspace, ".git", object)).ino,
      statSync(join(vmRoot, "repo/.git", object)).ino
    )
    const relocated = join(root, "workspace")
    renameSync(workspace, relocated)
    assert.equal(command("git", ["status", "--porcelain"], relocated), "")
    writeFileSync(join(relocated, "tracked.txt"), "modified\n")
    const diff = spawnSync("git", ["diff", "--exit-code"], { cwd: relocated })
    assert.equal(diff.status, 1)
    command("bash", ["-c", script])
    assert.equal(
      readFileSync(join(workspace, "tracked.txt"), "utf8"),
      "reviewed\n"
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("nightly scheduler keeps a quiet Node process alive between ticks", () => {
  const moduleUrl = new URL(
    "../../ops/local-ci/agent/main.mjs",
    import.meta.url
  ).href
  const result = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `
    import { createNightlyScheduler } from ${JSON.stringify(moduleUrl)};
    let ticks = 0;
    const scheduler = createNightlyScheduler({ intervalMs: 20, tick: async () => {
      ticks += 1;
      if (ticks === 2) scheduler.stop();
      return { ran: false };
    }});
    await scheduler.start();
    console.log(ticks);
  `,
    ],
    { encoding: "utf8", timeout: 5000 }
  )
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stdout.trim(), "2")
})

test("poll loop keeps a quiet Node process alive between ticks", () => {
  const moduleUrl = new URL(
    "../../ops/local-ci/agent/loop.mjs",
    import.meta.url
  ).href
  const result = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `
    import { createLoop } from ${JSON.stringify(moduleUrl)};
    let ticks = 0;
    const loop = { ...createLoop({ contract: { agent: { pollIntervalSeconds: 1, maxConcurrentJobs: 1, queueDepthLimit: 8 } }, github: {}, runner: {}, loadProfile: () => ({}) }) };
    loop.tick = async () => {
      ticks += 1;
      if (ticks === 2) loop.stop();
      return { outcome: "idle" };
    };
    await loop.start();
    console.log(ticks);
  `,
    ],
    { encoding: "utf8", timeout: 5000 }
  )
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stdout.trim(), "2")
})

test("snapshot guard fails when Git inspection cannot run", () => {
  const root = mkdtempSync(join(tmpdir(), "local-ci-guard-"))
  try {
    const script = buildLaneScript(
      { id: "fixture", commands: ["true"] },
      {
        container: { workspacePath: root },
        snapshotGuard: {
          enabled: true,
          mutationCheck: { command: "git status --porcelain" },
        },
      }
    )
    const result = spawnSync("bash", ["-c", script], { encoding: "utf8" })
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /not a git repository/)
    assert.doesNotMatch(result.stdout, /lane fixture completed/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
