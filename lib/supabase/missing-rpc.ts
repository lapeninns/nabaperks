/**
 * PostgREST reports a call to a function that is not in its schema cache as
 * `PGRST202`. Callers that ship a new RPC alongside the app use this to fall
 * back to the previous read path for one release, so the app can deploy
 * before or after the migration lands without a hard failure.
 */
export function isMissingRpcError(error: {
  readonly code?: string | null
  readonly message?: string | null
}): boolean {
  if (error.code === "PGRST202") return true
  return (
    typeof error.message === "string" &&
    error.message.includes("Could not find the function")
  )
}
