import { readdir } from "node:fs/promises"
import { pathToFileURL } from "node:url"
import path from "node:path"

const EXACT_FORBIDDEN_NAMES = new Set([".env.vercel-production"])
const BACKUP_NAME_PATTERNS = [
  /^\.env(?:\.[a-z0-9_-]+)*(?:\.|-)(?:bak|backup|copy|old|orig|save)(?:[._-][a-z0-9_-]+)*~?$/i,
  /^\.env(?:\.[a-z0-9_-]+)*~$/i,
]

function isForbiddenCredentialBackupName(name) {
  return (
    EXACT_FORBIDDEN_NAMES.has(name.toLowerCase()) ||
    BACKUP_NAME_PATTERNS.some((pattern) => pattern.test(name))
  )
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
