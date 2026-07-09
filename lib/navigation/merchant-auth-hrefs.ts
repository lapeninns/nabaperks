import { safeMerchantNextPath } from "@/lib/navigation/safe-next-path"

type MerchantAuthHrefContext = {
  readonly email?: string
  readonly name?: string
  readonly next?: string
}

export function merchantSignupHref({
  email,
  name,
  next,
}: MerchantAuthHrefContext = {}): string {
  return authHref("/signup", {
    email,
    name,
    next: safeOptionalNext(next, "/app/onboarding"),
  })
}

export function merchantSignupVerifyHref({
  email,
  name,
  next,
}: {
  readonly email: string
  readonly name?: string
  readonly next?: string
}): string {
  return authHref("/signup/verify", {
    email,
    name,
    next: safeOptionalNext(next, "/app/onboarding"),
  })
}

export function merchantLoginHref({
  email,
  error,
  next,
}: {
  readonly email?: string
  readonly error?: "verification"
  readonly next?: string
} = {}): string {
  return authHref("/login", {
    email,
    error,
    next: safeOptionalNext(next, "/app"),
  })
}

export function merchantPasswordResetHref({
  email,
  next,
}: Pick<MerchantAuthHrefContext, "email" | "next"> = {}): string {
  return authHref("/reset-password", {
    email,
    next: safeOptionalNext(next, "/app"),
  })
}

export function merchantPasswordResetVerifyHref({
  email,
  next,
}: {
  readonly email: string
  readonly next?: string
}): string {
  return authHref("/reset-password", {
    email,
    next: safeOptionalNext(next, "/app"),
    stage: "verify",
  })
}

function authHref(
  pathname: string,
  values: Record<string, string | undefined>
) {
  const params = new URLSearchParams()
  for (const [key, candidate] of Object.entries(values)) {
    const value = candidate?.trim()
    if (value) params.set(key, value)
  }

  const query = params.toString()
  return query ? `${pathname}?${query}` : pathname
}

function safeOptionalNext(next: string | undefined, fallback: string) {
  return next ? safeMerchantNextPath(next, fallback) : undefined
}
