export function isDatabaseConnectionRefused(error) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ECONNREFUSED"
  )
}

export function printDatabaseConnectionHelp(dbUrl, commandHint) {
  console.error(`Cannot reach Postgres at ${safeDatabaseTarget(dbUrl)}.`)
  console.error("Local Supabase is not running on port 54322.")
  console.error("")
  console.error("Start it with:")
  console.error("  pnpm db:supabase:start")
  console.error("")
  console.error("Then run:")
  console.error(`  ${commandHint}`)
}

function safeDatabaseTarget(dbUrl) {
  try {
    const url = new URL(dbUrl)
    return `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ""}${url.pathname}`
  } catch {
    return "configured database"
  }
}
