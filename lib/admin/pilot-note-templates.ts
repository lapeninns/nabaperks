/**
 * Pilot note-type options and the note skeleton shown as the notes-field
 * PLACEHOLDER for each type. This is a scaffold, never a prefilled value: the
 * operator's justification must be typed, so the placeholder only guides
 * structure and can never be submitted verbatim as a hollow audit note.
 */
export type PilotNoteType = {
  readonly value: string
  readonly label: string
}

export const PILOT_NOTE_TYPES: readonly PilotNoteType[] = [
  { value: "support", label: "Support note" },
  { value: "interview", label: "Interview note" },
  { value: "payment_objection", label: "Payment objection" },
  { value: "cancellation_reason", label: "Cancellation reason" },
  { value: "launch_self_service_checked", label: "Self-service launch check" },
]

const PLACEHOLDERS: Record<string, string> = {
  support: "What happened, the source, and the next action.",
  interview: "What the operator said, the key insight, and any follow-up.",
  payment_objection: "The objection raised, how it was handled, and the outcome.",
  cancellation_reason: "Why they cancelled, any save attempt, and the outcome.",
  launch_self_service_checked:
    "What was checked, the setup minutes, and pass or fail.",
}

/** The notes-field placeholder for a note type; falls back to the support one. */
export function pilotNotePlaceholder(noteType: string): string {
  return PLACEHOLDERS[noteType] ?? PLACEHOLDERS.support
}
