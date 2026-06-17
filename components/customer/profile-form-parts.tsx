"use client"

import type { ReactNode } from "react"

import { MonoTag } from "@/components/brand"
import { customerInputClass } from "@/components/customer/input-class"

export const profileInputClass = `${customerInputClass} aria-invalid:border-destructive`

export type ProfileEmailState = {
  email: string | null
  emailVerified: boolean
}

export function ProfileEmailDetailRow({
  profile,
}: {
  profile: ProfileEmailState
}) {
  if (!profile.email) {
    return <ProfileDetailRow label="Email" value="Not added" />
  }

  if (profile.emailVerified) {
    return (
      <ProfileDetailRow
        label="Email"
        value={profile.email}
        tag={<MonoTag tone="leaf">Verified</MonoTag>}
      />
    )
  }

  return (
    <ProfileDetailRow
      label="Email"
      value={profile.email}
      tag={<MonoTag tone="sun">Awaiting</MonoTag>}
    />
  )
}

export function ProfileDetailRow({
  label,
  value,
  tag,
}: {
  label: string
  value: string
  tag?: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="flex items-center gap-2 text-right text-sm font-bold break-all">
        <span>{value}</span>
        {tag}
      </dd>
    </div>
  )
}

export function ProfileField({
  label,
  name,
  error,
  hint,
  type = "text",
  ...rest
}: {
  label: string
  name: string
  error?: string
  hint?: string
  type?: string
  defaultValue?: string
  autoComplete?: string
  inputMode?: "email" | "numeric"
}) {
  const describedBy = error
    ? `${name}-error`
    : hint
      ? `${name}-hint`
      : undefined

  return (
    <div className="grid gap-2">
      <label htmlFor={name} className="eyebrow">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        className={profileInputClass}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        {...rest}
      />
      {error ? (
        <p id={`${name}-error`} className="text-sm text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p
          id={`${name}-hint`}
          className="text-xs leading-5 text-muted-foreground"
        >
          {hint}
        </p>
      ) : null}
    </div>
  )
}
