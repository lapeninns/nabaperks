import assert from "node:assert/strict"
import test from "node:test"

import { parseCanonicalVercelProductionTarget } from "../../scripts/vercel-production-target.mjs"

const canonical = {
  scope: "lapen-inns-projects",
  team: {
    id: "team_owp80yoz88o4JEgWnPi0ldJH",
  },
  project: {
    id: "prj_Au5baPD1CUlACwN3ECminQZOITcQ",
    name: "nabaperks",
  },
}

test("canonical Vercel target ignores ambient deployment identifiers", () => {
  const previousOrg = process.env.VERCEL_ORG_ID
  const previousProject = process.env.VERCEL_PROJECT_ID
  process.env.VERCEL_ORG_ID = "attacker-scope"
  process.env.VERCEL_PROJECT_ID = "prj_AttackerControlledProject000"
  try {
    assert.deepEqual(parseCanonicalVercelProductionTarget(canonical), {
      scope: canonical.scope,
      teamId: canonical.team.id,
      projectId: canonical.project.id,
      projectName: canonical.project.name,
    })
  } finally {
    if (previousOrg === undefined) delete process.env.VERCEL_ORG_ID
    else process.env.VERCEL_ORG_ID = previousOrg
    if (previousProject === undefined) delete process.env.VERCEL_PROJECT_ID
    else process.env.VERCEL_PROJECT_ID = previousProject
  }
})

test("canonical Vercel target rejects missing, malformed and multiline fields", () => {
  for (const value of [
    {},
    { ...canonical, scope: "bad\nscope" },
    { ...canonical, team: { id: "attacker" } },
    { ...canonical, project: { ...canonical.project, id: "other" } },
    { ...canonical, project: { ...canonical.project, name: "Bad Name" } },
  ]) {
    assert.throws(
      () => parseCanonicalVercelProductionTarget(value),
      /Canonical Vercel target/
    )
  }
})
