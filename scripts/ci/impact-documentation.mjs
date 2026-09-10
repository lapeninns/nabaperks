import { readFileSync } from "node:fs"
import { safePath, readChanges, readBlob, digest } from "./impact-git.mjs"

export const impactPolicy = JSON.parse(
  readFileSync(
    new URL("../../config/ci-impact-policy.json", import.meta.url),
    "utf8"
  )
)

export function isDocumentationPath(path, policy = impactPolicy) {
  return (
    safePath(path) &&
    path.endsWith(".md") &&
    (policy.documentation.files.includes(path) ||
      policy.documentation.prefixes.some((prefix) => path.startsWith(prefix)))
  )
}

// Compare the complete candidate with the authenticated deployed revision. A
// docs-only last commit is insufficient when earlier runtime work is pending.
export function documentationDifference(baseSha, candidateSha, { cwd } = {}) {
  const changes = readChanges(baseSha, candidateSha, { cwd })
  if (!changes.length || changes.length > 200) return null
  if (
    changes.some(
      (change) =>
        !isDocumentationPath(change.path) ||
        !["A", "M"].includes(change.status) ||
        change.newMode !== "100644" ||
        !["000000", "100644"].includes(change.oldMode)
    )
  )
    return null
  for (const change of changes) readBlob(change.newOid, { cwd })
  return {
    changeDigest: digest(changes),
    policyDigest: digest(impactPolicy),
    paths: changes.map((change) => change.path),
  }
}
