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

describe("admin console redesign contracts", () => {
  it("keeps admin sections reachable in desktop and mobile shell navigation with MFA banner gating", () => {
    const layout = readProjectFile("app/admin/layout.tsx")
    const shell = readProjectFile("components/layout/admin-shell.tsx")
    const shellNavigation = readProjectFile("components/layout/shell-navigation.tsx")

    expect(layout).toContain("getAdminAccess")
    expect(layout).toContain('access.status !== "allowed"')
    expect(layout).toContain("AdminShell")
    expect(layout).not.toContain('"use client"')

    for (const href of [
      'href: "/admin/pilot"',
      'href: "/admin/merchants"',
      'href: "/admin/customers"',
      'href: "/admin/billing"',
      'href: "/admin/privacy"',
      'href: "/admin/fraud"',
      'href: "/admin/audit"',
    ]) {
      expect(shell).toContain(href)
    }

    expect(shell).toContain("mfaRequired")
    expect(shell).toContain("MFA enforcement is enabled for this admin session.")
    expect(shellNavigation).toContain("SheetTitle")
    expect(shellNavigation).toContain("SheetDescription")
    expect(shellNavigation).toContain("aria-current")
    expect(shellNavigation).toContain("className=\"justify-start")
  })

  it("uses shared data primitives and source-labelled support readbacks across admin pages", () => {
    const home = readProjectFile("app/admin/page.tsx")
    const pilot = readProjectFile("app/admin/pilot/page.tsx")
    const merchants = readProjectFile("app/admin/merchants/page.tsx")
    const customers = readProjectFile("app/admin/customers/page.tsx")
    const billing = readProjectFile("app/admin/billing/page.tsx")
    const privacy = readProjectFile("app/admin/privacy/page.tsx")
    const fraud = readProjectFile("app/admin/fraud/page.tsx")
    const audit = readProjectFile("app/admin/audit/page.tsx")

    expect(home).toContain("FunnelChart")
    expect(pilot).toContain("DataTable")
    expect(merchants).toContain("DataTable")
    expect(customers).toContain("DataTable")
    expect(billing).toContain("DataTable")
    expect(privacy).toContain("DataTable")
    expect(fraud).toContain("DataTable")
    expect(audit).toContain("DataTable")

    for (const sourceLabel of [
      "Source: product_events",
      "Source: merchants table",
      "Source: service-role admin readback",
      "Source: billing_customers",
      "Source: consent_records",
      "Source: audit_logs",
    ]) {
      expect(
        [home, pilot, merchants, customers, billing, privacy, fraud, audit].join("\n")
      ).toContain(sourceLabel)
    }
  })

  it("keeps admin support form field names labelled and touch-safe", () => {
    const pages = [
      "app/admin/pilot/page.tsx",
      "app/admin/merchants/page.tsx",
      "app/admin/customers/page.tsx",
      "app/admin/privacy/page.tsx",
    ].map(readProjectFile)
    const combined = pages.join("\n")

    for (const field of [
      'name="membershipId"',
      'name="delta"',
      'name="reason"',
      'name="rewardId"',
      'name="qrCodeId"',
      'name="isActive"',
      'name="customerId"',
      'name="merchantId"',
      'name="source"',
      'name="policyVersion"',
      'name="channel"',
      'name="requestType"',
      'name="notes"',
      'name="noteType"',
      'name="setupMinutes"',
    ]) {
      expect(combined).toContain(field)
    }

    for (const accessibleField of [
      '<AdminField label="Delta"',
      '<AdminField label="Reason"',
      '<AdminField label="Channel"',
      '<AdminField label="Request type"',
      '<AdminField label="Notes"',
      '<AdminField label="Note type"',
      '<AdminField label="Setup check minutes"',
    ]) {
      expect(combined).toContain(accessibleField)
    }

    expect(combined).not.toContain('placeholder="Reason"')
    expect(combined).not.toContain('size="sm"')
  })

  it("renders a safe admin error boundary instead of raw service-role errors", () => {
    const errorBoundary = readProjectFile("app/admin/error.tsx")

    expect(errorBoundary).toContain('"use client"')
    expect(errorBoundary).toContain("Admin readback unavailable")
    expect(errorBoundary).toContain("service-role")
    expect(errorBoundary).not.toContain("error.message")
  })

  it("requires admin authorization before every support mutation", async () => {
    vi.resetModules()
    const requireAdminAction = vi.fn(async () => {
      throw new Error("Forbidden")
    })
    const createSupabaseServerClient = vi.fn()
    const revalidatePath = vi.fn()

    vi.doMock("next/cache", () => ({ revalidatePath }))
    vi.doMock("@/lib/admin/auth", () => ({ requireAdminAction }))
    vi.doMock("@/lib/supabase/server", () => ({ createSupabaseServerClient }))

    const actions = await import("@/app/admin/actions")
    const cases = [
      () =>
        actions.adjustStampsAction(
          form({ membershipId: "membership-1", delta: "1", reason: "Correction" })
        ),
      () =>
        actions.cancelRewardAction(
          form({ rewardId: "reward-1", reason: "Fraud review" })
        ),
      () =>
        actions.setQrActiveAction(
          form({ qrCodeId: "qr-1", isActive: "false", reason: "Lost poster" })
        ),
      () =>
        actions.regenerateQrAction(
          form({ qrCodeId: "qr-1", reason: "Venue requested reset" })
        ),
      () =>
        actions.recordConsentOptOutAction(
          form({
            customerId: "customer-1",
            merchantId: "merchant-1",
            channel: "email",
            source: "support_request",
            policyVersion: "2026-06-06",
            reason: "Customer request",
          })
        ),
      () =>
        actions.logDataRequestAction(
          form({
            customerId: "customer-1",
            merchantId: "merchant-1",
            requestType: "export",
            channel: "email",
            notes: "Verified request",
          })
        ),
      () =>
        actions.logPilotNoteAction(
          form({
            merchantId: "merchant-1",
            noteType: "support",
            notes: "Merchant asked for onboarding support",
          })
        ),
    ]

    for (const run of cases) {
      await expect(run()).rejects.toThrow("Forbidden")
    }

    expect(requireAdminAction).toHaveBeenCalledTimes(cases.length)
    expect(createSupabaseServerClient).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it("preserves admin support RPC names, parameters, and readback revalidation paths", async () => {
    vi.resetModules()
    const revalidatePath = vi.fn()
    const supabase = createSupabaseMock({
      rpc: {
        admin_adjust_membership_stamps: [{ data: null, error: null }],
        admin_cancel_reward: [{ data: null, error: null }],
        admin_set_qr_active: [{ data: null, error: null }],
        admin_regenerate_qr_code: [{ data: null, error: null }],
        admin_record_consent_opt_out: [{ data: null, error: null }],
        admin_log_data_request: [{ data: null, error: null }],
        admin_log_pilot_note: [{ data: null, error: null }],
      },
    })

    vi.doMock("next/cache", () => ({ revalidatePath }))
    vi.doMock("@/lib/admin/auth", () => ({
      requireAdminAction: vi.fn(async () => ({ status: "allowed" })),
    }))
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: vi.fn(async () => supabase.client),
    }))

    const actions = await import("@/app/admin/actions")

    await actions.adjustStampsAction(
      form({ membershipId: "membership-1", delta: "-1", reason: "Duplicate stamp" })
    )
    await actions.cancelRewardAction(
      form({ rewardId: "reward-1", reason: "Customer support request" })
    )
    await actions.setQrActiveAction(
      form({ qrCodeId: "qr-code-1", isActive: "false", reason: "Compromised QR" })
    )
    await actions.regenerateQrAction(
      form({ qrCodeId: "qr-code-1", reason: "New venue signage" })
    )
    await actions.recordConsentOptOutAction(
      form({
        customerId: "customer-1",
        merchantId: "merchant-1",
        channel: "email",
        source: "support_request",
        policyVersion: "2026-06-06",
        reason: "Customer emailed support",
      })
    )
    await actions.logDataRequestAction(
      form({
        customerId: "customer-1",
        merchantId: "merchant-1",
        requestType: "deletion",
        channel: "email",
        notes: "Verified identity and logged deletion request.",
      })
    )
    await actions.logPilotNoteAction(
      form({
        merchantId: "merchant-1",
        noteType: "launch_self_service_checked",
        setupMinutes: "2",
        notes: "Checked QR scan, stamp, and reward self-service.",
      })
    )

    expect(supabase.rpcCalls).toEqual([
      {
        name: "admin_adjust_membership_stamps",
        params: {
          p_membership_id: "membership-1",
          p_delta: -1,
          p_reason: "Duplicate stamp",
        },
      },
      {
        name: "admin_cancel_reward",
        params: {
          p_reward_id: "reward-1",
          p_reason: "Customer support request",
        },
      },
      {
        name: "admin_set_qr_active",
        params: {
          p_qr_code_id: "qr-code-1",
          p_is_active: false,
          p_reason: "Compromised QR",
        },
      },
      {
        name: "admin_regenerate_qr_code",
        params: {
          p_qr_code_id: "qr-code-1",
          p_reason: "New venue signage",
        },
      },
      {
        name: "admin_record_consent_opt_out",
        params: {
          p_customer_id: "customer-1",
          p_merchant_id: "merchant-1",
          p_channel: "email",
          p_source: "support_request",
          p_policy_version: "2026-06-06",
          p_reason: "Customer emailed support",
        },
      },
      {
        name: "admin_log_data_request",
        params: {
          p_customer_id: "customer-1",
          p_merchant_id: "merchant-1",
          p_request_type: "deletion",
          p_channel: "email",
          p_notes: "Verified identity and logged deletion request.",
        },
      },
      {
        name: "admin_log_pilot_note",
        params: {
          p_merchant_id: "merchant-1",
          p_note_type: "launch_self_service_checked",
          p_notes: "Checked QR scan, stamp, and reward self-service.",
          p_training_minutes: 2,
        },
      },
    ])

    for (const path of [
      "/admin/customers",
      "/admin/merchants",
      "/admin/privacy",
      "/admin/pilot",
      "/admin/audit",
    ]) {
      expect(revalidatePath).toHaveBeenCalledWith(path)
    }
  })

  it("validates support context before RPC and maps backend failures to safe copy", async () => {
    vi.resetModules()
    const supabase = createSupabaseMock({
      rpc: {
        admin_set_qr_active: [
          { data: null, error: { message: "internal Supabase policy detail" } },
        ],
      },
    })
    vi.doMock("next/cache", () => ({ revalidatePath: vi.fn() }))
    vi.doMock("@/lib/admin/auth", () => ({
      requireAdminAction: vi.fn(async () => ({ status: "allowed" })),
    }))
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: vi.fn(async () => supabase.client),
    }))

    const actions = await import("@/app/admin/actions")

    await expect(
      actions.adjustStampsAction(
        form({ membershipId: "membership-1", delta: "1", reason: "" })
      )
    ).rejects.toThrow("Operator reason is required.")
    await expect(
      actions.logDataRequestAction(
        form({
          customerId: "customer-1",
          merchantId: "merchant-1",
          requestType: "deletion",
          channel: "email",
          notes: "",
        })
      )
    ).rejects.toThrow("Support notes are required.")
    await expect(
      actions.logPilotNoteAction(
        form({
          merchantId: "merchant-1",
          noteType: "launch_self_service_checked",
          setupMinutes: "9",
          notes: "Too long.",
        })
      )
    ).rejects.toThrow("Setup check minutes must be between 1 and 3.")
    expect(supabase.rpcCalls).toEqual([])

    await expect(
      actions.setQrActiveAction(
        form({
          qrCodeId: "qr-code-1",
          isActive: "false",
          reason: "Compromised QR",
        })
      )
    ).rejects.toThrow("QR update failed. Try again or review audit logs.")
  })
})
