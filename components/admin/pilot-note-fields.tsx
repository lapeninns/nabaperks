"use client"

import { useState } from "react"
import { CheckmarkCircle02Icon } from "@hugeicons/core-free-icons"

import { Icon } from "@/components/brand"
import { AdminField, adminSelectClasses } from "@/components/admin/support"
import { SubmitButton } from "@/components/forms"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  PILOT_NOTE_TYPES,
  pilotNotePlaceholder,
} from "@/lib/admin/pilot-note-templates"

/**
 * The pilot-note fields, extracted so the notes placeholder can follow the
 * selected note type. The placeholder is a scaffold only — the operator still
 * types the note, so no audit justification is ever prefilled as a value.
 */
export function PilotNoteFields() {
  const [noteType, setNoteType] = useState("support")

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[220px_160px_minmax(0,1fr)_auto]">
      <AdminField label="Note type">
        <select
          name="noteType"
          required
          className={adminSelectClasses}
          value={noteType}
          onChange={(event) => setNoteType(event.target.value)}
        >
          {PILOT_NOTE_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
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
      <AdminField label="Notes" className="sm:col-span-2 xl:col-span-1">
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
        className="justify-self-start sm:col-span-2 xl:col-span-1 xl:self-end"
      >
        <Icon icon={CheckmarkCircle02Icon} size={16} />
        Save note
      </SubmitButton>
    </div>
  )
}
