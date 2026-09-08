import { spawn } from "node:child_process"
import { pathToFileURL } from "node:url"

export function nodeTestArguments(args, concurrency) {
  if (concurrency === undefined) return args
  if (!/^[1-9][0-9]*$/.test(concurrency) || Number(concurrency) > 32)
    throw new Error("LOCAL_CI_TEST_CONCURRENCY must be an integer from 1 to 32")
  return [`--test-concurrency=${concurrency}`, ...args]
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const child = spawn(
      process.execPath,
      nodeTestArguments(
        process.argv.slice(2),
        process.env.LOCAL_CI_TEST_CONCURRENCY
      ),
      { stdio: "inherit" }
    )
    for (const signal of ["SIGTERM", "SIGINT"])
      process.on(signal, () => child.kill(signal))
    child.on("error", (error) => {
      console.error(error.message)
      process.exitCode = 1
    })
    child.on("exit", (code) => {
      process.exitCode = code ?? 1
    })
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
