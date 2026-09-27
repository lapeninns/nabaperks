"use client"

import Link from "next/link"
import {
  useEffect,
  useRef,
  useSyncExternalStore,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react"

import type { JoinContactMethod } from "@/lib/customer/experience/types"

/**
 * Which contact method a join screen leads with (D12).
 *
 * The server decides the default from the rollout mode: email first in `full`,
 * phone first in `existing`. A device that has verified before remembers the
 * method that worked in local storage and leads with it next time. This is a
 * convenience only: it reorders the screen and never decides who a customer
 * is, so a missing, cleared or blocked store simply falls back to the server
 * default. The server snapshot is that default, so hydration always agrees
 * with the server render and a stored preference applies on the client.
 */
export const LAST_CONTACT_METHOD_KEY = "nabaperks.last-contact-method"

const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  // Another tab verifying updates this one too.
  const onStorage = (event: StorageEvent) => {
    if (event.key === LAST_CONTACT_METHOD_KEY) listener()
  }
  window.addEventListener("storage", onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", onStorage)
  }
}

function readStoredContactMethod(): JoinContactMethod | null {
  try {
    return parseContactMethod(
      window.localStorage.getItem(LAST_CONTACT_METHOD_KEY)
    )
  } catch {
    return null
  }
}

function parseContactMethod(raw: string | null): JoinContactMethod | null {
  return raw === "email" || raw === "phone" ? raw : null
}

/**
 * The method a screen leads with, given what this device stored. Anything but
 * a known method, or a screen that may not be reordered, keeps the default.
 */
export function leadContactMethod(
  stored: string | null,
  serverDefault: JoinContactMethod,
  overridable: boolean
): JoinContactMethod {
  if (!overridable) return serverDefault
  return parseContactMethod(stored) ?? serverDefault
}

function writeStoredContactMethod(method: JoinContactMethod | null) {
  try {
    if (method) window.localStorage.setItem(LAST_CONTACT_METHOD_KEY, method)
    else window.localStorage.removeItem(LAST_CONTACT_METHOD_KEY)
  } catch {
    // Storage can be unavailable; the screen keeps the server default.
  }
  for (const listener of listeners) listener()
}

/**
 * The method to lead with: the server default, or this device's last verified
 * method when the screen may be reordered. A method the customer asked for in
 * the address (`step=email|phone`) is never overridden.
 */
function useLeadContactMethod(
  serverDefault: JoinContactMethod,
  overridable: boolean
): JoinContactMethod {
  return useSyncExternalStore(
    subscribe,
    () =>
      leadContactMethod(readStoredContactMethod(), serverDefault, overridable),
    () => serverDefault
  )
}

/**
 * Shows one of two complete contact screens, email or phone, leading with the
 * device's last verified method. Both are rendered on the server so no
 * navigation is needed; the other method is always one visible link away
 * inside each screen.
 */
export function ContactMethodOrder({
  defaultMethod,
  email,
  phone,
}: {
  defaultMethod: JoinContactMethod
  email: ReactNode
  phone: ReactNode
}) {
  const lead = useLeadContactMethod(defaultMethod, true)
  return lead === "email" ? email : phone
}

/**
 * A link to the contact step this device should lead with. The welcome CTA
 * uses it so a returning device opens the method it verified with before.
 */
export function ContactStepLink({
  defaultMethod,
  overridable,
  emailHref,
  phoneHref,
  children,
  ...rest
}: Omit<ComponentPropsWithoutRef<typeof Link>, "href"> & {
  defaultMethod: JoinContactMethod
  overridable: boolean
  emailHref: string
  phoneHref: string
  children: ReactNode
}) {
  const lead = useLeadContactMethod(defaultMethod, overridable)
  return (
    <Link {...rest} href={lead === "email" ? emailHref : phoneHref}>
      {children}
    </Link>
  )
}

/**
 * The stored method as it was when a code check was submitted, so it can be
 * put back if that check does not end in a signed-in wallet. Module state
 * survives the client-side navigation a server action's redirect makes.
 */
let beforeVerify: {
  readonly method: JoinContactMethod
  readonly previous: JoinContactMethod | null
} | null = null

/** Records `method` as the form submits, remembering what it replaced. */
export function rememberContactMethodOnSubmit(method: JoinContactMethod): void {
  beforeVerify = { method, previous: readStoredContactMethod() }
  writeStoredContactMethod(method)
}

/**
 * The check answered in place instead of redirecting: a wrong code, a limit,
 * or a verified contact that holds no wallet. None signed anyone in, so the
 * stored method goes back to what it was.
 */
export function restoreContactMethodAfterAnswer(): void {
  if (!beforeVerify) return
  writeStoredContactMethod(beforeVerify.previous)
  beforeVerify = null
}

/**
 * A check for `method` redirected to a screen that signed no one in (the
 * email choice screen: confirmed, but no wallet holds it). The stored method
 * goes back to what it was; the choice itself records email if it starts a
 * wallet.
 */
export function restoreContactMethodAfterNoWallet(
  method: JoinContactMethod
): void {
  if (beforeVerify?.method !== method) return
  restoreContactMethodAfterAnswer()
}

/**
 * Remembers `method` when a code check signs a wallet in. The verify actions
 * redirect on success and answer in place otherwise, so the method is
 * recorded as the form submits and put back as it was if the action answers.
 * A redirect unmounts the form and the new value stays, except on the email
 * choice screen, which puts it back itself (`useRestoreContactMethodOnNoWallet`).
 *
 * Returns the form's `onSubmit` handler.
 */
export function useRememberContactMethodOnVerify(
  method: JoinContactMethod,
  state: object
): () => void {
  const submitted = useRef(false)

  useEffect(() => {
    if (!submitted.current) return
    submitted.current = false
    restoreContactMethodAfterAnswer()
  }, [state])

  return () => {
    submitted.current = true
    rememberContactMethodOnSubmit(method)
  }
}

/** For a screen a code check reaches without signing anyone in. */
export function useRestoreContactMethodOnNoWallet(
  method: JoinContactMethod
): void {
  useEffect(() => {
    restoreContactMethodAfterNoWallet(method)
  }, [method])
}
