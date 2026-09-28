import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"

/**
 * local CI - install.sh's Docker Desktop preflight.
 *
 * The installer refuses to register an agent that would refuse every job, so
 * it applies the agent's file-sharing and engine rules before it installs.
 * These tests run the installer's own check blocks - extracted from the
 * script, never the whole installer, which escalates with sudo - against
 * fixture inputs.
 */

const INSTALLER = readFileSync("ops/local-ci/host/install.sh", "utf8")
const PLIST = readFileSync(
  "ops/local-ci/host/com.nabaperks.local-ci.plist",
  "utf8"
)
const CONTRACT = JSON.parse(
  readFileSync("config/local-ci-contract.json", "utf8")
)

/** The single-quoted `node -e` program that follows `marker` in install.sh. */
function nodeProgramAfter(marker) {
  const start = INSTALLER.indexOf(marker)
  assert.notEqual(start, -1, `install.sh must contain ${marker}`)
  const open = INSTALLER.indexOf("node -e '", start)
  const close = INSTALLER.indexOf("\n  '", open)
  assert.ok(open > -1 && close > open)
  return INSTALLER.slice(open + "node -e '".length, close)
}

const fileSharingProgram = nodeProgramAfter(
  "Docker Desktop shares the directories in its file-sharing list"
)
const engineProgram = nodeProgramAfter('info_json="$("${docker_cli}"')

test("the installer refuses Docker Desktop's default file sharing and any share of the key or home", () => {
  const root = mkdtempSync(join(tmpdir(), "local-ci-install-dd-"))
  try {
    const home = "/Users/operator"
    const secret = `${home}/.nabaperks-local-ci`
    const check = (settings) => {
      const path = join(root, "settings-store.json")
      writeFileSync(path, JSON.stringify(settings))
      return spawnSync(
        process.execPath,
        ["-e", fileSharingProgram, path, home, secret],
        { encoding: "utf8" }
      )
    }
    const defaults = check({ MemoryMiB: 53248 })
    assert.equal(defaults.status, 1)
    assert.match(
      defaults.stderr,
      /default file sharing, which includes \/Users/
    )
    for (const shared of [
      ["/Users"],
      [home],
      [`${home}/`],
      ["/"],
      [secret],
      [`${secret}/runs`],
    ]) {
      const refused = check({ FilesharingDirectories: shared })
      assert.equal(refused.status, 1, JSON.stringify(shared))
      assert.match(refused.stderr, /Docker Desktop shares/)
    }
    const restricted = check({
      FilesharingDirectories: [`${home}/LapenInns Project`, "/private/tmp"],
    })
    assert.equal(restricted.status, 0, restricted.stderr)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("the installer judges file sharing where paths physically live", () => {
  const root = mkdtempSync(join(tmpdir(), "local-ci-install-links-"))
  try {
    // A home with a symlinked credential directory, and an alias of the
    // whole tree, as "/Volumes/Macintosh HD" is an alias of /.
    const home = join(root, "home", "operator")
    mkdirSync(join(home, "secure", "ci"), { recursive: true })
    mkdirSync(join(home, "project"))
    const secret = join(home, ".nabaperks-local-ci")
    symlinkSync(join(home, "secure", "ci"), secret)
    symlinkSync(root, join(root, "alias"))
    const check = (shared, { homeArg = home, secretArg = secret } = {}) => {
      const path = join(root, "settings-store.json")
      writeFileSync(path, JSON.stringify({ FilesharingDirectories: shared }))
      return spawnSync(
        process.execPath,
        ["-e", fileSharingProgram, path, homeArg, secretArg],
        { encoding: "utf8" }
      )
    }
    for (const shared of [
      [join(home, "secure")],
      [join(home, "secure", "ci", "runs")],
      [join(root, "alias", "home")],
      [join(root, "alias", "home", "operator", ".nabaperks-local-ci")],
    ]) {
      const refused = check(shared)
      assert.equal(refused.status, 1, JSON.stringify(shared))
      assert.match(refused.stderr, /Docker Desktop shares/)
    }
    // The data volume's firmlinks, for a home that need not exist here.
    for (const entry of [
      "/System/Volumes/Data/Users",
      "/System/Volumes/Data",
      "/system/volumes/data/Users/operator",
    ]) {
      const refused = check([entry], {
        homeArg: "/Users/operator",
        secretArg: "/Users/operator/.nabaperks-local-ci",
      })
      assert.equal(refused.status, 1, entry)
    }
    const restricted = check([join(home, "project")])
    assert.equal(restricted.status, 0, restricted.stderr)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("--skip-vm-check is refused on docker-desktop before anything is written, and the pin is written last", () => {
  const refusal = INSTALLER.indexOf(
    '"${runtime_kind}" = "docker-desktop" ] && [ "${skip_vm_check}" = "yes" ]'
  )
  assert.ok(
    refusal > -1,
    "install.sh must refuse --skip-vm-check on docker-desktop"
  )
  assert.ok(refusal < INSTALLER.indexOf('mkdir -p "${secret_dir_real}"'))
  assert.ok(refusal < INSTALLER.indexOf("sudo -v"))
  const pin = INSTALLER.indexOf(
    'printf \'%s\\n\' "${job_image}" | sudo tee "${JOB_IMAGE_FILE}"'
  )
  assert.ok(pin > -1)
  const configVerified = INSTALLER.indexOf('does not reach Docker Desktop"\n')
  assert.ok(configVerified > -1)
  assert.ok(pin > configVerified, "the job-image pin follows the runtime steps")
  assert.ok(
    pin <
      INSTALLER.indexOf(
        "# --------------------------------------------------------- 7. install release"
      )
  )
})

test("the installer holds the desktop-linux engine to the contract's runtime block", () => {
  const root = mkdtempSync(join(tmpdir(), "local-ci-install-engine-"))
  try {
    const contractPath = join(root, "contract.json")
    writeFileSync(contractPath, JSON.stringify(CONTRACT))
    const check = (info) =>
      spawnSync(process.execPath, ["-e", engineProgram, contractPath], {
        input: JSON.stringify(info),
        encoding: "utf8",
      })
    const good = {
      OperatingSystem: "Docker Desktop",
      Architecture: "aarch64",
      ServerVersion: "29.8.0",
      NCPU: 18,
      MemTotal: 54643150848,
      SecurityOptions: ["name=seccomp,profile=builtin"],
    }
    const passed = check(good)
    assert.equal(passed.status, 0, passed.stderr)
    assert.match(passed.stdout, /Docker Desktop 29\.8\.0, 18 CPU, 50\.9 GiB/)
    for (const [field, value, message] of [
      ["OperatingSystem", "Colima", /not Docker Desktop/],
      ["Architecture", "x86_64", /not aarch64/],
      ["ServerVersion", "28.5.0", /older than 29\.0\.0/],
      ["NCPU", 10, /needs 18/],
      ["MemTotal", 32 * 1024 ** 3, /needs 50 GiB/],
      ["SecurityOptions", [], /seccomp is off/],
    ]) {
      const refused = check({ ...good, [field]: value })
      assert.equal(refused.status, 1, field)
      assert.match(refused.stderr, message)
    }
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("the image build reads only the three reviewed pins, as data", () => {
  const start = INSTALLER.indexOf("    build_args=()")
  const end = INSTALLER.indexOf('    [ "${#build_args[@]}" -eq 6 ]', start)
  assert.ok(start > -1 && end > start)
  const parser = INSTALLER.slice(start, end)
  assert.doesNotMatch(parser, /\bsource\b|^\s*\.\s/m)
  const root = mkdtempSync(join(tmpdir(), "local-ci-install-pins-"))
  try {
    const run = (pins) => {
      const path = join(root, "pins.env")
      writeFileSync(path, pins)
      return spawnSync(
        "bash",
        [
          "-c",
          `set -euo pipefail\ndie() { echo "$1" >&2; exit 9; }\npins=${JSON.stringify(path)}\nIMAGE_PINS_RELATIVE_PATH=pins.env\n${parser}\nprintf '%s\\n' "\${build_args[@]}"`,
        ],
        { encoding: "utf8" }
      )
    }
    const committed = readFileSync("ops/local-ci/image/build-pins.env", "utf8")
    const accepted = run(committed)
    assert.equal(accepted.status, 0, accepted.stderr)
    assert.deepEqual(accepted.stdout.trim().split("\n"), [
      "--build-arg",
      "K6_VERSION=2.2.0",
      "--build-arg",
      "K6_SHA256=4ecd64cadcc792402d16293836115480419c4447c032858f564852d98f1bf54c",
      "--build-arg",
      "SUPABASE_CLI_SHA256=a004217bc9e146e6aede8f7f26138fbd94cfdffa5ed4c6b9983bc8b804e5c928",
    ])
    for (const bad of [
      `${committed}EXTRA=1\n`,
      committed.replace(/K6_SHA256=[0-9a-f]+/, "K6_SHA256=notadigest"),
      `${committed}K6_VERSION=$(touch /tmp/x)\n`,
    ]) {
      assert.equal(run(bad).status, 9, bad.slice(-40))
    }
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("the plist, the installer and the contract name one agent DOCKER_CONFIG", () => {
  const declared = /^DOCKER_CONFIG_DIR="\$\{INSTALL_ROOT\}\/([^"]+)"$/m.exec(
    INSTALLER
  )
  assert.ok(declared)
  const installRoot = /^INSTALL_ROOT="([^"]+)"$/m.exec(INSTALLER)[1]
  const path = `${installRoot}/${declared[1]}`
  assert.equal(path, CONTRACT.runtime.dockerConfig)
  assert.match(PLIST, /<key>DOCKER_CONFIG<\/key>/)
  assert.ok(PLIST.includes(`<string>${path}</string>`))
  // Written with an empty config.json and root ownership, before launchd.
  const written = INSTALLER.indexOf(
    "printf '{}\\n' | sudo tee \"${DOCKER_CONFIG_DIR}/config.json\""
  )
  assert.ok(written > -1)
  assert.ok(written < INSTALLER.indexOf('launchctl bootstrap "gui/${uid}"'))
  assert.match(INSTALLER, /sudo chown -R root:wheel "\$\{DOCKER_CONFIG_DIR\}"/)
  // The build uses the revision's own bytes, never the working tree.
  assert.match(
    INSTALLER,
    /git -C "\$\{repo_root\}" archive --format=tar --output="\$\{image_archive\}" "\$\{release_sha\}"/
  )
})
