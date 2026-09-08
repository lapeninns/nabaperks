import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  existsSync,
  rmSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { buildWorkspacePreparationScript } from "../../ops/local-ci/agent/main.mjs"

test("repreparing an exact SHA discards interrupted adjacent lane checkouts", () => {
  const directory = mkdtempSync(join(tmpdir(), "ci-workspace-recovery-"))
  try {
    const remote = join(directory, "source"),
      root = join(directory, "runtime")
    mkdirSync(remote)
    const git = (args) =>
      execFileSync("git", args, {
        cwd: remote,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      })
    git(["init"])
    git([
      "-c",
      "user.name=Fixture",
      "-c",
      "user.email=fixture@example.invalid",
      "commit",
      "--allow-empty",
      "-m",
      "fixture",
    ])
    const sha = git(["rev-parse", "HEAD"]).trim()
    const stale = join(root, "runs", `${sha}-lanes`, "quality")
    mkdirSync(stale, { recursive: true })
    writeFileSync(join(stale, "old-output"), "stale")
    execFileSync(
      "sh",
      [
        "-c",
        buildWorkspacePreparationScript({
          root,
          remoteUrl: remote,
          headSha: sha,
        }),
      ],
      { stdio: "pipe", timeout: 15000 }
    )
    assert.equal(existsSync(stale), false)
    assert.equal(
      execFileSync(
        "git",
        ["-C", join(root, "runs", sha), "rev-parse", "HEAD"],
        { encoding: "utf8" }
      ).trim(),
      sha
    )
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
