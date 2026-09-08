import {
  mkdirSync,
  lstatSync,
  readFileSync,
  writeFileSync,
  renameSync,
  rmdirSync,
} from "node:fs"
import { resolve, parse, join } from "node:path"

function privateDirectory(directory) {
  const absolute = resolve(directory)
  let cursor = parse(absolute).root
  for (const component of absolute.slice(cursor.length).split("/")) {
    cursor = join(cursor, component)
    try {
      mkdirSync(cursor, { mode: 0o700 })
    } catch (error) {
      if (error.code !== "EEXIST") throw error
    }
    if (!lstatSync(cursor).isDirectory() || lstatSync(cursor).isSymbolicLink())
      throw new Error("Factory state must use real directories")
  }
  return absolute
}

export function withJournal(directory, operation) {
  const root = privateDirectory(directory)
  const lock = join(root, "lock")
  try {
    mkdirSync(lock, { mode: 0o700 })
  } catch {
    throw new Error(
      "Factory journal is locked; inspect the previous process before recovering the lock"
    )
  }
  try {
    const path = join(root, "state.json")
    let journal = { version: 1, pullRequests: {} }
    try {
      if (!lstatSync(path).isFile() || lstatSync(path).isSymbolicLink())
        throw new Error("Invalid factory journal file")
      journal = JSON.parse(readFileSync(path, "utf8"))
    } catch (error) {
      if (error.code !== "ENOENT") throw error
    }
    if (
      journal.version !== 1 ||
      !journal.pullRequests ||
      Array.isArray(journal.pullRequests)
    )
      throw new Error("Invalid factory journal")
    const save = () => {
      const temporary = join(root, `state-${process.pid}.tmp`)
      writeFileSync(temporary, JSON.stringify(journal, null, 2) + "\n", {
        mode: 0o600,
        flag: "wx",
      })
      renameSync(temporary, path)
    }
    return operation(journal, save)
  } finally {
    rmdirSync(lock)
  }
}

export function reserveRepair(journal, { number, sha, maxRepairCycles, now }) {
  if (
    !Number.isSafeInteger(number) ||
    number < 1 ||
    !/^[a-f0-9]{40}$/.test(sha)
  )
    throw new Error("Invalid repair identity")
  const record = (journal.pullRequests[number] ??= {
    repairCycles: 0,
    reviews: {},
  })
  if (
    !Number.isSafeInteger(record.repairCycles) ||
    record.repairCycles < 0 ||
    record.repairCycles >= maxRepairCycles
  )
    throw new Error(
      "Repair budget exhausted or invalid; an owner decision is required"
    )
  if (record.activeRepair)
    throw new Error(
      "A repair is already active; complete or diagnose it before reserving another"
    )
  record.repairCycles++
  record.activeRepair = { sha, startedAt: now, cycle: record.repairCycles }
  return record.activeRepair
}

export function readJournal(directory) {
  const path = join(resolve(directory), "state.json")
  try {
    if (!lstatSync(path).isFile() || lstatSync(path).isSymbolicLink())
      throw new Error("Invalid factory journal file")
    const journal = JSON.parse(readFileSync(path, "utf8"))
    if (
      journal.version !== 1 ||
      !journal.pullRequests ||
      Array.isArray(journal.pullRequests)
    )
      throw new Error("Invalid factory journal")
    return journal
  } catch (error) {
    if (error.code === "ENOENT") return { version: 1, pullRequests: {} }
    throw error
  }
}
