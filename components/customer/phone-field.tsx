"use client"

import type { ReactNode } from "react"

import { customerInputClass } from "@/components/customer/input-class"

/**
 * PhoneField — the one UK phone entry control in the customer funnel.
 *
 * Join and login asked for the same number for the same reason but differed in
 * three ways: autoFocus, the hint copy, and — the one that mattered — whether
 * the inline error announced. Join's error was a plain `<p>`, so a screen
 * reader stayed silent on it until the field was re-focused, while login's
 * carried `role="alert"`.
 *
 * `role="alert"` is now unconditional. The `hint` stays a prop because the two
 * are deliberately different messages (login sets expectations about the code
 * arriving, join explains that the card stays linked to the number) — that is a
 * copy decision, not drift, so this unifies behaviour without flattening voice.
 */
export function PhoneField({
  hint,
  error,
  defaultValue,
  autoFocus = true,
  label = "UK phone number",
  className,
}: {
  readonly hint: ReactNode
  readonly error?: string
  readonly defaultValue?: string
  readonly autoFocus?: boolean
  readonly label?: string
  /** Wrapper classes. Login hides the field once the code has been sent. */
  readonly className?: string
}) {
  return (
    <div className={className ?? "grid gap-2"}>
      <label htmlFor="contact" className="eyebrow">
        {label}
      </label>
      <input
        id="contact"
        name="contact"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        autoFocus={autoFocus}
        placeholder="07400 123456"
        defaultValue={defaultValue}
        className={customerInputClass}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? "contact-error" : "contact-hint"}
        onFocus={(event) =>
          event.currentTarget.scrollIntoView({ block: "center" })
        }
      />
      {error ? (
        // role="alert" so the inline error announces on arrival; described-by
        // alone stays silent until the field is re-focused.
        <p id="contact-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : (
        <p
          id="contact-hint"
          className="text-xs leading-5 text-muted-foreground"
        >
          {hint}
        </p>
      )}
    </div>
  )
}
