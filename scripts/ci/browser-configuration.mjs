import assert from "node:assert/strict"
import { createHash } from "node:crypto"

const SCHEMA = "nabaperks.browser-configuration.v1"

function canonical(value) {
  if (value === null || ["string", "boolean"].includes(typeof value))
    return value
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (Array.isArray(value)) return value.map(canonical)
  assert.ok(
    value &&
      Object.getPrototypeOf(value) === Object.prototype &&
      Object.getOwnPropertySymbols(value).length === 0,
    "Browser use settings must be serialisable data"
  )
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .filter((key) => value[key] !== undefined)
      .map((key) => [key, canonical(value[key])])
  )
}

export function captureBrowserConfiguration(config) {
  return {
    schema: SCHEMA,
    projects: config.projects.map(({ name, use }) => ({
      name,
      // Compare every resolved use option without publishing headers, storage
      // state or HTTP credentials in the otherwise public test artifacts.
      useDigest: createHash("sha256")
        .update(JSON.stringify(canonical(use)))
        .digest("hex"),
    })),
  }
}

export function browserConfiguration(report) {
  const configuration = report?.config?.metadata?.nabaperksBrowserConfiguration
  assert.equal(
    configuration?.schema,
    SCHEMA,
    "Resolved browser configuration is missing"
  )
  assert.deepEqual(
    configuration.projects.map(({ name }) => name),
    report.config.projects.map(({ name }) => name),
    "Resolved browser configuration has different projects"
  )
  for (const project of configuration.projects)
    assert.match(project.useDigest ?? "", /^[a-f0-9]{64}$/)
  return configuration
}
