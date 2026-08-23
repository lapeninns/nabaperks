import { mkdir, readFile, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

import {
  assertRevisionUnchanged,
  candidateIdentity,
  collectReceipt,
  outputPath,
  runProductionBuild,
  startChrome,
  startProductionServer,
  stopChrome,
  stopProcess,
} from "./task20a-lighthouse-runtime.mjs"
import { verifyTask20ALighthouseReceipt } from "./task20a-lighthouse-policy.mjs"

export { verifyTask20ALighthouseReceipt } from "./task20a-lighthouse-policy.mjs"

const PROJECT_ROOT = process.cwd()

if (isMainModule()) {
  // no-excuse-ok: catch -- CLI boundary prints the failure and preserves its exit status.
  run(parseArgs(process.argv.slice(2))).catch((error) => {
    console.error(error instanceof Error ? error.stack : String(error))
    process.exitCode = 1
  })
}

async function run(args) {
  if (args.verifyReceipt) {
    const source = await readJson(args.verifyReceipt)
    const outcome = await verifyTask20ALighthouseReceipt(
      source,
      resolve(args.verifyReceipt, "..")
    )
    console.log(JSON.stringify(outcome, null, 2))
    if (outcome.verdict !== "PASS") process.exitCode = 1
    return
  }

  const candidate = await candidateIdentity()
  const revision = candidate.revision
  const outputDirectory = await outputPath(
    PROJECT_ROOT,
    args.outputDirectory,
    revision
  )
  await mkdir(outputDirectory, { recursive: false })
  await runProductionBuild(PROJECT_ROOT, outputDirectory)
  await assertRevisionUnchanged(revision)

  const server = await startProductionServer(PROJECT_ROOT)
  let chrome
  try {
    chrome = await startChrome(outputDirectory)
    const receipt = await collectReceipt({
      chrome,
      candidate,
      outputDirectory,
      revision,
      server,
    })
    const receiptPath = resolve(outputDirectory, "receipt.json")
    await writeJson(receiptPath, receipt)
    await writeJson(receiptPath, receipt)
    console.log(JSON.stringify(receipt, null, 2))
  } finally {
    if (chrome) await stopChrome(chrome)
    await stopProcess(server.process, "production server")
  }
}

function parseArgs(args) {
  const parsed = { outputDirectory: null, verifyReceipt: null }
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index]
    if (value === "--") {
      continue
    } else if (value === "--output-dir") {
      parsed.outputDirectory = requiredValue(args[index + 1], value)
      index += 1
    } else if (value === "--verify-receipt") {
      parsed.verifyReceipt = requiredValue(args[index + 1], value)
      index += 1
    } else {
      throw new Error(`Unsupported argument: ${value}`)
    }
  }
  if (parsed.outputDirectory && parsed.verifyReceipt) {
    throw new Error("--output-dir and --verify-receipt cannot be combined")
  }
  return parsed
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`)
}

async function readJson(path) {
  const source = await readFile(path, "utf8")
  return JSON.parse(source)
}

function requiredValue(value, flag) {
  if (!value || value.startsWith("--"))
    throw new Error(`${flag} requires a value`)
  return value
}

function isMainModule() {
  return (
    process.argv[1] &&
    fileURLToPath(import.meta.url) === resolve(process.argv[1])
  )
}
