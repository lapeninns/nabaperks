import {
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  realpath,
  rename,
  rm,
  stat,
} from "node:fs/promises"
import path from "node:path"

interface OutputDirectoryContext {
  readonly backupRoot: string
  readonly outputRoot: string
  readonly parent: string
  readonly parentDevice: number
  readonly parentInode: number
  readonly stagingPrefix: string
}

async function lstatIfPresent(candidate: string) {
  try {
    return await lstat(candidate)
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return null
    }
    throw error
  }
}

function assertSafePhysicalOutput(outputRoot: string, workingTree: string) {
  if (
    outputRoot === path.parse(outputRoot).root ||
    outputRoot === workingTree ||
    workingTree.startsWith(outputRoot + path.sep)
  ) {
    throw new Error(
      `Refusing to replace unsafe output directory: ${outputRoot}`
    )
  }
}

async function assertNotSymlink(candidate: string, label: string) {
  const metadata = await lstatIfPresent(candidate)
  if (metadata?.isSymbolicLink()) {
    throw new Error(`Refusing to use a symbolic link as ${label}`)
  }
  return metadata
}

async function prepareOutputDirectory(
  outputDirectory: string,
  allowedBaseDirectory: string
): Promise<OutputDirectoryContext> {
  const lexicalOutput = path.resolve(outputDirectory)
  const lexicalBase = path.resolve(allowedBaseDirectory)
  await mkdir(lexicalBase, { recursive: true })
  await assertNotSymlink(lexicalBase, "the print-kit output base")

  const relativeOutput = path.relative(lexicalBase, lexicalOutput)
  if (
    !relativeOutput ||
    path.isAbsolute(relativeOutput) ||
    relativeOutput === ".." ||
    relativeOutput.startsWith(`..${path.sep}`)
  ) {
    throw new Error("Refusing output outside the dedicated print-kit base")
  }

  const lexicalParent = path.dirname(lexicalOutput)
  await mkdir(lexicalParent, { recursive: true })

  // The trusted base may itself live beneath an operating-system alias (for
  // example /var -> /private/var on macOS), but no component selected by the
  // caller beneath that base may be a symlink.
  const [physicalBase, parent, workingTree] = await Promise.all([
    realpath(lexicalBase),
    realpath(lexicalParent),
    realpath(process.cwd()),
  ])
  const expectedParent = path.join(physicalBase, path.dirname(relativeOutput))
  if (parent !== expectedParent) {
    throw new Error("Refusing a symlinked print-kit output path")
  }

  const outputRoot = path.join(physicalBase, relativeOutput)
  const name = path.basename(outputRoot)
  const backupRoot = path.join(parent, `.${name}.previous`)

  if (!outputRoot.startsWith(physicalBase + path.sep)) {
    throw new Error("Refusing output outside the dedicated print-kit base")
  }
  assertSafePhysicalOutput(outputRoot, workingTree)
  await assertNotSymlink(outputRoot, "the print-kit output directory")
  await assertNotSymlink(backupRoot, "the print-kit backup directory")

  const parentMetadata = await stat(parent)
  return {
    backupRoot,
    outputRoot,
    parent,
    parentDevice: parentMetadata.dev,
    parentInode: parentMetadata.ino,
    stagingPrefix: path.join(parent, `.${name}.staging-`),
  }
}

async function assertOutputContextStable(context: OutputDirectoryContext) {
  const [currentParent, parentMetadata] = await Promise.all([
    realpath(context.parent),
    stat(context.parent),
  ])
  if (
    currentParent !== context.parent ||
    parentMetadata.dev !== context.parentDevice ||
    parentMetadata.ino !== context.parentInode
  ) {
    throw new Error("Refusing to continue after the output parent changed")
  }
  await assertNotSymlink(context.outputRoot, "the print-kit output directory")
  await assertNotSymlink(context.backupRoot, "the print-kit backup directory")
}

async function recoverPreparedOutputDirectory(
  context: OutputDirectoryContext
): Promise<void> {
  await assertOutputContextStable(context)
  const backup = await lstatIfPresent(context.backupRoot)
  if (!backup) return

  if (await lstatIfPresent(context.outputRoot)) {
    await assertOutputContextStable(context)
    await rm(context.backupRoot, { recursive: true, force: true })
    return
  }
  await assertOutputContextStable(context)
  await rename(context.backupRoot, context.outputRoot)
}

/**
 * Repair the only interrupted promotion states the exporter can create.
 * An old backup beside a current output is disposable; a lone backup is the
 * last coherent export and is restored before a new render starts.
 */
export async function recoverInterruptedOutputDirectory(
  outputDirectory: string,
  allowedBaseDirectory = path.resolve(process.cwd(), "output")
): Promise<void> {
  const context = await prepareOutputDirectory(
    outputDirectory,
    allowedBaseDirectory
  )
  await recoverPreparedOutputDirectory(context)
}

async function promoteStagedOutputDirectory(
  stagedRoot: string,
  context: OutputDirectoryContext
): Promise<void> {
  await recoverPreparedOutputDirectory(context)

  await assertOutputContextStable(context)
  const hadOutput = Boolean(await lstatIfPresent(context.outputRoot))
  if (hadOutput) {
    await rename(context.outputRoot, context.backupRoot)
  }

  try {
    await assertOutputContextStable(context)
    await rename(stagedRoot, context.outputRoot)
  } catch (error) {
    await assertOutputContextStable(context)
    if (
      hadOutput &&
      !(await lstatIfPresent(context.outputRoot)) &&
      (await lstatIfPresent(context.backupRoot))
    ) {
      await rename(context.backupRoot, context.outputRoot)
    }
    throw error
  }

  if (hadOutput) {
    await assertOutputContextStable(context)
    await rm(context.backupRoot, { recursive: true, force: true })
  }
}

/**
 * Build a complete print-kit tree beside the live output, then promote it as
 * one directory replacement. Render failures leave the prior export intact,
 * and a successful replacement cannot retain stale venue folders.
 */
export async function withStagedOutputDirectory<T>(
  outputDirectory: string,
  build: (stagedRoot: string) => Promise<T>,
  allowedBaseDirectory = path.resolve(process.cwd(), "output")
): Promise<T> {
  const context = await prepareOutputDirectory(
    outputDirectory,
    allowedBaseDirectory
  )
  await recoverPreparedOutputDirectory(context)

  // A killed exporter never reaches the finally below, so reclaim any
  // abandoned staging trees from earlier runs before creating a new one.
  const stagingBasePrefix = path.basename(context.stagingPrefix)
  for (const entry of await readdir(context.parent)) {
    if (entry.startsWith(stagingBasePrefix)) {
      await assertOutputContextStable(context)
      await rm(path.join(context.parent, entry), {
        recursive: true,
        force: true,
      })
    }
  }

  await assertOutputContextStable(context)
  const stagedRoot = await mkdtemp(context.stagingPrefix)
  try {
    const result = await build(stagedRoot)
    await promoteStagedOutputDirectory(stagedRoot, context)
    return result
  } finally {
    // If the physical parent has been replaced, leave the abandoned staging
    // path for a later safe recovery instead of following the new path.
    await assertOutputContextStable(context)
    await rm(stagedRoot, { recursive: true, force: true })
  }
}
