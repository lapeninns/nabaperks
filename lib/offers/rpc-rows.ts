/**
 * One narrowing reader for the rows this feature's RPCs return.
 *
 * Supabase types an `rpc()` payload as `unknown` at this boundary: a
 * `returns table (...)` function arrives as an array of records, a scalar
 * function as a bare value, and a failed call as null. Every offer module was
 * re-declaring the same two helpers to cross that boundary, so they live here
 * instead — pure, no `server-only`, no Supabase import, so the callers stay
 * free to be server-only without dragging a client into a unit test.
 *
 * Nothing here trusts a shape: an unexpected payload narrows to null and the
 * caller renders its own calm state.
 */

/** The first record of an RPC payload, or null when there is not one. */
export function firstRpcRecord(value: unknown): Record<string, unknown> | null {
  const candidate = Array.isArray(value) ? value[0] : value
  return typeof candidate === "object" && candidate !== null
    ? (candidate as Record<string, unknown>)
    : null
}

/** A non-empty string field, or null. Blank strings count as absent. */
export function rpcStringField(
  record: Record<string, unknown> | null,
  key: string
): string | null {
  const value = record?.[key]
  return typeof value === "string" && value.trim() !== "" ? value : null
}

/** A finite number field, or null. */
export function rpcNumberField(
  record: Record<string, unknown> | null,
  key: string
): number | null {
  const value = record?.[key]
  return typeof value === "number" && Number.isFinite(value) ? value : null
}
