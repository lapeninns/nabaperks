import { digest, safePath, readChanges, readBlob } from "./impact-git.mjs"
import { qualifiedSnapshotPage } from "./impact-snapshots.mjs"
import { impactPolicy, isDocumentationPath } from "./impact-documentation.mjs"
export { impactPolicy, isDocumentationPath } from "./impact-documentation.mjs"
import {
  findPageConsumers,
  isPresentationOnly,
} from "./impact-presentation.mjs"

export const FULL_ROOTS = Object.freeze([
  "fast",
  "quality",
  "build",
  "e2e",
  "a11y",
  "visual",
  "lighthouse",
  "zap-baseline",
  "db",
])

export function requiredRoots(profile, changes = []) {
  if (profile === "documentation") return ["documentation"]
  if (profile === "public-pages")
    return [
      "fast",
      "quality",
      "build",
      "targeted-browser",
      "targeted-visual",
      ...(changes.some((change) => isDocumentationPath(change.path))
        ? ["documentation"]
        : []),
    ]
  if (profile === "full") return [...FULL_ROOTS]
  throw new Error("Unknown CI impact profile")
}

export function classifyChanges(
  changes,
  { policy = impactPolicy, read = readBlob, consumers = () => [] } = {}
) {
  if (policy.schema !== "nabaperks.ci-impact-policy.v1")
    throw new Error("Unknown impact policy")
  const full = (reason) => ({ profile: "full", reason, pages: [] })
  if (!Array.isArray(changes) || changes.length === 0)
    return full("No complete non-empty change inventory")
  const pages = []
  const snapshots = []
  for (const change of changes) {
    if (
      !safePath(change.path) ||
      change.status === "D" ||
      change.newMode !== "100644" ||
      !["000000", "100644"].includes(change.oldMode)
    )
      return full(
        "Deletion, file mode or unsupported path requires full validation"
      )
    if (isDocumentationPath(change.path, policy)) {
      read(change.newOid)
      continue
    }
    const snapshotPage = qualifiedSnapshotPage(change.path, policy)
    if (snapshotPage) {
      if (change.status !== "M" || change.oldMode !== "100644")
        return full("Visual baseline additions require full validation")
      snapshots.push({ path: change.path, pagePath: snapshotPage })
      continue
    }
    const page = policy.publicPages[change.path]
    if (!page || change.status !== "M")
      return full(`Unqualified change: ${change.path}`)
    if (
      !isPresentationOnly(read(change.oldOid), read(change.newOid), change.path)
    )
      return full(`Behaviour or structure changed: ${change.path}`)
    pages.push({ path: change.path, ...page })
  }
  const selectedPagePaths = new Set(pages.map((page) => page.path))
  const unpairedSnapshot = snapshots.find(
    (snapshot) => !selectedPagePaths.has(snapshot.pagePath)
  )
  if (unpairedSnapshot)
    return full(
      `Visual baseline has no matching qualified page change: ${unpairedSnapshot.path}`
    )
  if (!pages.length)
    return {
      profile: "documentation",
      reason: "Only allowlisted internal Markdown changed",
      pages: [],
    }
  if (consumers(pages.map((page) => page.path)).length)
    return full("Public page has other source consumers")
  return {
    profile: "public-pages",
    reason: snapshots.length
      ? "Only literal presentation and matching canonical visual baselines changed in qualified leaf pages"
      : "Only literal presentation changed in qualified leaf pages",
    pages,
  }
}

export function calculateImpact(
  baseSha,
  candidateSha,
  { cwd, policy = impactPolicy } = {}
) {
  const changes = readChanges(baseSha, candidateSha, { cwd })
  let classification
  try {
    classification = classifyChanges(changes, {
      policy,
      read: (oid) => readBlob(oid, { cwd }),
      consumers: (paths) => findPageConsumers(candidateSha, paths, { cwd }),
    })
  } catch {
    classification = {
      profile: "full",
      reason:
        "Source impact could not be established; full validation required",
      pages: [],
    }
  }
  return {
    ...classification,
    changes,
    changeDigest: digest(changes),
    policyDigest: digest(policy),
    required: requiredRoots(classification.profile, changes),
  }
}
