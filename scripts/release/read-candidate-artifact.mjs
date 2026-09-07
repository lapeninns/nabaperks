import assert from "node:assert/strict"
import { appendFileSync } from "node:fs"
import { inflateRawSync } from "node:zlib"
import { pathToFileURL } from "node:url"
import { validateProductionCandidate } from "./candidate.mjs"

const MAX_ARCHIVE_BYTES = 65_536
const MAX_JSON_BYTES = 16_384
const WORKFLOW_PATH = ".github/workflows/production-database.yml"

export function validateReleaseRun(run, workflow, expected) {
  assert.match(expected.runId ?? "", /^[1-9]\d*$/, "release run ID required")
  assert.ok(
    Number.isSafeInteger(expected.attempt) && expected.attempt > 0,
    "release attempt required"
  )
  assert.equal(String(run.id), expected.runId, "release run ID mismatch")
  assert.equal(
    run.run_attempt,
    expected.attempt,
    "release run attempt mismatch"
  )
  assert.equal(workflow.path, WORKFLOW_PATH, "release workflow path mismatch")
  assert.ok(
    Number.isSafeInteger(workflow.id) && workflow.id > 0,
    "release workflow ID required"
  )
  assert.equal(run.workflow_id, workflow.id, "release workflow ID mismatch")
  assert.equal(run.path, WORKFLOW_PATH, "release run workflow path mismatch")
  assert.equal(
    run.repository?.full_name,
    expected.repository,
    "release repository mismatch"
  )
  assert.equal(
    run.head_repository?.full_name,
    expected.repository,
    "release head repository mismatch"
  )
  assert.equal(run.head_branch, "main", "release branch must be main")
  assert.ok(
    ["workflow_run", "workflow_dispatch"].includes(run.event),
    "invalid release trigger"
  )
  assert.equal(run.status, "completed", "release run is incomplete")
  assert.equal(run.conclusion, "success", "release run did not succeed")
}

// Parse one bounded ZIP member in memory. No path is ever extracted to disk.
export function readCandidateZip(archive) {
  assert.ok(
    Buffer.isBuffer(archive) && archive.length <= MAX_ARCHIVE_BYTES,
    "invalid artifact size"
  )
  const end = archive.length - 22
  assert.ok(
    end >= 0 && archive.readUInt32LE(end) === 0x06054b50,
    "ZIP must have an uncommented end record"
  )
  assert.equal(archive.readUInt16LE(end + 4), 0, "multi-disk ZIP forbidden")
  assert.equal(archive.readUInt16LE(end + 6), 0, "multi-disk ZIP forbidden")
  assert.equal(
    archive.readUInt16LE(end + 8),
    1,
    "artifact must have one member"
  )
  assert.equal(
    archive.readUInt16LE(end + 10),
    1,
    "artifact must have one member"
  )
  assert.equal(archive.readUInt16LE(end + 20), 0, "ZIP comments forbidden")
  const centralSize = archive.readUInt32LE(end + 12)
  const central = archive.readUInt32LE(end + 16)
  assert.equal(central + centralSize, end, "invalid ZIP directory extent")
  assert.equal(
    archive.readUInt32LE(central),
    0x02014b50,
    "invalid ZIP directory"
  )
  const flags = archive.readUInt16LE(central + 8)
  const method = archive.readUInt16LE(central + 10)
  assert.equal(flags & ~0x808, 0, "unsupported ZIP flags")
  assert.ok([0, 8].includes(method), "unsupported ZIP compression")
  const crc = archive.readUInt32LE(central + 16)
  const packedSize = archive.readUInt32LE(central + 20)
  const size = archive.readUInt32LE(central + 24)
  assert.ok(size > 0 && size <= MAX_JSON_BYTES, "invalid candidate JSON size")
  const nameSize = archive.readUInt16LE(central + 28)
  const extraSize = archive.readUInt16LE(central + 30)
  const commentSize = archive.readUInt16LE(central + 32)
  assert.equal(
    centralSize,
    46 + nameSize + extraSize + commentSize,
    "invalid ZIP member extent"
  )
  assert.equal(
    archive.readUInt16LE(central + 34),
    0,
    "multi-disk member forbidden"
  )
  const unixMode = archive.readUInt32LE(central + 38) >>> 16
  assert.ok(
    (unixMode & 0xf000) === 0 || (unixMode & 0xf000) === 0x8000,
    "non-file ZIP member forbidden"
  )
  const offset = archive.readUInt32LE(central + 42)
  assert.equal(offset, 0, "ZIP prefix forbidden")
  const name = archive
    .subarray(central + 46, central + 46 + nameSize)
    .toString("utf8")
  assert.equal(
    name,
    "release-candidate.json",
    "unexpected artifact member path"
  )
  assert.equal(archive.readUInt32LE(0), 0x04034b50, "invalid ZIP local header")
  assert.equal(archive.readUInt16LE(6), flags, "ZIP flag mismatch")
  assert.equal(archive.readUInt16LE(8), method, "ZIP compression mismatch")
  const localNameSize = archive.readUInt16LE(26)
  const localExtraSize = archive.readUInt16LE(28)
  assert.equal(
    archive.subarray(30, 30 + localNameSize).toString("utf8"),
    name,
    "ZIP local member mismatch"
  )
  const dataStart = 30 + localNameSize + localExtraSize
  assert.ok(dataStart + packedSize <= central, "ZIP data overlaps directory")
  if (flags & 8) {
    const descriptorSize = central - dataStart - packedSize
    assert.ok([12, 16].includes(descriptorSize), "invalid ZIP data descriptor")
    let descriptor = dataStart + packedSize
    if (descriptorSize === 16) {
      assert.equal(
        archive.readUInt32LE(descriptor),
        0x08074b50,
        "invalid ZIP descriptor signature"
      )
      descriptor += 4
    }
    assert.equal(
      archive.readUInt32LE(descriptor),
      crc,
      "ZIP descriptor checksum mismatch"
    )
    assert.equal(
      archive.readUInt32LE(descriptor + 4),
      packedSize,
      "ZIP descriptor size mismatch"
    )
    assert.equal(
      archive.readUInt32LE(descriptor + 8),
      size,
      "ZIP descriptor size mismatch"
    )
  } else {
    assert.equal(
      dataStart + packedSize,
      central,
      "unexpected bytes outside ZIP member"
    )
    assert.equal(archive.readUInt32LE(14), crc, "ZIP local checksum mismatch")
    assert.equal(
      archive.readUInt32LE(18),
      packedSize,
      "ZIP local size mismatch"
    )
    assert.equal(archive.readUInt32LE(22), size, "ZIP local size mismatch")
  }
  const packed = archive.subarray(dataStart, dataStart + packedSize)
  const contents =
    method === 8
      ? inflateRawSync(packed, { maxOutputLength: MAX_JSON_BYTES })
      : packed
  assert.equal(contents.length, size, "ZIP size mismatch")
  assert.equal(crc32(contents), crc, "ZIP checksum mismatch")
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(contents))
}

function crc32(bytes) {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

export function validateCandidateArtifact(candidate, expected) {
  assert.ok(
    candidate && typeof candidate === "object",
    "candidate identity required"
  )
  assert.equal(
    candidate.releaseRunId,
    expected.runId,
    "candidate release run mismatch"
  )
  assert.equal(
    candidate.releaseRunAttempt,
    expected.attempt,
    "candidate release attempt mismatch"
  )
  assert.equal(
    candidate.promotion,
    "success",
    "candidate promotion did not succeed"
  )
  assert.equal(
    candidate.publicProof,
    "success",
    "candidate public proof did not succeed"
  )
  const identity = validateProductionCandidate(
    {
      id: candidate.deploymentId,
      projectId: candidate.projectId,
      ownerId: candidate.teamId,
      url: new URL(candidate.url).hostname,
      target: candidate.target,
      readyState: "READY",
      meta: { githubCommitSha: candidate.revision },
    },
    {
      revision: candidate.revision,
      projectId: expected.projectId,
      teamId: expected.teamId,
      url: candidate.url,
    }
  )
  return {
    ...identity,
    releaseRunId: expected.runId,
    releaseRunAttempt: expected.attempt,
    promotion: "success",
    publicProof: "success",
  }
}

export async function readReleaseCandidate(expected, { getJson, download }) {
  assert.match(
    expected.repository ?? "",
    /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/,
    "invalid repository"
  )
  assert.match(expected.runId ?? "", /^[1-9]\d*$/, "invalid run ID")
  const root = `/repos/${expected.repository}/actions`
  const run = await getJson(`${root}/runs/${expected.runId}`)
  const workflow = await getJson(`${root}/workflows/production-database.yml`)
  validateReleaseRun(run, workflow, expected)
  const listing = await getJson(
    `${root}/runs/${expected.runId}/artifacts?per_page=100`
  )
  assert.ok(
    Array.isArray(listing.artifacts) && listing.total_count <= 100,
    "artifact listing incomplete"
  )
  assert.equal(
    listing.artifacts.length,
    listing.total_count,
    "artifact listing count mismatch"
  )
  const name = `production-candidate-${expected.runId}-${expected.attempt}`
  const matches = listing.artifacts.filter((artifact) => artifact.name === name)
  assert.equal(matches.length, 1, "expected one exact candidate artifact")
  const artifact = matches[0]
  assert.equal(artifact.expired, false, "candidate artifact expired")
  assert.ok(
    Number.isSafeInteger(artifact.id) && artifact.id > 0,
    "artifact ID required"
  )
  assert.ok(
    artifact.size_in_bytes > 0 && artifact.size_in_bytes <= MAX_ARCHIVE_BYTES,
    "artifact exceeds size limit"
  )
  assert.equal(
    String(artifact.workflow_run?.id),
    expected.runId,
    "artifact run mismatch"
  )
  const bytes = await download(`${root}/artifacts/${artifact.id}/zip`)
  const candidate = validateCandidateArtifact(readCandidateZip(bytes), expected)
  validateReleaseRun(
    await getJson(`${root}/runs/${expected.runId}`),
    workflow,
    expected
  )
  return candidate
}

function githubClient(token) {
  const request = (path) =>
    fetch(`https://api.github.com${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      redirect: "manual",
      signal: AbortSignal.timeout(30_000),
    })
  return {
    async getJson(path) {
      const response = await request(path)
      assert.equal(response.status, 200, "GitHub metadata request failed")
      return response.json()
    },
    async download(path) {
      const redirect = await request(path)
      assert.equal(redirect.status, 302, "GitHub artifact redirect missing")
      const url = new URL(redirect.headers.get("location"))
      assert.equal(url.protocol, "https:", "artifact download must use HTTPS")
      assert.equal(
        url.username + url.password,
        "",
        "artifact redirect credentials forbidden"
      )
      // The signed storage request must never receive the GitHub token.
      const response = await fetch(url, {
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
      })
      assert.equal(response.status, 200, "artifact download failed")
      const chunks = []
      let size = 0
      for await (const chunk of response.body) {
        size += chunk.length
        assert.ok(size <= MAX_ARCHIVE_BYTES, "artifact download exceeds limit")
        chunks.push(chunk)
      }
      return Buffer.concat(chunks)
    },
  }
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  try {
    assert.ok(
      process.env.GH_TOKEN && process.env.GITHUB_ENV,
      "GitHub token and environment output required"
    )
    const candidate = await readReleaseCandidate(
      {
        repository: process.env.GITHUB_REPOSITORY,
        runId: process.env.RELEASE_RUN_ID,
        attempt: Number(process.env.RELEASE_RUN_ATTEMPT),
        projectId: process.env.CANONICAL_VERCEL_PROJECT_ID,
        teamId: process.env.CANONICAL_VERCEL_TEAM_ID,
      },
      githubClient(process.env.GH_TOKEN)
    )
    appendFileSync(
      process.env.GITHUB_ENV,
      `EXPECTED_REVISION=${candidate.revision}\n`
    )
    console.log(JSON.stringify(candidate))
  } catch {
    console.error(
      "Release candidate artifact verification failed; smoke identity is unavailable."
    )
    process.exitCode = 1
  }
}
