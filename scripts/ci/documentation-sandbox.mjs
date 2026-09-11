import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { randomUUID, createHash } from "node:crypto"
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  copyFileSync,
  chmodSync,
  rmSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { git, readAt, FULL_SHA } from "./impact-git.mjs"
import { DOCUMENTATION_CASES } from "./documentation-evidence-contract.mjs"

// Immutable linux/amd64 manifest for the official Node 24 Bookworm slim image.
const NODE_IMAGE =
  "node:24-bookworm-slim@sha256:713cfbf4a0ac19f40e1bb9919893e126b74a5c8cf5d0623c9f89515c8f74c6fa"
const PLATFORM = "linux/amd64"
const CHECKOUT_ROOT = fileURLToPath(new URL("../../", import.meta.url))
const FIXTURE_DIRECTORY = "docs/operations/.ci-verifier-cases"

function command(args, { timeout = 60_000, input } = {}) {
  return spawnSync("docker", args, {
    encoding: "utf8",
    input,
    timeout,
    maxBuffer: 16 * 1024 * 1024,
    // No host environment or credentials are forwarded into the container.
    // The Docker client retains its normal local daemon connection settings.
    env: process.env,
  })
}

function successful(result, purpose) {
  assert.ok(
    !result.error && !result.signal && result.status === 0,
    `${purpose} failed: ${(result.stderr ?? result.stdout ?? "").slice(-4000)}`
  )
}

function prepareContext(candidateSha, context, options) {
  assert.match(candidateSha, FULL_SHA)
  for (const entry of git(["ls-tree", "-r", "-z", candidateSha], options)
    .split("\0")
    .filter(Boolean)) {
    const match = /^(?:100644|100755) blob [a-f0-9]{40}\t(.+)$/.exec(entry)
    assert.ok(
      match &&
        !match[1].startsWith("/") &&
        !/[\\\x00-\x1f\x7f]/.test(match[1]) &&
        !match[1].split("/").some((part) => ["", ".", ".."].includes(part)),
      "Documentation sandbox requires regular tracked files"
    )
    assert.ok(
      !match[1].startsWith(FIXTURE_DIRECTORY),
      "Candidate uses the reserved qualification directory"
    )
  }
  assert.equal(
    readAt(candidateSha, ".nvmrc", options).trim(),
    "24",
    "Documentation sandbox needs a reviewed image for this Node major"
  )
  const archive = join(context, "..", "candidate.tar")
  // A tree archive has no commit substitutions. All entries were checked for
  // symlinks, submodules and unsafe paths before extracting anything on host.
  git(
    [
      "archive",
      "--format=tar",
      `--output=${archive}`,
      `${candidateSha}^{tree}`,
    ],
    options
  )
  const unpacked = spawnSync("tar", ["-xf", archive, "-C", context], {
    encoding: "utf8",
    timeout: 30_000,
    maxBuffer: 1024 * 1024,
  })
  successful(unpacked, "Candidate archive extraction")
  // The package manager is literal candidate data. Its installation and all
  // candidate dependency work occur inside the image, without host mounts.
  const manager = JSON.parse(
    readAt(candidateSha, "package.json", options)
  ).packageManager
  const match = /^pnpm@(\d+\.\d+\.\d+)(?:\+sha\d+\.[a-f0-9]+)?$/.exec(manager)
  assert.ok(match, "Candidate package-manager version is missing")
  writeFileSync(join(context, ".dockerignore"), ".git\nnode_modules\n")
  writeFileSync(
    join(context, "Dockerfile.ci-documentation"),
    [
      `FROM ${NODE_IMAGE}`,
      `RUN npm install --global pnpm@${match[1]}`,
      "WORKDIR /candidate",
      "RUN chown node:node /candidate",
      "COPY --chown=node:node . .",
      "USER node",
      "RUN pnpm install --frozen-lockfile --ignore-scripts --ignore-pnpmfile",
      `RUN mkdir -p /candidate/${FIXTURE_DIRECTORY}`,
    ].join("\n") + "\n"
  )
}

function runCase(image, harness, fixtures, paths) {
  const name = `nabaperks-doc-case-${randomUUID()}`
  const started = Date.now()
  let result
  try {
    result = command([
      "run",
      "--rm",
      "--name",
      name,
      "--platform",
      PLATFORM,
      "--read-only",
      "--network",
      "none",
      "--cap-drop",
      "ALL",
      "--security-opt",
      "no-new-privileges",
      "--user",
      "1000:1000",
      "--pids-limit",
      "64",
      "--memory",
      "1g",
      "--cpus",
      "1",
      "--tmpfs",
      "/tmp:rw,nosuid,nodev,size=128m,mode=1777",
      "--mount",
      `type=bind,source=${harness},target=/harness,readonly`,
      "--mount",
      `type=bind,source=${fixtures},target=/candidate/${FIXTURE_DIRECTORY},readonly`,
      "--env",
      "CI=1",
      "--env",
      "NO_COLOR=1",
      image,
      "/usr/local/bin/node",
      "/harness/invoke.mjs",
      JSON.stringify(paths),
    ])
  } finally {
    // A timed-out Docker client does not necessarily stop its container.
    // Remove only this invocation's random, owned container before continuing.
    command(["rm", "--force", name], { timeout: 15_000 })
    const remaining = command(
      [
        "container",
        "ls",
        "--all",
        "--filter",
        `name=^/${name}$`,
        "--format",
        "{{.ID}}",
      ],
      { timeout: 15_000 }
    )
    successful(remaining, "Documentation container cleanup verification")
    assert.equal(
      remaining.stdout.trim(),
      "",
      "Documentation container survived cleanup"
    )
  }
  assert.ok(
    !result.error && !result.signal && Number.isInteger(result.status),
    "Documentation sandbox timed out or lost its execution result"
  )
  // 125-127 are Docker setup/command failures, not checker outcomes.
  assert.ok(
    result.status < 125,
    "Documentation sandbox could not execute the checker"
  )
  return {
    exitCode: result.status,
    durationMs: Date.now() - started,
    outputDigest: createHash("sha256")
      .update(result.stdout ?? "")
      .update(result.stderr ?? "")
      .digest("hex"),
  }
}

export function qualifyDocumentationInSandbox(
  candidateSha,
  files,
  { cwd = process.cwd() } = {}
) {
  const verifierSha = git(["rev-parse", "HEAD"], { cwd: CHECKOUT_ROOT }).trim()
  const verifierWorkingTreeClean =
    git(["status", "--porcelain"], { cwd: CHECKOUT_ROOT }).trim() === ""
  const root = mkdtempSync(join(tmpdir(), "nabaperks-reviewed-docs-"))
  const context = join(root, "context"),
    harness = join(root, "harness"),
    fixtures = join(root, "fixtures")
  const image = `nabaperks-docs-qualification:${randomUUID()}`
  for (const path of [root, context, harness, fixtures]) {
    mkdirSync(path, { recursive: true })
    chmodSync(path, 0o755)
  }
  try {
    prepareContext(candidateSha, context, { cwd, verifierSha })
    copyFileSync(
      new URL("./documentation-sandbox-invoke.mjs", import.meta.url),
      join(harness, "invoke.mjs")
    )
    chmodSync(join(harness, "invoke.mjs"), 0o644)
    writeFileSync(join(fixtures, "target.md"), "# Target\n")
    chmodSync(join(fixtures, "target.md"), 0o644)
    successful(
      command(
        [
          "build",
          "--platform",
          PLATFORM,
          "--tag",
          image,
          "--file",
          join(context, "Dockerfile.ci-documentation"),
          context,
        ],
        { timeout: 8 * 60_000 }
      ),
      "Candidate dependency sandbox build"
    )
    const cases = DOCUMENTATION_CASES.map((fixture) => {
      // Keep expected answers and case IDs outside the candidate container.
      const file = `${randomUUID()}.md`
      writeFileSync(join(fixtures, file), fixture.text)
      chmodSync(join(fixtures, file), 0o644)
      const observed = runCase(image, harness, fixtures, [
        `${FIXTURE_DIRECTORY}/${file}`,
      ])
      assert.equal(
        observed.exitCode === 0,
        fixture.passes,
        `Independent documentation case failed: ${fixture.id}`
      )
      return { id: fixture.id, ...observed }
    })
    const changedFiles = files.length
      ? runCase(
          image,
          harness,
          fixtures,
          files.map(({ path }) => path)
        )
      : null
    if (changedFiles)
      assert.equal(
        changedFiles.exitCode,
        0,
        "Candidate documentation files failed independent validation"
      )
    return {
      schema: "nabaperks.independent-documentation.v1",
      candidateSha,
      verifierSha,
      verifierWorkingTreeClean,
      nodeImage: NODE_IMAGE,
      platform: PLATFORM,
      cases,
      changedFiles,
    }
  } finally {
    command(["image", "rm", "--force", image], { timeout: 30_000 })
    rmSync(root, { recursive: true, force: true })
  }
}
