import { notFound } from "next/navigation"

import { StampHarnessClient } from "./harness-client"

const MODES = new Set([
  "success",
  "final",
  "blocked",
  "unknown",
  "unknown-issued",
  "unknown-issued-bonus",
  "unknown-closed",
  "closed",
  "reloaded-final",
])

export default async function StampHarnessPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; delay?: string }>
}) {
  if (process.env.NODE_ENV === "production") notFound()

  const query = await searchParams
  const mode = MODES.has(query.mode ?? "") ? query.mode : "success"
  const parsedDelay = Number(query.delay ?? "450")
  const delayMs = Number.isFinite(parsedDelay)
    ? Math.min(Math.max(parsedDelay, 0), 5000)
    : 450

  return (
    <StampHarnessClient
      mode={
        mode === "final" ||
        mode === "blocked" ||
        mode === "unknown" ||
        mode === "unknown-issued" ||
        mode === "unknown-issued-bonus" ||
        mode === "unknown-closed" ||
        mode === "closed" ||
        mode === "reloaded-final"
          ? mode
          : "success"
      }
      delayMs={delayMs}
    />
  )
}
