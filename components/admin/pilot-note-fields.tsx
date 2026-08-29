"use client"

import { useEffect, useRef, useState } from "react"
import { CheckmarkCircle02Icon } from "@hugeicons/core-free-icons"

import { Icon } from "@/components/brand"
import { AdminField } from "@/components/admin/support"
import { SubmitButton, SelectField } from "@/components/forms"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  PILOT_NOTE_TYPES,
  pilotNotePlaceholder,
} from "@/lib/admin/pilot-note-templates"

const DEFAULT_PILOT_NOTE_TYPE = "support"

/**
 * The pilot-note fields, extracted so the notes placeholder can follow the
 * selected note type. The placeholder is a scaffold only — the operator still
 * types the note, so no audit justification is ever prefilled as a value.
 */
export function PilotNoteFields() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [noteType, setNoteType] = useState(DEFAULT_PILOT_NOTE_TYPE)

  useEffect(() => {
    const form = containerRef.current?.closest("form")
    if (!form) return

    const resetNoteType = () => setNoteType(DEFAULT_PILOT_NOTE_TYPE)
    form.addEventListener("reset", resetNoteType)
    return () => form.removeEventListener("reset", resetNoteType)
  }, [])

  return (
    // Container query, not `xl:`. This form sits four boxes deep (panel p-5 →
    // card p-4 → disclosure px-3 → here), so at a 1280px viewport it had about
    // 820px into which the `xl:` rule asked for 220 + 160 + 1fr + auto — it
    // switched to its widest layout exactly where it least fit. `@2xl` keys off
    // the disclosure body's own width instead, and `items-end` keeps the
    // two-row textarea, the select and the submit on one baseline.
    <div
      ref={containerRef}
      className="@container grid gap-3 sm:grid-cols-2 @2xl:grid-cols-[minmax(0,14rem)_minmax(0,10rem)_minmax(0,1fr)_auto] @2xl:items-end"
    >
      <AdminField label="Note type">
        <SelectField
          name="noteType"
          required
          value={noteType}
          onChange={(event) => setNoteType(event.target.value)}
        >
          {PILOT_NOTE_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </SelectField>
      </AdminField>
      <AdminField
        label="Setup check minutes"
        helper="Optional for self-service launch checks."
      >
        <Input
          name="setupMinutes"
          type="number"
          min={1}
          max={3}
          placeholder="1-3"
        />
      </AdminField>
      <AdminField label="Notes" className="sm:col-span-2 @2xl:col-span-1">
        <Textarea
          name="notes"
          required
          minLength={4}
          rows={2}
          placeholder={pilotNotePlaceholder(noteType)}
        />
      </AdminField>
      <SubmitButton
        pendingLabel="Saving…"
        className="justify-self-start sm:col-span-2 @2xl:col-span-1"
      >
        <Icon icon={CheckmarkCircle02Icon} size={16} />
        Save note
      </SubmitButton>
    </div>
  )
}
