import assert from "node:assert/strict"
import { parsers } from "prettier/plugins/yaml"
import { readAt, digest } from "./impact-git.mjs"

function plain(node) {
  assert.ok(
    node && !node.anchor && !node.tag,
    "Unsupported workflow indirection"
  )
  return node
}

function field(node, name, optional = false) {
  assert.equal(plain(node).type, "mapping", "Literal workflow mapping required")
  const entries = node.children.filter((item) => {
    const key = plain(item.children[0].children[0])
    assert.ok(["plain", "doubleQuoted", "singleQuoted"].includes(key.type))
    assert.notEqual(key.value, "<<", "Workflow merge keys cannot qualify")
    return key.value === name
  })
  if (optional && entries.length === 0) return undefined
  assert.equal(entries.length, 1, `Missing or duplicate workflow field ${name}`)
  return plain(entries[0].children[1].children[0])
}

function literal(node) {
  assert.ok(
    ["plain", "doubleQuoted", "singleQuoted"].includes(plain(node).type)
  )
  assert.equal(typeof node.value, "string")
  assert.ok(
    node.value && !node.value.includes("${{"),
    "Literal job environment required"
  )
  return node.value
}

// Read workflow data from Git, never import or execute the candidate verifier.
// These fields determine the image that Actions actually starts, independently
// of any environment identity claimed by the candidate's test reporter.
export function browserEnvironmentFromWorkflow(text) {
  const documents = parsers.yaml.parse(text).children
  assert.equal(documents.length, 1)
  const body = documents[0].children.find(
    (node) => node.type === "documentBody"
  )
  const jobs = field(body.children[0], "jobs")
  const environments = {}
  for (const name of [
    "e2e",
    "a11y",
    "targeted-browser",
    "visual",
    "targeted-visual",
  ]) {
    const job = field(jobs, name)
    const runner = literal(field(job, "runs-on"))
    const container = field(job, "container", true)
    if (["visual", "targeted-visual"].includes(name)) {
      assert.equal(
        container,
        undefined,
        "Visual checks require the canonical host runner"
      )
      environments[name] = { runner }
    } else {
      const image = literal(field(container, "image"))
      assert.match(
        image,
        /^mcr\.microsoft\.com\/playwright:[^\s@]+@sha256:[a-f0-9]{64}$/
      )
      environments[name] = {
        runner,
        image,
        options: literal(field(container, "options")),
      }
    }
  }
  assert.deepEqual(
    environments["targeted-browser"],
    environments.e2e,
    "Targeted and full browser images or runners differ"
  )
  assert.deepEqual(
    environments.a11y,
    environments.e2e,
    "Accessibility and full browser images or runners differ"
  )
  assert.deepEqual(
    environments["targeted-visual"],
    environments.visual,
    "Targeted and full visual runners differ"
  )
  return environments
}

export function candidateBrowserEnvironment(candidateSha, options) {
  const text = readAt(candidateSha, ".github/workflows/ci.yml", options)
  return {
    candidateSha,
    workflowDigest: digest(text),
    jobs: browserEnvironmentFromWorkflow(text),
  }
}
