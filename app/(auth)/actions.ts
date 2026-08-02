"use server"

import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"

import { recordMerchantFunnelEventSafely } from "@/lib/analytics/funnel-events"
import {
  finalizeMerchantEmailOtpAlias,
  merchantEmailOtpAliasDigitLabel,
  merchantEmailOtpAliasLength,
  releaseMerchantEmailOtpAlias,
  reserveMerchantEmailOtpAlias,
  type MerchantEmailOtpPurpose,
} from "@/lib/auth/merchant-email-otp-alias"
import {
  type MerchantOtpActionContext,
  type MerchantOtpActionState,
  type MerchantOtpOutcome,
} from "@/lib/auth/merchant-auth-action-state"
import { runMerchantOtpProviderVerification } from "@/lib/auth/merchant-email-otp-provider"
import { cleanupFailedMerchantRecoverySession } from "@/lib/auth/merchant-recovery-session-cleanup"
import {
  enforceInitialSignupRecipientBudget,
  enforceMerchantOtpResend,
  MerchantOtpResendRateLimitError,
  recordInitialSignupOtpCooldown,
} from "@/lib/auth/merchant-otp-resend"
import { merchantSignupVerifyHref } from "@/lib/navigation/merchant-auth-hrefs"
import { safeMerchantNextPath } from "@/lib/navigation/safe-next-path"
import {
  enforceRateLimit,
  peekRateLimit,
  RateLimitError,
  rateLimitIdentityFromHeaders,
} from "@/lib/security/rate-limit"
import { validateConfirmPassword, validatePassword } from "@/lib/auth/password"
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server"

export type AuthActionState = {
  fields?: {
    name?: string
    email?: string
    next?: string
  }
  errors?: {
    name?: string
    email?: string
    password?: string
    confirmPassword?: string
    otp?: string
    form?: string
  }
  outcome?: "verification_required"
}

type AuthMode = "sign-in" | "sign-up"

type AuthRateLimitScope =
  "merchant-signup" | "merchant-signin" | "merchant-verify"

function value(formData: FormData, key: string) {
  const raw = formData.get(key)
  return typeof raw === "string" ? raw.trim() : ""
}

// Passwords are used verbatim; never trim (leading/trailing characters count).
function passwordValue(formData: FormData, key: string) {
  const raw = formData.get(key)
  return typeof raw === "string" ? raw : ""
}

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function otpPattern() {
  return new RegExp(`^\\d{${merchantEmailOtpAliasLength()}}$`)
}

export async function signUpAction(
  _state: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const name = value(formData, "name")
  const email = value(formData, "email").toLowerCase()
  const next = safeMerchantNextPath(
    value(formData, "next") || defaultNextPath("sign-up"),
    defaultNextPath("sign-up")
  )
  const errors: NonNullable<AuthActionState["errors"]> = {}

  const password = passwordValue(formData, "password")
  const confirmPassword = passwordValue(formData, "confirmPassword")

  if (name.length < 2) errors.name = "Enter your name."
  if (!validateEmail(email)) errors.email = "Enter a valid email address."
  const passwordError = validatePassword(password)
  if (passwordError) errors.password = passwordError
  else {
    const confirmError = validateConfirmPassword(password, confirmPassword)
    if (confirmError) errors.confirmPassword = confirmError
  }

  if (Object.keys(errors).length) {
    return { fields: { name, email, next }, errors }
  }

  const rateLimitResult = await enforceAuthRateLimit("merchant-signup", email)
  if (rateLimitResult)
    return {
      fields: { name, email, next },
      errors: { form: rateLimitResult.message },
    }

  // Signing up sends an email, so the mailbox budget must be charged BEFORE
  // the provider call — rotating source IPs otherwise bought one free send per
  // address each time.
  try {
    await enforceInitialSignupRecipientBudget({
      email,
      purpose: "signup",
      requestIdentity: await merchantRequestIdentity(),
    })
  } catch (error) {
    if (error instanceof MerchantOtpResendRateLimitError) {
      return {
        fields: { name, email, next },
        errors: { form: rateLimitMessage("merchant-signup") },
      }
    }
    throw error
  }

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name },
    },
  })

  if (error) {
    // House copy only — raw provider messages never reach merchants.
    return {
      fields: { name, email, next },
      errors: {
        form: "Could not create the account just now. Check your details and try again.",
      },
    }
  }

  // With email-confirmation enabled Supabase deliberately returns an
  // obfuscated success for an existing account. A real new identity carries
  // at least one identity row; do not turn the anti-enumeration response into
  // a false account-created milestone.
  if (data.user?.identities && data.user.identities.length > 0) {
    recordMerchantFunnelEventSafely({
      actorId: data.user.id,
      event: "merchant_account_created",
      funnelToken: value(formData, "funnelToken") || undefined,
    })
  }

  try {
    await recordInitialSignupOtpCooldown({
      email,
      purpose: "signup",
      requestIdentity: await merchantRequestIdentity(),
    })
  } catch (error) {
    // The provider already accepted the signup request. Delivery may still be
    // enumeration-neutral, so a limiter readback failure is not an account error.
    console.error("Merchant signup OTP cooldown record failed", {
      error: safeServerErrorMessage(error),
    })
  }

  redirect(merchantSignupVerifyHref({ email, name, next }))
}

export async function signupOtpAction(
  _state: MerchantOtpActionState,
  formData: FormData
): Promise<MerchantOtpActionState> {
  const context = merchantOtpContext(formData, "signup")
  const intent = value(formData, "intent")

  if (intent === "verify") {
    return verifySignupOtp(context, formData)
  }
  if (intent === "resend") {
    return sendMerchantOtp({
      context,
      funnelToken: value(formData, "funnelToken") || undefined,
      redirectToVerify: value(formData, "source") === "login",
    })
  }

  return invalidOtpIntentState(context)
}

export async function signInAction(
  _state: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = value(formData, "email").toLowerCase()
  const password = passwordValue(formData, "password")
  const next = safeMerchantNextPath(
    value(formData, "next") || defaultNextPath("sign-in")
  )
  const errors: NonNullable<AuthActionState["errors"]> = {}

  if (!validateEmail(email)) errors.email = "Enter a valid email address."
  if (!password) errors.password = "Enter your password."

  if (Object.keys(errors).length) {
    return { fields: { email, next }, errors }
  }

  const rateLimitResult = await enforceAuthRateLimit("merchant-signin", email)
  if (rateLimitResult) {
    return {
      fields: { email, next },
      errors: { form: rateLimitResult.message },
    }
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    if (error.code === "email_not_confirmed") {
      // The explicit outcome lets the form render a direct fresh-code POST
      // instead of sending the merchant through signup again.
      return {
        fields: { email, next },
        outcome: "verification_required",
        errors: {
          form: "Verify your email first — get a fresh code and finish verification.",
        },
      }
    }

    return {
      fields: { email, next },
      errors: { form: "That email or password is not right." },
    }
  }

  redirect(safeMerchantNextPath(next))
}

export async function passwordResetAction(
  _state: MerchantOtpActionState,
  formData: FormData
): Promise<MerchantOtpActionState> {
  const intent = value(formData, "intent")
  const context = merchantOtpContext(
    formData,
    "recovery",
    intent === "request" ? "request" : "verify"
  )

  if (intent === "request" || intent === "resend") {
    return sendMerchantOtp({ context })
  }
  if (intent === "confirm") {
    return confirmMerchantPasswordReset(context, formData)
  }

  return invalidOtpIntentState(context)
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  redirect("/login")
}

async function verifySignupOtp(
  context: MerchantOtpActionContext,
  formData: FormData
): Promise<MerchantOtpActionState> {
  const otp = value(formData, "otp").replace(/\s+/g, "")
  const errors: { form?: string; otp?: string } = {}

  if (!validateEmail(context.email)) {
    errors.form = "Request a fresh email code."
  }
  if (!otpPattern().test(otp)) {
    errors.otp = `Enter the ${merchantEmailOtpAliasDigitLabel()} code from your email.`
  }
  if (Object.keys(errors).length) {
    return { outcome: "invalid", context, errors }
  }

  const rateLimit = await enforceAuthRateLimit("merchant-verify", context.email)
  if (rateLimit) return merchantOtpRateLimitState(context, rateLimit)

  const supabase = await createSupabaseServerClient()
  const verification = await verifyMerchantEmailOtpAlias({
    aliasCode: otp,
    email: context.email,
    purpose: "signup",
    supabase,
    type: "signup",
  })

  if (verification.status === "error") {
    return merchantOtpVerificationErrorState(context, verification)
  }

  recordMerchantFunnelEventSafely({
    actorId: verification.userId,
    event: "merchant_email_verified",
    funnelToken: value(formData, "funnelToken") || undefined,
  })

  redirect(context.next)
}

async function confirmMerchantPasswordReset(
  context: MerchantOtpActionContext,
  formData: FormData
): Promise<MerchantOtpActionState> {
  const otp = value(formData, "otp").replace(/\s+/g, "")
  const password = passwordValue(formData, "password")
  const confirmPassword = passwordValue(formData, "confirmPassword")
  const errors: {
    form?: string
    otp?: string
    password?: string
    confirmPassword?: string
  } = {}

  if (!validateEmail(context.email)) {
    errors.form = "Request a fresh reset code."
  }
  if (!otpPattern().test(otp)) {
    errors.otp = `Enter the ${merchantEmailOtpAliasDigitLabel()} code from your email.`
  }
  const passwordError = validatePassword(password)
  if (passwordError) errors.password = passwordError
  else {
    const confirmError = validateConfirmPassword(password, confirmPassword)
    if (confirmError) errors.confirmPassword = confirmError
  }

  if (Object.keys(errors).length) {
    return { outcome: "invalid", context, errors }
  }

  const rateLimit = await enforceAuthRateLimit("merchant-verify", context.email)
  if (rateLimit) return merchantOtpRateLimitState(context, rateLimit)

  const supabase = await createSupabaseServerClient()
  const verification = await verifyMerchantEmailOtpAlias({
    aliasCode: otp,
    email: context.email,
    purpose: "recovery",
    supabase,
    type: "recovery",
  })

  if (verification.status === "error") {
    return merchantOtpVerificationErrorState(context, verification)
  }

  let updateError: unknown
  try {
    const updateResult = await supabase.auth.updateUser({ password })
    updateError = updateResult.error
  } catch (error) {
    updateError = error
  }

  if (updateError) {
    console.error("Merchant recovery password update failed", {
      error: safeServerErrorMessage(updateError),
    })
    await closeFailedMerchantRecoverySession(supabase, verification.accessToken)

    return {
      outcome: "password_update_failed",
      context,
      errors: {
        form: "Your email was verified, but we could not save that password. Send a fresh reset code before trying again.",
      },
    }
  }

  redirect(context.next)
}

async function sendMerchantOtp({
  context,
  funnelToken,
  redirectToVerify = false,
}: {
  context: MerchantOtpActionContext
  funnelToken?: string
  redirectToVerify?: boolean
}): Promise<MerchantOtpActionState> {
  const verifyContext = { ...context, step: "verify" as const }
  if (!validateEmail(context.email)) {
    return {
      outcome: "invalid",
      context,
      errors: { email: "Enter a valid email address." },
    }
  }

  let retryAt: string | undefined
  try {
    const limit = await enforceMerchantOtpResend({
      email: context.email,
      purpose: context.flow,
      requestIdentity: await merchantRequestIdentity(),
    })
    retryAt = limit.retryAt
  } catch (error) {
    if (error instanceof MerchantOtpResendRateLimitError) {
      return {
        outcome: "throttled",
        context,
        retryAt: error.retryAt,
        errors: {
          form: "Another code can be sent after the wait shown below.",
        },
      }
    }

    console.error("Merchant OTP resend limit failed", {
      error: safeServerErrorMessage(error),
      purpose: context.flow,
    })
    return context.step === "verify"
      ? {
          outcome: "verification_unavailable",
          context,
          errors: {
            form: "We could not start a fresh code send just now. Your current code is unchanged — try it, or request another code in a moment.",
          },
        }
      : {
          outcome: "verification_unavailable",
          context,
          errors: {
            form: "We could not start the reset email just now. No code was requested — try again in a moment.",
          },
        }
  }

  const supabase = await createSupabaseServerClient()
  let deliveryError: unknown
  try {
    const { error } =
      context.flow === "signup"
        ? await supabase.auth.resend({ type: "signup", email: context.email })
        : await supabase.auth.resetPasswordForEmail(context.email)
    deliveryError = error
  } catch (error) {
    deliveryError = error
  }

  if (deliveryError) {
    console.error("Merchant OTP provider send failed", {
      error: safeServerErrorMessage(deliveryError),
      purpose: context.flow,
    })
    return {
      outcome: "delivery_unavailable",
      context,
      retryAt,
      errors: {
        form: "We could not send a fresh code just now. No new code was delivered — wait for the resend timer, then try again.",
      },
    }
  }

  if (context.flow === "signup") {
    recordMerchantFunnelEventSafely({
      event: "merchant_otp_resent",
      funnelToken,
      occurrenceKey: retryAt ?? "provider-success",
    })
  }

  if (redirectToVerify && context.flow === "signup") {
    redirect(
      merchantSignupVerifyHref({
        email: context.email,
        name: context.name,
        next: context.next,
      })
    )
  }

  return {
    outcome: "sent",
    context: verifyContext,
    retryAt,
    message:
      context.flow === "signup"
        ? `If this email can receive a signup code, a fresh ${merchantEmailOtpAliasDigitLabel()} code may be on its way. If it arrives, earlier codes no longer work. Used this email before? Log in or reset your password.`
        : `If that email has a venue account, we sent a fresh ${merchantEmailOtpAliasDigitLabel()} reset code. Earlier codes no longer work.`,
  }
}

type MerchantOtpVerificationResult =
  | { status: "verified"; accessToken?: string; userId?: string }
  | {
      status: "error"
      outcome: Exclude<
        MerchantOtpOutcome,
        | "idle"
        | "sent"
        | "verification_required"
        | "password_update_failed"
        | "delivery_unavailable"
      >
      field: "form" | "otp"
      message: string
      retryAt?: string
    }

async function verifyMerchantEmailOtpAlias({
  aliasCode,
  email,
  purpose,
  supabase,
  type,
}: {
  aliasCode: string
  email: string
  purpose: MerchantEmailOtpPurpose
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
  type: "recovery" | "signup"
}): Promise<MerchantOtpVerificationResult> {
  let reservation: Awaited<ReturnType<typeof reserveMerchantEmailOtpAlias>>
  let verifiedAccessToken: string | undefined
  let verifiedUserId: string | undefined

  try {
    reservation = await reserveMerchantEmailOtpAlias({
      aliasCode,
      email,
      purpose,
    })
  } catch (error) {
    console.error("Merchant email alias reservation failed", {
      error: safeServerErrorMessage(error),
      purpose,
    })
    return {
      status: "error",
      outcome: "verification_unavailable",
      field: "form",
      message:
        "We could not check your code just now. Your code has not been used — try again.",
    }
  }

  if (reservation.status !== "reserved") {
    return merchantOtpReservationResult(reservation, purpose)
  }

  const providerOutcome = await runMerchantOtpProviderVerification({
    finalize: (outcome) =>
      finalizeMerchantEmailOtpAlias({
        outcome,
        reservationId: reservation.reservationId,
      }),
    onCleanupError: (stage, error) => {
      console.error("Merchant email alias cleanup failed", {
        error: error.message,
        purpose,
        stage,
      })
    },
    release: () =>
      releaseMerchantEmailOtpAlias({
        reservationId: reservation.reservationId,
      }),
    verify: async () => {
      const result = await supabase.auth.verifyOtp({
        email,
        token: reservation.supabaseToken,
        type,
      })
      if (!result.error) {
        verifiedAccessToken = result.data.session?.access_token
        verifiedUserId = result.data.user?.id
      }
      return result
    },
  })

  switch (providerOutcome) {
    case "verified":
      return {
        status: "verified",
        accessToken: verifiedAccessToken,
        userId: verifiedUserId,
      }
    case "retryable":
      return {
        status: "error",
        outcome: "verification_unavailable",
        field: "form",
        message:
          "We could not check your code just now. Your code is still safe to retry.",
      }
    case "expired":
      return {
        status: "error",
        outcome: "expired",
        field: "form",
        message: "That code has expired. Send a fresh code to continue.",
      }
    case "rejected":
      return {
        status: "error",
        outcome: "invalid",
        field: "otp",
        message:
          "That code does not match. Check all six digits and try again.",
      }
  }
}

function merchantOtpReservationResult(
  reservation: Exclude<
    Awaited<ReturnType<typeof reserveMerchantEmailOtpAlias>>,
    { status: "reserved" }
  >,
  purpose: MerchantEmailOtpPurpose
): MerchantOtpVerificationResult {
  switch (reservation.status) {
    case "expired":
      return {
        status: "error",
        outcome: "expired",
        field: "form",
        message: "That code has expired. Send a fresh code to continue.",
      }
    case "superseded":
      return {
        status: "error",
        outcome: "superseded",
        field: "form",
        message:
          "That code is from an earlier email. Use the latest code we sent or send a fresh one.",
      }
    case "used":
      return {
        status: "error",
        outcome: "used",
        field: "form",
        message:
          purpose === "signup"
            ? "That code has already been used. Log in, or send a fresh code if verification is still needed."
            : "That reset code has already been used. Send a fresh reset code.",
      }
    case "busy":
      return {
        status: "error",
        outcome: "busy",
        field: "form",
        retryAt: reservation.retryAt ?? undefined,
        message:
          "That code is already being checked. Keep it here and retry after the wait shown below.",
      }
    case "throttled":
      return {
        status: "error",
        outcome: "throttled",
        field: "form",
        retryAt: reservation.retryAt ?? undefined,
        message:
          "Too many code checks. Keep this page open and retry after the wait shown below.",
      }
    case "invalid":
    case "rejected":
      return {
        status: "error",
        outcome: "invalid",
        field: "otp",
        message:
          "That code does not match. Check all six digits and try again.",
      }
  }
}

function merchantOtpVerificationErrorState(
  context: MerchantOtpActionContext,
  result: Extract<MerchantOtpVerificationResult, { status: "error" }>
): MerchantOtpActionState {
  return {
    outcome: result.outcome,
    context,
    retryAt: result.retryAt,
    errors: { [result.field]: result.message },
  }
}

function merchantOtpRateLimitState(
  context: MerchantOtpActionContext,
  rateLimit: AuthRateLimitResult
): MerchantOtpActionState {
  if (rateLimit.unavailable) {
    return {
      outcome: "verification_unavailable",
      context,
      errors: { form: rateLimit.message },
    }
  }

  return {
    outcome: "throttled",
    context,
    retryAt: rateLimit.retryAt,
    errors: { form: rateLimit.message },
  }
}

function merchantOtpContext(
  formData: FormData,
  flow: MerchantOtpActionContext["flow"],
  step: MerchantOtpActionContext["step"] = "verify"
): MerchantOtpActionContext {
  const fallback = flow === "signup" ? "/app/onboarding" : "/app"
  const name = value(formData, "name")

  return {
    flow,
    step,
    email: value(formData, "email").toLowerCase(),
    ...(name ? { name } : {}),
    next: safeMerchantNextPath(value(formData, "next") || fallback, fallback),
  }
}

function invalidOtpIntentState(
  context: MerchantOtpActionContext
): MerchantOtpActionState {
  return {
    outcome: "invalid",
    context,
    errors: { form: "Choose a valid email-code action and try again." },
  }
}

async function closeFailedMerchantRecoverySession(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  accessToken: string | undefined
): Promise<void> {
  await cleanupFailedMerchantRecoverySession(accessToken, {
    signOutLocal: () => supabase.auth.signOut({ scope: "local" }),
    signOutAdminLocal: (token) => {
      const serviceRole = createSupabaseServiceRoleClient()
      return serviceRole.auth.admin.signOut(token, "local")
    },
    clearBrowserCredentials: async () => {
      const cookieStore = await cookies()
      for (const cookie of cookieStore.getAll()) {
        if (merchantAuthCookieName(cookie.name)) cookieStore.delete(cookie.name)
      }
    },
    onSafeFailure: (failure) => {
      console.error("Merchant recovery session cleanup incomplete", failure)
    },
  })
}

function merchantAuthCookieName(name: string): boolean {
  return /^sb-.+-auth-token(?:-code-verifier|\.\d+)?$/.test(name)
}

function safeServerErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown server error"
}

type AuthRateLimitResult = {
  message: string
  retryAt?: string
  unavailable?: boolean
}

async function enforceAuthRateLimit(
  scope: AuthRateLimitScope,
  email: string
): Promise<AuthRateLimitResult | null> {
  const requestIdentity = await merchantRequestIdentity()
  const config = {
    key: `${scope}:${email}:${requestIdentity}`,
    limit: scope === "merchant-signup" ? 3 : 5,
    windowMs: 15 * 60_000,
  }

  try {
    await enforceRateLimit(config)
    return null
  } catch (error) {
    if (error instanceof RateLimitError) {
      let retryAt: string | undefined
      try {
        retryAt = (await peekRateLimit(config)).resetAt ?? undefined
      } catch (readbackError) {
        console.error("Merchant auth rate-limit readback failed", {
          error: safeServerErrorMessage(readbackError),
          scope,
        })
        return {
          unavailable: true,
          message: rateLimitUnavailableMessage(scope),
        }
      }

      return { message: rateLimitMessage(scope), retryAt }
    }

    console.error("Merchant auth rate-limit enforcement failed", {
      error: safeServerErrorMessage(error),
      scope,
    })
    return {
      unavailable: true,
      message: rateLimitUnavailableMessage(scope),
    }
  }
}

async function merchantRequestIdentity() {
  return rateLimitIdentityFromHeaders(await headers())
}

function defaultNextPath(mode: AuthMode): string {
  return mode === "sign-up" ? "/app/onboarding" : "/app"
}

function rateLimitMessage(scope: AuthRateLimitScope): string {
  switch (scope) {
    case "merchant-signup":
      return "Too many sign-up attempts. Try again later."
    case "merchant-signin":
      return "Too many sign-in attempts. Try again later."
    case "merchant-verify":
      return "Too many code checks. Try again later."
  }
}

function rateLimitUnavailableMessage(scope: AuthRateLimitScope): string {
  switch (scope) {
    case "merchant-signup":
      return "We could not start your account just now. Your details are still here — try again."
    case "merchant-signin":
      return "We could not check your login just now. Your details are still here — try again."
    case "merchant-verify":
      return "We could not check your code just now. Your code has not been used — try again."
  }
}
