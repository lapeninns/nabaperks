import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { createHash, randomUUID } from "node:crypto"
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  statSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname } from "node:path"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import { git, FULL_SHA } from "./impact-git.mjs"
import { runDocumentation } from "./documentation-checks.mjs"
import { DOCUMENTATION_CASES } from "./documentation-evidence-contract.mjs"

const REVIEWED_ROOT = fileURLToPath(new URL("../../", import.meta.url))
const require = createRequire(import.meta.url)
const PRETTIER = join(dirname(require.resolve("prettier")), "bin/prettier.cjs")
const FIXTURE_DIRECTORY = "docs/operations/.ci-verifier-cases"

function extractCandidate(candidateSha, root, cwd) {
  assert.match(candidateSha, FULL_SHA)
  for (const entry of git(["ls-tree", "-r", "-z", candidateSha], { cwd })
    .split("\0")
    .filter(Boolean)) {
    const match = /^(?:100644|100755) blob [a-f0-9]{40}\t(.+)$/.exec(entry)
    assert.ok(
      match &&
        !match[1].startsWith("/") &&
        !/[\\\x00-\x1f\x7f]/.test(match[1]) &&
        !match[1].split("/").some((part) => ["", ".", ".."].includes(part)),
      "Candidate content must contain regular tracked files"
    )
    assert.ok(
      !match[1].startsWith(FIXTURE_DIRECTORY),
      "Candidate uses the reserved fixture directory"
    )
  }
  const archive = join(root, "candidate.tar"),
    content = join(root, "content")
  mkdirSync(content)
  git(
    [
      "archive",
      "--format=tar",
      `--output=${archive}`,
      `${candidateSha}^{tree}`,
    ],
    { cwd }
  )
  const result = spawnSync("tar", ["-xf", archive, "-C", content], {
    encoding: "utf8",
    timeout: 30_000,
  })
  assert.ok(
    !result.error && !result.signal && result.status === 0,
    "Candidate content extraction failed"
  )
  return content
}

function check(paths, cwd) {
  assert.ok(
    paths.length > 0 && paths.length <= 200,
    "Documentation input count exceeds its bound"
  )
  let bytes = 0
  for (const path of paths) {
    const size = statSync(join(cwd, path)).size
    assert.ok(size <= 1024 * 1024, "Documentation file exceeds its size bound")
    bytes += size
  }
  assert.ok(
    bytes <= 8 * 1024 * 1024,
    "Documentation input exceeds its total size bound"
  )
  const started = Date.now(),
    output = []
  let passed = true
  try {
    runDocumentation(
      {
        profile: "public-pages",
        required: ["documentation"],
        changes: paths.map((path) => ({ path, status: "M" })),
      },
      {
        cwd,
        spawn(command, args) {
          assert.equal(command, "pnpm")
          assert.deepEqual(args.slice(0, 4), [
            "exec",
            "prettier",
            "--check",
            "--",
          ])
          // Resolve the formatter, configuration and plugins from reviewed code.
          // Candidate package managers, configs, modules and hooks never execute.
          const result = spawnSync(
            process.execPath,
            [
              "--max-old-space-size=512",
              PRETTIER,
              "--config",
              join(REVIEWED_ROOT, ".prettierrc"),
              "--ignore-path",
              "/dev/null",
              "--no-editorconfig",
              "--with-node-modules",
              "--check",
              "--",
              ...args.slice(4).map((path) => join(cwd, path)),
            ],
            {
              cwd: REVIEWED_ROOT,
              encoding: "utf8",
              timeout: 60_000,
              maxBuffer: 1024 * 1024,
            }
          )
          assert.ok(
            !result.error && !result.signal && [0, 1].includes(result.status),
            "Reviewed formatter could not complete"
          )
          output.push(result.stdout, result.stderr)
          return result
        },
      }
    )
  } catch (error) {
    if (
      !/Documentation check failed:|Documentation has missing local link targets|Documentation links escape/.test(
        error.message
      )
    )
      throw error
    passed = false
    output.push(error.message)
  }
  return {
    passed,
    durationMs: Date.now() - started,
    outputDigest: createHash("sha256").update(output.join("\n")).digest("hex"),
  }
}

export function qualifyReviewedDocumentation(
  candidateSha,
  files,
  { cwd = process.cwd() } = {}
) {
  const root = mkdtempSync(join(tmpdir(), "nabaperks-reviewed-docs-"))
  try {
    const content = extractCandidate(candidateSha, root, cwd)
    const fixtures = join(content, FIXTURE_DIRECTORY)
    mkdirSync(fixtures, { recursive: true })
    writeFileSync(join(fixtures, "target.md"), "# Target\n")
    const cases = DOCUMENTATION_CASES.map((fixture) => {
      const path = `${FIXTURE_DIRECTORY}/${randomUUID()}.md`
      writeFileSync(join(content, path), fixture.text)
      const observed = check([path], content)
      assert.equal(
        observed.passed,
        fixture.passes,
        `Reviewed documentation case failed: ${fixture.id}`
      )
      return { id: fixture.id, ...observed }
    })
    const changedFiles = files.length
      ? check(
          files.map(({ path }) => path),
          content
        )
      : null
    if (changedFiles)
      assert.equal(
        changedFiles.passed,
        true,
        "Candidate documentation failed reviewed validation"
      )
    return {
      schema: "nabaperks.reviewed-documentation.v1",
      candidateSha,
      verifierSha: git(["rev-parse", "HEAD"], { cwd: REVIEWED_ROOT }).trim(),
      verifierWorkingTreeClean:
        git(["status", "--porcelain"], { cwd: REVIEWED_ROOT }).trim() === "",
      runner: "reviewed-checker-and-formatter",
      cases,
      changedFiles,
    }
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}
