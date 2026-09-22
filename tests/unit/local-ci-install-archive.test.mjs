import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import {
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

const INSTALLER = readFileSync("ops/local-ci/host/install.sh", "utf8")

/**
 * The release-install block of install.sh, under regression coverage.
 *
 * The old `git archive | tar -x` pipeline extracts valid bytes but never
 * returns cleanly on macOS: bsdtar stops reading at the end-of-archive
 * marker, git then writes onto a closed pipe and exits 141 (SIGPIPE), and
 * `set -euo pipefail` aborts a valid install before release activation or
 * LaunchAgent registration. These tests pin the replacement: the verified
 * archive is materialised to a temporary file, the materialisation and the
 * separate extraction are both checked, and any failure refuses before the
 * release directory, the `current` symlink or launchd are touched.
 */

/** One command line out of install.sh, exactly as the script spells it. */
const commandFromInstaller = (pattern, requirement) => {
  const match = INSTALLER.match(pattern)
  assert.ok(match, requirement)
  return match[0]
}

const exportCommand = commandFromInstaller(
  /git -C "\$\{repo_root\}" archive --format=tar --output="\$\{release_archive\}" "\$\{release_sha\}"/,
  "install.sh must materialise the release archive with git archive --output instead of piping into tar"
)
const archiveIsMaterialised = commandFromInstaller(
  /\[ -s "\$\{release_archive\}" \]/,
  "install.sh must refuse an empty exported archive before extracting it"
)
const extractCommand = commandFromInstaller(
  /tar -x -f "\$\{release_archive\}" -C "\$\{staging\}"/,
  "install.sh must extract the materialised archive in a separate command"
)

const posixQuote = (value) => `'${String(value).replace(/'/g, "'\\''")}'`

/**
 * A fixture repository with one commit, deliberately larger than a pipe
 * buffer. The size is what made the old pipeline fail: git blocks on its
 * write while bsdtar is still free to stop reading, so a regression back to
 * a piped export would SIGPIPE here too, not merely trip the pins below.
 */
const makeFixtureRepo = (root) => {
  const repo = join(root, "fixture-repo")
  mkdirSync(join(repo, "ops/local-ci/agent"), { recursive: true })
  const git = (args) =>
    execFileSync("git", args, {
      cwd: repo,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    })
  git(["init", "--quiet"])
  writeFileSync(join(repo, "ops/local-ci/agent/main.mjs"), "// agent fixture\n")
  writeFileSync(
    join(repo, "payload.bin"),
    Buffer.alloc(256 * 1024, "nabaperks archive fixture\n")
  )
  git(["add", "ops/local-ci/agent/main.mjs", "payload.bin"])
  git([
    "-c",
    "user.name=Fixture",
    "-c",
    "user.email=fixture@example.invalid",
    "commit",
    "--quiet",
    "-m",
    "fixture",
  ])
  return { repo, sha: git(["rev-parse", "HEAD"]).trim() }
}

/**
 * The archive block of install.sh as a standalone script: the variables its
 * commands reference are provided, `set -euo pipefail` models the
 * installer's own shell, and the marker at the end stands for the release
 * activation steps the block guards - on any refusal the sequence must abort
 * before the marker is printed.
 */
const runArchiveBlock = ({
  repoRoot,
  revision,
  releaseArchive,
  staging,
  prepareArchive,
}) => {
  const script = [
    "set -euo pipefail",
    `repo_root=${posixQuote(repoRoot)}`,
    `staging=${posixQuote(staging)}`,
    `release_archive=${posixQuote(releaseArchive)}`,
    `release_sha=${posixQuote(revision)}`,
    'mkdir -p "${staging}"',
    prepareArchive ?? exportCommand,
    archiveIsMaterialised,
    extractCommand,
    "echo activation-started",
  ].join("\n")
  return spawnSync("bash", ["-c", script], { encoding: "utf8" })
}

test("the release archive never reaches tar through a pipe", () => {
  // The SIGPIPE came from the reader (bsdtar) outliving the writer, so the
  // fix is that there is no reader: no pipe between git and tar anywhere.
  assert.doesNotMatch(INSTALLER, /git -C "\$\{repo_root\}" archive[^\n]*\|/)
  assert.doesNotMatch(INSTALLER, /tar -x -C "\$\{staging\}"/)
  // The installer keeps running under pipefail: the repair must not work by
  // weakening the shell it runs in.
  assert.match(INSTALLER, /^set -euo pipefail$/m)
  // The archive is materialised beside the scratch staging tree, never
  // inside it: `${scratch}/release.tar` is not under `${scratch}/release`.
  assert.match(INSTALLER, /^ {2}staging="\$\{scratch\}\/release"$/m)
  assert.match(
    INSTALLER,
    /^ {2}release_archive="\$\{scratch\}\/release\.tar"$/m
  )
})

test("a verified revision materialises and extracts under pipefail without a SIGPIPE abort", () => {
  const root = mkdtempSync(join(tmpdir(), "local-ci-archive-"))
  try {
    const { repo, sha } = makeFixtureRepo(root)
    const scratch = join(root, "scratch")
    mkdirSync(scratch)
    const staging = join(scratch, "release")
    const releaseArchive = join(scratch, "release.tar")

    const result = runArchiveBlock({
      repoRoot: repo,
      revision: sha,
      releaseArchive,
      staging,
    })

    assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`)
    assert.match(result.stdout, /activation-started/)
    assert.ok(
      existsSync(releaseArchive),
      "the archive must be materialised first"
    )
    assert.ok(
      statSync(releaseArchive).size > 64 * 1024,
      "the fixture archive must exceed a pipe buffer so a piped regression would fail here too"
    )
    assert.ok(
      existsSync(join(staging, "ops/local-ci/agent/main.mjs")),
      "the tracked agent entrypoint must be extracted into the staging tree"
    )
    assert.equal(
      readFileSync(join(staging, "ops/local-ci/agent/main.mjs"), "utf8"),
      "// agent fixture\n"
    )
    assert.ok(
      !existsSync(join(staging, "release.tar")),
      "the archive file must not be extracted into the release tree"
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("a revision git cannot export is a refusal before anything is staged", () => {
  const root = mkdtempSync(join(tmpdir(), "local-ci-archive-"))
  try {
    const { repo } = makeFixtureRepo(root)
    const scratch = join(root, "scratch")
    mkdirSync(scratch)
    const staging = join(scratch, "release")

    const result = runArchiveBlock({
      repoRoot: repo,
      revision: "0".repeat(40),
      releaseArchive: join(scratch, "release.tar"),
      staging,
    })

    assert.notEqual(result.status, 0)
    assert.doesNotMatch(result.stdout, /activation-started/)
    assert.deepEqual(readdirSync(staging), [])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("an empty exported archive is refused even though bsdtar would accept it", () => {
  // bsdtar reads a zero-byte input as an empty archive and exits 0, so the
  // non-empty check is what keeps a truncated export from becoming an empty
  // release. GNU tar refuses on its own, but the installer cannot rely on
  // which tar it gets.
  const root = mkdtempSync(join(tmpdir(), "local-ci-archive-"))
  try {
    const { repo, sha } = makeFixtureRepo(root)
    const scratch = join(root, "scratch")
    mkdirSync(scratch)
    const staging = join(scratch, "release")
    const releaseArchive = join(scratch, "release.tar")

    const result = runArchiveBlock({
      repoRoot: repo,
      revision: sha,
      releaseArchive,
      staging,
      prepareArchive: ': > "${release_archive}"',
    })

    assert.notEqual(result.status, 0)
    assert.doesNotMatch(result.stdout, /activation-started/)
    assert.deepEqual(readdirSync(staging), [])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("a corrupt exported archive never reaches activation", () => {
  const root = mkdtempSync(join(tmpdir(), "local-ci-archive-"))
  try {
    const { repo, sha } = makeFixtureRepo(root)
    const scratch = join(root, "scratch")
    mkdirSync(scratch)
    const staging = join(scratch, "release")
    const releaseArchive = join(scratch, "release.tar")

    const result = runArchiveBlock({
      repoRoot: repo,
      revision: sha,
      releaseArchive,
      staging,
      prepareArchive:
        "printf '%s' 'not a tar archive' > \"${release_archive}\"",
    })

    assert.notEqual(result.status, 0)
    assert.doesNotMatch(result.stdout, /activation-started/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("a truncated archive is a refusal, not a partial activation", () => {
  // A truncated stream may have already extracted entries when tar notices,
  // so the refusal itself is the assertion: the sequence must abort before
  // the activation marker regardless of what tar managed to write.
  const root = mkdtempSync(join(tmpdir(), "local-ci-archive-"))
  try {
    const { repo, sha } = makeFixtureRepo(root)
    const scratch = join(root, "scratch")
    mkdirSync(scratch)
    const staging = join(scratch, "release")
    const releaseArchive = join(scratch, "release.tar")

    execFileSync(
      "git",
      [
        "-C",
        repo,
        "archive",
        "--format=tar",
        `--output=${releaseArchive}`,
        sha,
      ],
      { stdio: ["ignore", "pipe", "pipe"] }
    )
    const fullSize = statSync(releaseArchive).size
    assert.ok(fullSize > 8192)
    writeFileSync(
      releaseArchive,
      Buffer.from(readFileSync(releaseArchive)).subarray(0, 4096)
    )

    const result = runArchiveBlock({
      repoRoot: repo,
      revision: sha,
      releaseArchive,
      staging,
      prepareArchive: ":",
    })

    assert.notEqual(result.status, 0)
    assert.doesNotMatch(result.stdout, /activation-started/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("archive failure aborts before the release directory, the current symlink and launchd", () => {
  // The behavioral tests above prove the sequence refuses; this pin proves
  // the refusal lands before the activation steps it guards. `set -e` turns
  // a failed export or extraction into an exit, so everything ordered after
  // the block never runs on a failed install.
  const materialise = INSTALLER.indexOf(exportCommand)
  const check = INSTALLER.indexOf(archiveIsMaterialised)
  const extract = INSTALLER.indexOf(extractCommand)
  const partialDirectory = INSTALLER.indexOf(
    'sudo mkdir -p "${release_dir}.partial"'
  )
  const releaseMove = INSTALLER.indexOf(
    'sudo mv "${release_dir}.partial" "${release_dir}"'
  )
  const currentLink = INSTALLER.indexOf(
    'sudo ln -sfn "${release_dir}" "${INSTALL_ROOT}/.current.staged"'
  )
  const bootstrap = INSTALLER.indexOf('launchctl bootstrap "gui/${uid}"')

  assert.ok(materialise > -1 && check > -1 && extract > -1)
  assert.ok(
    materialise < check && check < extract,
    "materialisation, its check and the separate extraction run in order"
  )
  for (const [name, at] of [
    ["the release staging directory", partialDirectory],
    ["the atomic release move", releaseMove],
    ["the current symlink", currentLink],
    ["launchd registration", bootstrap],
  ]) {
    assert.ok(
      at > extract,
      `${name} must only run after extraction has succeeded`
    )
  }
  // And the whole block sits inside the not-already-installed branch, so an
  // idempotent re-run over an existing release never re-extracts anything.
  const installed = INSTALLER.indexOf(
    'note "release ${release_sha} is already installed"'
  )
  assert.ok(installed > -1 && installed < materialise)
})
