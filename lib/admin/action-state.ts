/**
 * Structured result state for admin console server actions
 * (MS-platform-ux-production-polish). Actions return this instead of
 * throwing on validation or RPC failure, so the form renders the outcome
 * inline and the segment error boundary stays reserved for render/read
 * failures. Pure module: shared by the server actions and the client
 * `AdminActionForm`.
 */
export type AdminActionState =
  | { readonly status: "idle" }
  | { readonly status: "success"; readonly message: string }
  | { readonly status: "error"; readonly message: string }

export const idleAdminActionState: AdminActionState = { status: "idle" }

export function adminActionSuccess(message: string): AdminActionState {
  return { status: "success", message }
}

export function adminActionError(message: string): AdminActionState {
  return { status: "error", message }
}
