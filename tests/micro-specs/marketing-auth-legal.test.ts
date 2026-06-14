import { readFileSync } from "node:fs"
import { describe, expect, it, vi } from "vitest"

import { createSupabaseMock } from "../helpers/supabase"

function readProjectFile(path: string) {
  return readFileSync(path, "utf8")
}

function form(values: Record<string, string>) {
  const data = new FormData()

  for (const [key, value] of Object.entries(values)) {
    data.set(key, value)
  }

  return data
}

function redirectMock() {
  return vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  })
}

async function captureErrorMessage(action: () => Promise<unknown>) {
  try {
    await action()
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }

  throw new Error("Expected action to fail")
}

describe("02 marketing auth and legal redesign micro-specs", () => {
  it("keeps marketing routes composed through MarketingLayout with semantic journeys", () => {
    const home = readProjectFile("app/page.tsx")
    const pricing = readProjectFile("app/pricing/page.tsx")
    const login = readProjectFile("app/(auth)/login/page.tsx")
    const signup = readProjectFile("app/(auth)/signup/page.tsx")
    const terms = readProjectFile("app/terms/page.tsx")
    const privacy = readProjectFile("app/privacy/page.tsx")
    const marketingLayout = readProjectFile("components/layout/marketing-layout.tsx")

    for (const source of [home, pricing, login, signup, terms, privacy]) {
      expect(source).toContain("MarketingLayout")
    }

    expect(marketingLayout).toContain('href: "/pricing"')
    expect(marketingLayout).toContain('href: "/login"')
    expect(marketingLayout).toContain('href="/signup"')
    expect(marketingLayout).toContain('href="/terms"')
    expect(marketingLayout).toContain('href="/privacy"')

    expect(home).toContain('href="/signup"')
    expect(home).toContain('href="/pricing"')
    expect(home).toContain('href="/login"')
  })

  it("communicates the no-app QR loyalty homepage flow with static labels and scanner-safe framing", () => {
    const home = readProjectFile("app/page.tsx")

    for (const text of [
      "No-app loyalty",
      "browser-based loyalty card",
      "Scan",
      "Join",
      "Stamp",
      "Reward",
      "QrFrame",
      "StampGrid",
      "motion-reduce:animate-none",
    ]) {
      expect(home).toContain(text)
    }

    expect(home).toContain("Start a merchant trial")
    expect(home).toContain("View pricing")
    expect(home).toContain("Merchant login")
  })

  it("preserves pricing checkout and account creation contracts", () => {
    const pricing = readProjectFile("app/pricing/page.tsx")
    const billingAction = readProjectFile("app/app/billing/actions.ts")

    expect(pricing).toContain("Growth Plan")
    expect(pricing).toContain("30-day free pilot")
    expect(pricing).toContain("GBP 29/month")
    expect(pricing).toContain("action={startCheckoutAction}")
    expect(pricing).toContain('href="/signup"')
    expect(pricing).toContain("Create account")

    expect(billingAction).toContain("trial_period_days: 30")
    expect(billingAction).toContain("STRIPE_GROWTH_PRICE_ID")
    expect(billingAction).toContain('plan: "growth"')
    expect(billingAction).toContain("/app/billing?checkout=success")
    expect(billingAction).toContain("/app/billing?checkout=cancelled")
  })

  it("preserves auth form field names, hidden next, and account navigation", () => {
    const authForm = readProjectFile("components/auth/auth-form.tsx")
    const login = readProjectFile("app/(auth)/login/page.tsx")
    const signup = readProjectFile("app/(auth)/signup/page.tsx")

    for (const fieldName of [
      'name="name"',
      'name="email"',
      'name="password"',
      'name="next"',
    ]) {
      expect(authForm).toContain(fieldName)
    }

    expect(authForm).toContain('href={isSignUp ? "/login" : "/signup"}')
    expect(authForm).toContain("inline-flex min-h-11 items-center")
    expect(authForm).toContain("focus-visible:ring-3")
    expect(login).toContain("next={params.next}")
    expect(login).toContain("Verification link could not be used")
    expect(signup).toContain("mode=\"sign-up\"")
    expect(signup).toContain("/auth/confirm")
  })

  it("keeps legal topic coverage, review caveats, TOCs, and cross-links", () => {
    const terms = readProjectFile("app/terms/page.tsx")
    const privacy = readProjectFile("app/privacy/page.tsx")
    const legalContent = readProjectFile("lib/legal/content.ts")

    for (const required of [
      "Participation",
      "Merchant-controlled reward terms",
      "Optional marketing opt-in",
      "Abuse and fraud prevention",
      "Availability restrictions",
    ]) {
      expect(legalContent).toContain(required)
    }

    for (const required of [
      "Review required",
      'href="/privacy"',
      "Terms sections",
      "PLATFORM_TERMS_SECTIONS",
    ]) {
      expect(terms).toContain(required)
    }

    for (const required of [
      "Data collected",
      "Purposes",
      "Marketing consent separation",
      "Sharing, scoping, and support access",
      "Data requests",
      "Audit and support records",
    ]) {
      expect(legalContent).toContain(required)
    }

    for (const required of [
      "Review required",
      'href="/terms"',
      "Privacy sections",
      "PRIVACY_SECTIONS",
    ]) {
      expect(privacy).toContain(required)
    }
  })

  it("keeps mobile marketing navigation contained and legal links touch-safe", () => {
    const marketingLayout = readProjectFile("components/layout/marketing-layout.tsx")
    const terms = readProjectFile("app/terms/page.tsx")
    const privacy = readProjectFile("app/privacy/page.tsx")

    for (const required of [
      "overflow-x-clip",
      "grid-cols-[auto_minmax(0,1fr)]",
      "flex-wrap",
      "hidden min-[430px]:inline-flex",
      "min-[430px]:hidden",
      'href="/signup"',
      "min-h-11 items-center rounded-full px-3",
    ]) {
      expect(marketingLayout).toContain(required)
    }

    expect(marketingLayout).toContain('href="/terms"')
    expect(marketingLayout).toContain('href="/privacy"')

    for (const source of [terms, privacy]) {
      expect(source).toContain("inline-flex min-h-11 items-center")
      expect(source).toContain("focus-visible:ring-3")
    }
  })

  it("uses the own-origin verification path and safe relative auth redirects", async () => {
    vi.resetModules()
    const signUp = vi.fn(async () => ({
      data: { session: null },
      error: null,
    }))
    vi.doMock("@/lib/env/server", () => ({
      getServerEnv: vi.fn(() => ({
        NEXT_PUBLIC_APP_URL: "https://nabaperks.test",
      })),
    }))
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: vi.fn(async () => ({
        auth: { signUp },
      })),
    }))
    const { signUpAction } = await import("@/app/(auth)/actions")

    await expect(
      signUpAction(
        {},
        form({
          name: "Ada Merchant",
          email: "ada@example.test",
          password: "correct-horse",
          next: "https://evil.test/app",
        })
      )
    ).resolves.toEqual({
      fields: { name: "Ada Merchant", email: "ada@example.test" },
      message: "Check your email to verify your account, then continue setup.",
    })

    expect(signUp).toHaveBeenCalledWith({
      email: "ada@example.test",
      password: "correct-horse",
      options: {
        data: { name: "Ada Merchant" },
        emailRedirectTo:
          "https://nabaperks.test/auth/confirm?next=/app/onboarding",
      },
    })

    const confirmRoute = readProjectFile("app/auth/confirm/route.ts")
    expect(confirmRoute).toContain("new URL(next, origin)")
    expect(confirmRoute).toContain("url.origin !== origin")
    expect(confirmRoute).toContain('"/login?error=verification"')
  })

  it("keeps auth confirm redirects on the request origin", async () => {
    vi.resetModules()
    const exchangeCodeForSession = vi.fn(async () => ({ error: null }))
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseRouteHandlerClient: vi.fn(() => ({
        auth: { exchangeCodeForSession },
      })),
    }))
    const { GET } = await import("@/app/auth/confirm/route")

    const backslashResponse = await GET(
      new Request(
        "https://nabaperks.test/auth/confirm?code=ok&next=/%5Cevil.test/app"
      ) as never
    )
    expect(backslashResponse.headers.get("Location")).toBe(
      "https://nabaperks.test/app/onboarding"
    )

    const validResponse = await GET(
      new Request(
        `https://nabaperks.test/auth/confirm?code=ok&next=${encodeURIComponent(
          "/app/qr?created=1"
        )}`
      ) as never
    )
    expect(validResponse.headers.get("Location")).toBe(
      "https://nabaperks.test/app/qr?created=1"
    )
  })

  it("keeps sign-in next redirects relative-only after valid credentials", async () => {
    vi.resetModules()
    const redirect = redirectMock()
    const signInWithPassword = vi.fn(async () => ({ error: null }))
    vi.doMock("next/navigation", () => ({ redirect }))
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: vi.fn(async () => ({
        auth: { signInWithPassword },
      })),
    }))
    const { signInAction } = await import("@/app/(auth)/actions")

    await expect(
      signInAction(
        {},
        form({
          email: "merchant@example.test",
          password: "password123",
          next: "https://evil.test/app",
        })
      )
    ).rejects.toThrow("NEXT_REDIRECT:/app")

    await expect(
      signInAction(
        {},
        form({
          email: "merchant@example.test",
          password: "password123",
          next: "/\\evil.test/app",
        })
      )
    ).rejects.toThrow("NEXT_REDIRECT:/app")

    await expect(
      signInAction(
        {},
        form({
          email: "merchant@example.test",
          password: "password123",
          next: "//evil.test/app",
        })
      )
    ).rejects.toThrow("NEXT_REDIRECT:/app")

    await expect(
      signInAction(
        {},
        form({
          email: "merchant@example.test",
          password: "password123",
          next: "/app/qr",
        })
      )
    ).rejects.toThrow("NEXT_REDIRECT:/app/qr")
  })

  it("preserves unauthenticated and authenticated Growth Plan checkout wiring", async () => {
    vi.resetModules()
    const redirect = redirectMock()
    vi.doMock("next/navigation", () => ({ redirect }))
    vi.doMock("@/lib/auth/session", () => ({
      getCurrentMerchant: vi.fn(async () => null),
    }))
    vi.doMock("@/lib/env/server", () => ({
      getServerEnv: vi.fn(() => ({
        NEXT_PUBLIC_APP_URL: "https://nabaperks.test",
        STRIPE_GROWTH_PRICE_ID: "price_growth",
      })),
    }))
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceRoleClient: vi.fn(),
    }))
    vi.doMock("@/lib/stripe/server", () => ({
      getStripe: vi.fn(),
    }))
    const { startCheckoutAction: unauthenticatedCheckout } = await import(
      "@/app/app/billing/actions"
    )

    await expect(unauthenticatedCheckout()).rejects.toThrow(
      "NEXT_REDIRECT:/app/onboarding"
    )

    vi.resetModules()
    const authenticatedRedirect = redirectMock()
    const supabase = createSupabaseMock({
      from: {
        billing_customers: [{ data: { stripe_customer_id: null }, error: null }],
      },
    })
    const createCustomer = vi.fn(async () => ({ id: "cus_growth" }))
    const createSession = vi.fn(async () => ({
      url: "https://stripe.test/checkout/session",
    }))

    vi.doMock("next/navigation", () => ({ redirect: authenticatedRedirect }))
    vi.doMock("@/lib/auth/session", () => ({
      getCurrentMerchant: vi.fn(async () => ({
        id: "merchant-1",
        email: "merchant@example.test",
        business_name: "Bean & Batch",
      })),
    }))
    vi.doMock("@/lib/env/server", () => ({
      getServerEnv: vi.fn(() => ({
        NEXT_PUBLIC_APP_URL: "https://nabaperks.test",
        STRIPE_GROWTH_PRICE_ID: "price_growth",
      })),
    }))
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceRoleClient: vi.fn(() => supabase.client),
    }))
    vi.doMock("@/lib/stripe/server", () => ({
      getStripe: vi.fn(() => ({
        customers: { create: createCustomer },
        checkout: { sessions: { create: createSession } },
      })),
    }))
    const { startCheckoutAction } = await import("@/app/app/billing/actions")

    await expect(startCheckoutAction()).rejects.toThrow(
      "NEXT_REDIRECT:https://stripe.test/checkout/session"
    )
    expect(createCustomer).toHaveBeenCalledWith({
      email: "merchant@example.test",
      name: "Bean & Batch",
      metadata: { merchant_id: "merchant-1" },
    })
    expect(createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "subscription",
        customer: "cus_growth",
        line_items: [{ price: "price_growth", quantity: 1 }],
        subscription_data: expect.objectContaining({
          trial_period_days: 30,
          metadata: { merchant_id: "merchant-1", plan: "growth" },
        }),
        metadata: { merchant_id: "merchant-1", plan: "growth" },
        success_url: "https://nabaperks.test/app/billing?checkout=success",
        cancel_url: "https://nabaperks.test/app/billing?checkout=cancelled",
      })
    )
  })

  it("maps checkout billing lookup errors to safe copy without raw Supabase details", async () => {
    vi.resetModules()
    const internalSupabaseMessage =
      "SUPABASE-INTERNAL checkout lookup exposed schema detail"
    const getStripe = vi.fn()
    const supabase = createSupabaseMock({
      from: {
        billing_customers: [
          { data: null, error: { message: internalSupabaseMessage } },
        ],
      },
    })

    vi.doMock("next/navigation", () => ({ redirect: redirectMock() }))
    vi.doMock("@/lib/auth/session", () => ({
      getCurrentMerchant: vi.fn(async () => ({
        id: "merchant-1",
        email: "merchant@example.test",
        business_name: "Bean & Batch",
      })),
    }))
    vi.doMock("@/lib/env/server", () => ({
      getServerEnv: vi.fn(() => ({
        NEXT_PUBLIC_APP_URL: "https://nabaperks.test",
        STRIPE_GROWTH_PRICE_ID: "price_growth",
      })),
    }))
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceRoleClient: vi.fn(() => supabase.client),
    }))
    vi.doMock("@/lib/stripe/server", () => ({ getStripe }))

    const { startCheckoutAction } = await import("@/app/app/billing/actions")
    const errorMessage = await captureErrorMessage(startCheckoutAction)

    expect(errorMessage).toBe("Billing action could not be completed. Try again.")
    expect(errorMessage).not.toContain(internalSupabaseMessage)
    expect(getStripe).not.toHaveBeenCalled()
  })

  it("maps Stripe customer exceptions to safe checkout copy without raw details", async () => {
    vi.resetModules()
    const internalStripeMessage =
      "STRIPE-INTERNAL customer create request id req_secret"
    const supabase = createSupabaseMock({
      from: {
        billing_customers: [{ data: { stripe_customer_id: null }, error: null }],
      },
    })
    const createCustomer = vi.fn(async () => {
      throw new Error(internalStripeMessage)
    })
    const createSession = vi.fn()

    vi.doMock("next/navigation", () => ({ redirect: redirectMock() }))
    vi.doMock("@/lib/auth/session", () => ({
      getCurrentMerchant: vi.fn(async () => ({
        id: "merchant-1",
        email: "merchant@example.test",
        business_name: "Bean & Batch",
      })),
    }))
    vi.doMock("@/lib/env/server", () => ({
      getServerEnv: vi.fn(() => ({
        NEXT_PUBLIC_APP_URL: "https://nabaperks.test",
        STRIPE_GROWTH_PRICE_ID: "price_growth",
      })),
    }))
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceRoleClient: vi.fn(() => supabase.client),
    }))
    vi.doMock("@/lib/stripe/server", () => ({
      getStripe: vi.fn(() => ({
        customers: { create: createCustomer },
        checkout: { sessions: { create: createSession } },
      })),
    }))

    const { startCheckoutAction } = await import("@/app/app/billing/actions")
    const errorMessage = await captureErrorMessage(startCheckoutAction)

    expect(errorMessage).toBe("Billing action could not be completed. Try again.")
    expect(errorMessage).not.toContain(internalStripeMessage)
    expect(createCustomer).toHaveBeenCalledWith({
      email: "merchant@example.test",
      name: "Bean & Batch",
      metadata: { merchant_id: "merchant-1" },
    })
    expect(createSession).not.toHaveBeenCalled()
  })

  it("maps Stripe checkout exceptions to safe checkout copy without raw details", async () => {
    vi.resetModules()
    const internalStripeMessage =
      "STRIPE-INTERNAL checkout create request id req_secret"
    const supabase = createSupabaseMock({
      from: {
        billing_customers: [
          { data: { stripe_customer_id: "cus_existing" }, error: null },
        ],
      },
    })
    const createCustomer = vi.fn()
    const createSession = vi.fn(async () => {
      throw new Error(internalStripeMessage)
    })

    vi.doMock("next/navigation", () => ({ redirect: redirectMock() }))
    vi.doMock("@/lib/auth/session", () => ({
      getCurrentMerchant: vi.fn(async () => ({
        id: "merchant-1",
        email: "merchant@example.test",
        business_name: "Bean & Batch",
      })),
    }))
    vi.doMock("@/lib/env/server", () => ({
      getServerEnv: vi.fn(() => ({
        NEXT_PUBLIC_APP_URL: "https://nabaperks.test",
        STRIPE_GROWTH_PRICE_ID: "price_growth",
      })),
    }))
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceRoleClient: vi.fn(() => supabase.client),
    }))
    vi.doMock("@/lib/stripe/server", () => ({
      getStripe: vi.fn(() => ({
        customers: { create: createCustomer },
        checkout: { sessions: { create: createSession } },
      })),
    }))

    const { startCheckoutAction } = await import("@/app/app/billing/actions")
    const errorMessage = await captureErrorMessage(startCheckoutAction)

    expect(errorMessage).toBe("Billing action could not be completed. Try again.")
    expect(errorMessage).not.toContain(internalStripeMessage)
    expect(createCustomer).not.toHaveBeenCalled()
    expect(createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "subscription",
        customer: "cus_existing",
        line_items: [{ price: "price_growth", quantity: 1 }],
        success_url: "https://nabaperks.test/app/billing?checkout=success",
        cancel_url: "https://nabaperks.test/app/billing?checkout=cancelled",
      })
    )
  })
})
