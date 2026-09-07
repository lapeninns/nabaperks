/** One controller owns the host runtime; never kill another owner to acquire it. */
import { execFileSync } from "node:child_process"
import { randomUUID } from "node:crypto"
import {
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { dirname, join } from "node:path"

export function processStartIdentity(pid) {
  if (!Number.isSafeInteger(pid) || pid < 1)
    throw new Error("Invalid lease owner PID")
  try {
    process.kill(pid, 0)
  } catch (error) {
    if (error.code === "ESRCH") return null
    throw new Error("Cannot verify local CI lease owner", { cause: error })
  }
  const start = execFileSync("/bin/ps", ["-p", String(pid), "-o", "lstart="], {
    encoding: "utf8",
    timeout: 5000,
  }).trim()
  if (!start) throw new Error("Cannot verify local CI owner start identity")
  return start
}

function readOwner(path) {
  const owner = JSON.parse(readFileSync(join(path, "owner.json"), "utf8"))
  if (
    !Number.isSafeInteger(owner?.pid) ||
    owner.pid < 1 ||
    typeof owner.start !== "string" ||
    !owner.start ||
    typeof owner.nonce !== "string" ||
    !owner.nonce
  )
    throw new Error("Malformed local CI lease; refusing recovery")
  return owner
}

export function acquireControllerLease({
  path,
  pid = process.pid,
  probe = processStartIdentity,
}) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
  const start = probe(pid)
  if (!start) throw new Error("Cannot identify this local CI controller")
  const owner = { pid, start, nonce: randomUUID() }
  const create = () => {
    mkdirSync(path, { mode: 0o700 })
    // A crash between mkdir and owner publication leaves an unverifiable lease,
    // which requires operator inspection instead of guessing the owner is dead.
    writeFileSync(join(path, "owner.json"), JSON.stringify(owner), {
      flag: "wx",
      mode: 0o600,
    })
  }
  try {
    create()
  } catch (error) {
    if (error.code !== "EEXIST") throw error
    const guard = `${path}.recovery`
    // Serialise stale-owner recovery; never rename a newly acquired lease after
    // another contender already recovered the old one.
    mkdirSync(guard, { mode: 0o700 })
    try {
      const previous = readOwner(path)
      if (probe(previous.pid) === previous.start)
        throw new Error(
          `Local CI controller PID ${previous.pid} already owns the runtime`
        )
      const tombstone = `${path}.stale-${randomUUID()}`
      renameSync(path, tombstone)
      rmSync(tombstone, { recursive: true })
      create()
    } finally {
      rmSync(guard, { recursive: true })
    }
  }
  return Object.freeze({
    release() {
      const current = readOwner(path)
      if (current.nonce !== owner.nonce)
        throw new Error("Local CI lease ownership changed; refusing release")
      rmSync(path, { recursive: true })
    },
  })
}
