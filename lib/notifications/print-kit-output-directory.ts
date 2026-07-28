import { access, mkdir, mkdtemp, rename, rm } from "node:fs/promises"
import path from "node:path"

async function pathExists(candidate: string): Promise<boolean> {
  try {
    await access(candidate)
    return true
  } catch {
    return false
  }
}

function safeOutputRoot(outputRoot: string): string {
  const resolved = path.resolve(outputRoot)
  if (
    resolved === path.parse(resolved).root ||
    resolved === path.resolve(process.cwd())
  ) {
    throw new Error(`Refusing to replace unsafe output directory: ${resolved}`)
  }
  return resolved
}

function swapPaths(outputRoot: string) {
  const parent = path.dirname(outputRoot)
  const name = path.basename(outputRoot)
  return {
    backupRoot: path.join(parent, `.${name}.previous`),
    parent,
    stagingPrefix: path.join(parent, `.${name}.staging-`),
  }
}

/**
 * Repair the only interrupted promotion states the exporter can create.
 * An old backup beside a current output is disposable; a lone backup is the
 * last coherent export and is restored before a new render starts.
 */
export async function recoverInterruptedOutputDirectory(
  outputDirectory: string
): Promise<void> {
  const outputRoot = safeOutputRoot(outputDirectory)
  const { backupRoot } = swapPaths(outputRoot)
  if (!(await pathExists(backupRoot))) return

  if (await pathExists(outputRoot)) {
    await rm(backupRoot, { recursive: true, force: true })
    return
  }
  await rename(backupRoot, outputRoot)
}

async function promoteStagedOutputDirectory(
  stagedRoot: string,
  outputDirectory: string
): Promise<void> {
  const outputRoot = safeOutputRoot(outputDirectory)
  const { backupRoot } = swapPaths(outputRoot)
  await recoverInterruptedOutputDirectory(outputRoot)

  const hadOutput = await pathExists(outputRoot)
  if (hadOutput) {
    await rename(outputRoot, backupRoot)
  }

  try {
    await rename(stagedRoot, outputRoot)
  } catch (error) {
    if (
      hadOutput &&
      !(await pathExists(outputRoot)) &&
      (await pathExists(backupRoot))
    ) {
      await rename(backupRoot, outputRoot)
    }
    throw error
  }

  if (hadOutput) {
    await rm(backupRoot, { recursive: true, force: true })
  }
}

/**
 * Build a complete print-kit tree beside the live output, then promote it as
 * one directory replacement. Render failures leave the prior export intact,
 * and a successful replacement cannot retain stale venue folders.
 */
export async function withStagedOutputDirectory<T>(
  outputDirectory: string,
  build: (stagedRoot: string) => Promise<T>
): Promise<T> {
  const outputRoot = safeOutputRoot(outputDirectory)
  const { parent, stagingPrefix } = swapPaths(outputRoot)
  await mkdir(parent, { recursive: true })
  await recoverInterruptedOutputDirectory(outputRoot)

  const stagedRoot = await mkdtemp(stagingPrefix)
  try {
    const result = await build(stagedRoot)
    await promoteStagedOutputDirectory(stagedRoot, outputRoot)
    return result
  } finally {
    await rm(stagedRoot, { recursive: true, force: true })
  }
}
