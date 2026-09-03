import { readdir } from "node:fs/promises"
import { pathToFileURL } from "node:url"
import path from "node:path"

const EXACT_FORBIDDEN_NAMES = new Set([".env.vercel-production"])
const BACKUP_MARKERS = new Set(["bak", "backup", "copy", "old", "orig", "save"])

function isAsciiLetterOrDigit(character) {
  const code = character.charCodeAt(0)
  return (code >= 48 && code <= 57) || (code >= 97 && code <= 122)
}

function hasBackupMarker(name) {
  if (!name.startsWith(".env") || name.length === 4) return false

  const suffix = name.slice(4)
  if (suffix === "~") return true
  if (suffix[0] !== "." && suffix[0] !== "-") return false

  let token = ""
  for (let index = 1; index <= suffix.length; index += 1) {
    const character = suffix[index]
    if (character && isAsciiLetterOrDigit(character)) {
      token += character
      continue
    }

    if (BACKUP_MARKERS.has(token)) return true
    token = ""

    if (
      character !== undefined &&
      character !== "." &&
      character !== "-" &&
      character !== "_" &&
      !(character === "~" && index === suffix.length - 1)
    ) {
      return false
    }
  }

  return name.endsWith("~")
}

function isForbiddenCredentialBackupName(name) {
  const normalised = name.toLowerCase()
  return EXACT_FORBIDDEN_NAMES.has(normalised) || hasBackupMarker(normalised)
}

export function forbiddenCredentialBackupNames(names) {
  return names
    .filter(isForbiddenCredentialBackupName)
    .sort((left, right) => left.localeCompare(right))
}

export async function checkCredentialBackups(root = process.cwd()) {
  const violations = []

  async function visit(directory, relativeDirectory = "") {
    const entries = await readdir(directory, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name === ".git") continue

      const relativeName = relativeDirectory
        ? path.join(relativeDirectory, entry.name)
        : entry.name

      if (isForbiddenCredentialBackupName(entry.name)) {
        violations.push(relativeName)
      }

      if (entry.isDirectory()) {
        await visit(path.join(directory, entry.name), relativeName)
      }
    }
  }

  await visit(root)
  return violations.sort((left, right) => left.localeCompare(right))
}

async function main() {
  const violations = await checkCredentialBackups()
  if (violations.length === 0) {
    console.log("Credential backup check passed.")
    return
  }

  console.error(
    "Credential backup check failed. Remove or quarantine these plaintext backup files after rotating any contained credentials:"
  )
  for (const name of violations) console.error(`- ${name}`)
  process.exitCode = 1
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main()
}
