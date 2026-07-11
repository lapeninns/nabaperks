export type JoinRpcFailureReason =
  | "invalid_join_context"
  | "permission_denied"
  | "schema_mismatch"
  | "database_conflict"
  | "database_unavailable"
  | "database_rejected"

type SupabaseRpcError = {
  readonly code?: string | null
  readonly message?: string | null
}

export function classifyJoinRpcFailure(
  error: SupabaseRpcError
): JoinRpcFailureReason {
  const code = error.code?.trim().toUpperCase() ?? ""
  const message = error.message?.trim().toLowerCase() ?? ""

  if (
    code === "42501" ||
    code.startsWith("28") ||
    code === "PGRST301" ||
    code === "PGRST302"
  ) {
    return "permission_denied"
  }
  if (code === "PGRST202" || code === "PGRST204") return "schema_mismatch"
  if (
    code.startsWith("08") ||
    code === "53300" ||
    code === "53400" ||
    code === "57P01" ||
    code === "57P02" ||
    code === "57P03" ||
    code.startsWith("58")
  ) {
    return "database_unavailable"
  }
  if (code === "23505" || code === "40001" || code === "40P01") {
    return "database_conflict"
  }
  if (
    code === "P0001" &&
    /loyalty (card|terms)|merchant loyalty programme|customer not found/.test(
      message
    )
  ) {
    return "invalid_join_context"
  }
  return "database_rejected"
}
