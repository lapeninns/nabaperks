import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"

const INSTALLER = readFileSync("ops/local-ci/host/install.sh", "utf8")

for (const existing of [false, true]) {
  test(`installer makes ${existing ? "existing" : "new"} private-mode releases readable without making them writable`, () => {
    const root = mkdtempSync(join(tmpdir(), "local-ci-permissions-"))
    try {
      const release = join(root, "release")
      const secret = join(root, "private-key")
      mkdirSync(release, { mode: 0o700 })
      writeFileSync(join(release, "contract.json"), "{}", { mode: 0o600 })
      writeFileSync(join(release, "agent.mjs"), "// executable", {
        mode: 0o700,
      })
      writeFileSync(secret, "fixture", { mode: 0o600 })
      if (existing) chmodSync(join(release, "contract.json"), 0o666)
      const command = INSTALLER.match(/^sudo chmod -R u=rwX,go=rX .+$/m)?.[0]
      assert.ok(command)
      assert.ok(
        INSTALLER.indexOf(command) >
          INSTALLER.indexOf('note "extracted ${release_sha}"\nfi')
      )
      const result = spawnSync("bash", ["-c", command.replace(/^sudo /, "")], {
        env: { ...process.env, release_dir: release },
        encoding: "utf8",
      })
      assert.equal(result.status, 0, result.stderr)
      for (const [path, mode] of [
        [release, 0o755],
        [join(release, "contract.json"), 0o644],
        [join(release, "agent.mjs"), 0o755],
        [secret, 0o600],
      ]) {
        assert.equal(statSync(path).mode & 0o777, mode)
      }
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
}

test("installer checks operator access and repairs the macOS link before launchd registration", () => {
  const linkMode = INSTALLER.indexOf(
    'sudo chmod -h 0755 "${INSTALL_ROOT}/.current.staged"'
  )
  const repoint = INSTALLER.indexOf(
    'sudo mv -fh "${INSTALL_ROOT}/.current.staged"'
  )
  const access = INSTALLER.indexOf("test -r config/local-ci-contract.json")
  const bootstrap = INSTALLER.indexOf('launchctl bootstrap "gui/${uid}"')
  assert.ok(
    linkMode > 0 && linkMode < repoint && repoint < access && access < bootstrap
  )
  assert.match(INSTALLER, /rev-parse --is-inside-work-tree/)
  assert.doesNotMatch(INSTALLER, /\[ -d "\$\{repo_root\}\/\.git" \]/)
})
