import assert from "node:assert/strict"
import { test } from "node:test"
import { deflateRawSync } from "node:zlib"
import {
  readCandidateZip,
  readReleaseCandidate,
  validateCandidateArtifact,
  validateReleaseRun,
} from "../../scripts/release/read-candidate-artifact.mjs"

const expected = {
  repository: "lapeninns/nabaperks",
  runId: "42",
  attempt: 2,
  projectId: "prj_example",
  teamId: "team_example",
}
const workflow = { id: 7, path: ".github/workflows/production-database.yml" }
const run = {
  id: 42,
  run_attempt: 2,
  workflow_id: 7,
  path: workflow.path,
  repository: { full_name: expected.repository },
  head_repository: { full_name: expected.repository },
  head_branch: "main",
  event: "workflow_run",
  status: "completed",
  conclusion: "success",
  head_sha: "b".repeat(40),
}
const candidate = {
  deploymentId: "dpl_example",
  projectId: expected.projectId,
  teamId: expected.teamId,
  revision: "a".repeat(40),
  target: "production",
  url: "https://candidate-example.vercel.app",
  releaseRunId: "42",
  releaseRunAttempt: 2,
  promotion: "success",
  publicProof: "success",
}
const artifact = {
  id: 9,
  name: "production-candidate-42-2",
  expired: false,
  size_in_bytes: 1000,
  workflow_run: { id: 42 },
}

function zip(
  value = candidate,
  name = "release-candidate.json",
  compressed = false
) {
  const contents = Buffer.from(JSON.stringify(value))
  const packed = compressed ? deflateRawSync(contents) : contents
  const filename = Buffer.from(name)
  let crc = 0xffffffff
  for (const byte of contents) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  crc = (crc ^ 0xffffffff) >>> 0
  const local = Buffer.alloc(30)
  local.writeUInt32LE(0x04034b50)
  local.writeUInt16LE(compressed ? 8 : 0, 8)
  local.writeUInt32LE(crc, 14)
  local.writeUInt32LE(packed.length, 18)
  local.writeUInt32LE(contents.length, 22)
  local.writeUInt16LE(filename.length, 26)
  const central = Buffer.alloc(46)
  central.writeUInt32LE(0x02014b50)
  central.writeUInt16LE(compressed ? 8 : 0, 10)
  central.writeUInt32LE(crc, 16)
  central.writeUInt32LE(packed.length, 20)
  central.writeUInt32LE(contents.length, 24)
  central.writeUInt16LE(filename.length, 28)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50)
  end.writeUInt16LE(1, 8)
  end.writeUInt16LE(1, 10)
  end.writeUInt32LE(central.length + filename.length, 12)
  end.writeUInt32LE(local.length + filename.length + packed.length, 16)
  return Buffer.concat([local, filename, packed, central, filename, end])
}

test("artifact reader resolves actual candidate SHA rather than outer workflow head SHA", async () => {
  const requests = []
  const result = await readReleaseCandidate(expected, {
    async getJson(path) {
      requests.push(path)
      if (path.endsWith("/runs/42")) return run
      if (path.endsWith("/workflows/production-database.yml")) return workflow
      return { artifacts: [artifact], total_count: 1 }
    },
    async download(path) {
      assert.equal(path, "/repos/lapeninns/nabaperks/actions/artifacts/9/zip")
      return zip()
    },
  })
  assert.equal(result.revision, candidate.revision)
  assert.notEqual(result.revision, run.head_sha)
  assert.equal(requests.length, 4)
})

test("release origin rejects unsuccessful, fork, wrong workflow and superseded attempts", () => {
  validateReleaseRun(run, workflow, expected)
  for (const patch of [
    { id: 43 },
    { run_attempt: 3 },
    { workflow_id: 8 },
    { path: "other.yml" },
    { head_branch: "feature" },
    { event: "pull_request" },
    { status: "in_progress" },
    { conclusion: "failure" },
    { head_repository: { full_name: "attacker/nabaperks" } },
    { repository: { full_name: "attacker/nabaperks" } },
  ]) {
    assert.throws(() =>
      validateReleaseRun({ ...run, ...patch }, workflow, expected)
    )
  }
  assert.throws(() =>
    validateReleaseRun(run, { ...workflow, path: "other.yml" }, expected)
  )
})

test("candidate artifact binds run, attempt, full revision and canonical production target", () => {
  assert.deepEqual(validateCandidateArtifact(candidate, expected), candidate)
  for (const patch of [
    { releaseRunId: "41" },
    { releaseRunAttempt: 1 },
    { revision: "a".repeat(12) },
    { revision: "a".repeat(40) + "\nEVIL=1" },
    { projectId: "prj_other" },
    { teamId: "team_other" },
    { target: "preview" },
    { promotion: undefined },
    { promotion: "failure" },
    { publicProof: undefined },
    { publicProof: "failure" },
  ]) {
    assert.throws(() =>
      validateCandidateArtifact({ ...candidate, ...patch }, expected)
    )
  }
})

test("ZIP reader rejects traversal, duplicate members, symlinks, corruption and oversized JSON", () => {
  assert.deepEqual(readCandidateZip(zip()), candidate)
  assert.deepEqual(
    readCandidateZip(zip(candidate, "release-candidate.json", true)),
    candidate
  )
  for (const name of [
    "../release-candidate.json",
    "/release-candidate.json",
    "sub/release-candidate.json",
  ])
    assert.throws(() => readCandidateZip(zip(candidate, name)))
  const multiple = zip()
  multiple.writeUInt16LE(2, multiple.length - 12)
  assert.throws(() => readCandidateZip(multiple))
  const symlink = zip()
  const central = symlink.readUInt32LE(symlink.length - 6)
  symlink.writeUInt32LE(0xa0000000, central + 38)
  assert.throws(() => readCandidateZip(symlink))
  const corrupt = zip()
  corrupt[60] ^= 1
  assert.throws(() => readCandidateZip(corrupt))
  assert.throws(() => readCandidateZip(zip({ padding: "a".repeat(20_000) })))
  assert.throws(() => readCandidateZip(Buffer.from("malformed")))
})

test("artifact discovery rejects stale, duplicate, expired and foreign run artifacts before download", async () => {
  for (const artifacts of [
    [],
    [{ ...artifact, name: "production-candidate-42-1" }],
    [artifact, artifact],
    [{ ...artifact, expired: true }],
    [{ ...artifact, workflow_run: { id: 43 } }],
    [{ ...artifact, size_in_bytes: 100_000 }],
  ]) {
    let downloaded = false
    await assert.rejects(
      readReleaseCandidate(expected, {
        async getJson(path) {
          if (path.endsWith("/runs/42")) return run
          if (path.endsWith("production-database.yml")) return workflow
          return { artifacts, total_count: artifacts.length }
        },
        async download() {
          downloaded = true
          return zip()
        },
      })
    )
    assert.equal(downloaded, false)
  }
})
