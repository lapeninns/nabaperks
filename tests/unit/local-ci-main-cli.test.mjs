import assert from "node:assert/strict"
import {
  chmodSync,
  closeSync,
  mkdtempSync,
  openSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { after, before, test } from "node:test"

import {
  PERMITTED_HOST_EXECUTABLES,
  execHost,
  permittedExecutable,
  readCredentialFile,
} from "../../ops/local-ci/agent/main.mjs"

/**
 * local CI — the two host-facing edges of the CLI entry point.
 *
 * `main.mjs` is the only file in the package that opens a credential or spawns
 * a process, so these are the assertions that cannot be made anywhere else:
 *
 *   - a credential file is checked and read through **one** descriptor, and a
 *     mode readable beyond the owner is a refusal rather than a warning;
 *   - `argv[0]` is confined to the two executables this plane documents, so an
 *     argv assembled from command-line data cannot choose the binary that runs
 *     on the Mac holding the GitHub App private key.
 *
 * Everything below runs offline against a real temp directory; nothing here
 * spawns a process that outlives the test.
 */

let root

before(() => {
  root = mkdtempSync(join(tmpdir(), "nabaperks-local-ci-cli-"))
})

after(() => {
  rmSync(root, { recursive: true, force: true })
})

const describe = (value) =>
  typeof value === "object" && value !== null ? "an object" : String(value)

const writeCredential = (name, mode, body = "PEM\n") => {
  const path = join(root, name)
  writeFileSync(path, body)
  chmodSync(path, mode)
  return path
}

/* ------------------------------------------------------ readCredentialFile */

test("readCredentialFile returns null when the file is absent", () => {
  assert.equal(
    readCredentialFile(join(root, "not-installed.pem"), "the key"),
    null
  )
})

test("readCredentialFile reads an owner-only file", () => {
  const path = writeCredential("owner-only.pem", 0o600, "-----BEGIN-----\n")
  assert.equal(
    readCredentialFile(path, "the GitHub App private key"),
    "-----BEGIN-----\n"
  )
})

test("readCredentialFile accepts a stricter mode than 0600", () => {
  const path = writeCredential("locked.pem", 0o400, "strict\n")
  assert.equal(readCredentialFile(path, "the key"), "strict\n")
})

test("readCredentialFile refuses a group- or world-readable file", () => {
  for (const [name, mode, octal] of [
    ["group-readable.pem", 0o640, "0640"],
    ["world-readable.pem", 0o644, "0644"],
    ["world-writable.pem", 0o666, "0666"],
  ]) {
    const path = writeCredential(name, mode)
    assert.throws(
      () => readCredentialFile(path, "the GitHub App private key"),
      (error) => {
        assert.equal(error.code, "CREDENTIAL_PERMISSIONS")
        assert.match(error.message, /the GitHub App private key/)
        assert.match(error.message, new RegExp(`is mode ${octal}`))
        assert.match(error.message, /chmod 600/)
        return true
      },
      `mode ${octal} must be refused`
    )
  }
})

test("readCredentialFile checks and reads the same descriptor", () => {
  // The mode that is approved must be the mode of the bytes returned. Reading
  // through one descriptor is what makes that true; a stat-then-open pair lets
  // the name be repointed between the two syscalls.
  const target = writeCredential("swap-target.pem", 0o600, "the real key\n")
  const link = join(root, "swap-link.pem")
  symlinkSync(target, link)
  assert.equal(readCredentialFile(link, "the key"), "the real key\n")

  // A symlink is followed, but it is the *target's* mode that decides, so a
  // world-readable target is refused through the link exactly as it is direct.
  chmodSync(target, 0o644)
  assert.throws(() => readCredentialFile(link, "the key"), {
    code: "CREDENTIAL_PERMISSIONS",
  })
  chmodSync(target, 0o600)
})

test("readCredentialFile leaks no descriptor on the refusal path", () => {
  // Descriptors are handed out lowest-free-first, so a fresh open lands on the
  // same number every time only while nothing before it leaked. Without the
  // `finally`, 200 refusals move this by 200.
  const path = writeCredential("leaky.pem", 0o644)
  const probe = () => {
    const fd = openSync(path, "r")
    closeSync(fd)
    return fd
  }
  const baseline = probe()
  for (let attempt = 0; attempt < 200; attempt += 1) {
    assert.throws(() => readCredentialFile(path, "the key"), {
      code: "CREDENTIAL_PERMISSIONS",
    })
  }
  assert.equal(probe(), baseline)
})

/* ------------------------------------------------------------- the argv gate */

test("the host executable allowlist is exactly the two documented tools", () => {
  assert.deepEqual(PERMITTED_HOST_EXECUTABLES, ["/bin/sh", "limactl"])
  assert.ok(Object.isFrozen(PERMITTED_HOST_EXECUTABLES))
})

test("permittedExecutable returns the allowlist's own string", () => {
  const supplied = ["/bin/sh", "-c", "true"]
  const executable = permittedExecutable(supplied)
  assert.equal(executable, "/bin/sh")
  // Identity, not equality: what reaches `spawn` is the constant, never the
  // caller's word, so no tainted string can be the thing that gets executed.
  assert.equal(executable, PERMITTED_HOST_EXECUTABLES[0])
  assert.equal(permittedExecutable(["limactl", "shell", "vm"]), "limactl")
})

test("permittedExecutable refuses an executable outside the allowlist", () => {
  for (const executable of [
    "/usr/bin/curl",
    "curl",
    "git",
    "docker",
    "/tmp/evil/limactl",
    "./limactl",
    "limactl\n",
    "",
  ]) {
    assert.throws(
      () => permittedExecutable([executable, "--version"]),
      (error) => {
        assert.equal(error.code, "EXECUTABLE_NOT_PERMITTED")
        assert.match(error.message, /permitted executables are/)
        return true
      },
      `${JSON.stringify(executable)} must be refused`
    )
  }
})

test("permittedExecutable refuses an argv that is not a non-empty string list", () => {
  for (const argv of [undefined, null, [], "/bin/sh", { 0: "/bin/sh" }]) {
    assert.throws(() => permittedExecutable(argv), {
      code: "INVALID_COMMAND",
    })
  }
  for (const word of [null, undefined, 7, ["-c"], { toString: () => "-c" }]) {
    assert.throws(
      () => permittedExecutable(["/bin/sh", "-c", word]),
      (error) => {
        assert.equal(error.code, "INVALID_COMMAND")
        assert.match(error.message, /word 2 must be a string/)
        return true
      },
      `${describe(word)} must not reach spawn`
    )
  }
})

/* --------------------------------------------------------------- execHost */

test("execHost rejects rather than throwing when the argv is refused", async () => {
  // `releaseWorkspace` swallows this call with `.catch()` inside a `finally`;
  // a synchronous throw would escape that and mask the run's real outcome.
  const promise = execHost(["/usr/bin/env", "true"])
  assert.ok(promise instanceof Promise)
  await assert.rejects(promise, { code: "EXECUTABLE_NOT_PERMITTED" })
  await assert.rejects(execHost([]), { code: "INVALID_COMMAND" })
})

test("execHost runs a permitted executable and returns its stdout", async () => {
  assert.equal(await execHost(["/bin/sh", "-c", "printf ok"]), "ok")
})

test("execHost feeds stdin to a permitted executable", async () => {
  assert.equal(
    await execHost(["/bin/sh", "-c", "cat"], { input: "fed\n" }),
    "fed\n"
  )
})

test("execHost reports a non-zero exit as COMMAND_FAILED", async () => {
  await assert.rejects(
    execHost(["/bin/sh", "-c", "echo boom >&2; exit 3"]),
    (error) => {
      assert.equal(error.code, "COMMAND_FAILED")
      assert.match(error.message, /exited 3: boom/)
      return true
    }
  )
})
