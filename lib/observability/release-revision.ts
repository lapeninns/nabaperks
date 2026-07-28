const FULL_GIT_SHA = /^[a-f\d]{40}$/i

export function releaseRevision({
  buildRevision = process.env.NABAPERKS_BUILD_REVISION,
  fallback,
  runtimeRevision = process.env.VERCEL_GIT_COMMIT_SHA,
}: {
  buildRevision?: string
  fallback: string
  runtimeRevision?: string
}): string {
  const build = validatedRevision(buildRevision)
  const runtime = validatedRevision(runtimeRevision)

  if (build === null || runtime === null) return "invalid-revision"
  if (build && runtime && build !== runtime) return "revision-mismatch"

  return (runtime || build)?.slice(0, 12) || fallback
}

function validatedRevision(value: string | undefined): string | null {
  const revision = value?.trim()
  if (!revision) return ""
  return FULL_GIT_SHA.test(revision) ? revision.toLowerCase() : null
}
