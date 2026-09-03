import { execFileSync } from "node:child_process"
import { pathToFileURL } from "node:url"

const FULL_GIT_SHA = /^[0-9a-f]{40}$/i

export function assertPasswordlessRollbackSources({ actions, session }) {
  if (!/\bsignInWithOtp\b/.test(actions)) {
    throw new Error(
      "Rollback candidate has no passwordless merchant entry path."
    )
  }
  if (/\bsignInWithPassword\b|\bresetPasswordForEmail\b/.test(actions)) {
    throw new Error(
      "Rollback candidate still contains merchant password access."
    )
  }
  if (!/\bcurrent_auth_session_is_passwordless\b/.test(session)) {
    throw new Error(
      "Rollback candidate does not reject password-origin sessions at request time."
    )
  }
}

export function checkPasswordlessRollbackRevision(
  revision,
  cwd = process.cwd()
) {
  if (!FULL_GIT_SHA.test(revision ?? "")) {
    throw new Error("Rollback candidate must be identified by a full Git SHA.")
  }

  assertPasswordlessRollbackSources({
    actions: readRevisionFile(cwd, revision, "app/(auth)/actions.ts"),
    session: readRevisionFile(cwd, revision, "lib/auth/session.ts"),
  })
}

function readRevisionFile(cwd, revision, path) {
  try {
    return execFileSync("git", ["show", `${revision}:${path}`], {
      cwd,
      encoding: "utf8",
      maxBuffer: 2 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    })
  } catch {
    throw new Error(
      `Rollback candidate is missing the required ${path} source.`
    )
  }
}

function main() {
  checkPasswordlessRollbackRevision(process.argv[2])
  console.log("Passwordless rollback candidate passed.")
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  try {
    main()
  } catch (error) {
    console.error(
      error instanceof Error
        ? error.message
        : "Rollback candidate check failed."
    )
    process.exitCode = 1
  }
}
