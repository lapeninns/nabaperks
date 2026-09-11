import { impactPolicy } from "./impact-documentation.mjs"

const SNAPSHOT_DIRECTORY = "tests/e2e/visual.spec.ts-snapshots"
const CANONICAL_PROJECTS = ["chromium", "mobile-safari"]

export function qualifiedSnapshotPage(path, policy = impactPolicy) {
  for (const [pagePath, page] of Object.entries(policy.publicPages)) {
    if (
      CANONICAL_PROJECTS.some(
        (project) =>
          path ===
          `${SNAPSHOT_DIRECTORY}/${page.visualName}-${project}-linux.png`
      )
    )
      return pagePath
  }
  return undefined
}
