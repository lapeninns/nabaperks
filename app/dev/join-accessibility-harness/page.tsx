import { notFound } from "next/navigation"

import type {
  CustomerIdentityState,
  CustomerJoinState,
} from "@/app/m/[merchantSlug]/join/actions"
import {
  CustomerFlowShell,
  type FlowProgress,
} from "@/components/customer/customer-flow-system"
import {
  CustomerIdentityForm,
  CustomerJoinForm,
} from "@/components/customer/join-forms"
import { CustomerOtpForm } from "@/components/customer/join-otp-form"
import { normalizePhone } from "@/lib/customer/phone"

const HARNESS_MERCHANT_SLUG = "join-accessibility-harness"
const HARNESS_CARD = {
  name: "Harness reward",
  stampsRequired: 6,
  rewardTerms: "Development-only accessibility fixture.",
} as const
const HARNESS_PROGRESS: FlowProgress = {
  step: 2,
  total: 3,
  label: "Keep your card",
}

export default function JoinAccessibilityHarnessPage() {
  if (process.env.NODE_ENV === "production") {
    notFound()
  }

  return (
    <CustomerFlowShell
      eyebrow="Development fixture"
      title="Join accessibility harness"
      description="Real customer join controls with inert development actions."
      progress={HARNESS_PROGRESS}
      dense
      screenLabel="Join accessibility harness"
    >
      <CustomerIdentityForm
        merchantSlug={HARNESS_MERCHANT_SLUG}
        requestIdentityAction={invalidPhoneAction}
      />
      <CustomerOtpForm
        merchantSlug={HARNESS_MERCHANT_SLUG}
        contactLast4="1234"
        verifyOtpAction={inertOtpAction}
        requestIdentityAction={inertResendAction}
      />
      <CustomerJoinForm
        merchantSlug={HARNESS_MERCHANT_SLUG}
        merchantName="Harness venue"
        card={HARNESS_CARD}
        requireGeofence={false}
        joinAction={inertJoinAction}
      />
    </CustomerFlowShell>
  )
}

async function invalidPhoneAction(
  _state: CustomerIdentityState,
  formData: FormData
): Promise<CustomerIdentityState> {
  "use server"

  const contactValue = formData.get("contact")
  const contact = typeof contactValue === "string" ? contactValue.trim() : ""
  const normalized = normalizePhone(contact, "GB")

  return {
    fields: {
      contact,
      merchantSlug: HARNESS_MERCHANT_SLUG,
    },
    errors: {
      contact: normalized.ok
        ? "Use a UK number that can receive texts."
        : normalized.error,
    },
  }
}

async function inertOtpAction(
  _state: CustomerIdentityState,
  _formData: FormData
): Promise<CustomerIdentityState> {
  "use server"

  void _state
  void _formData

  return { errors: { otp: "That code was not accepted." } }
}

async function inertResendAction(
  _state: CustomerIdentityState,
  _formData: FormData
): Promise<CustomerIdentityState> {
  "use server"

  void _state
  void _formData

  return {}
}

async function inertJoinAction(
  _state: CustomerJoinState,
  _formData: FormData
): Promise<CustomerJoinState> {
  "use server"

  void _state
  void _formData

  return { errors: { loyaltyTerms: "Accept the loyalty terms to join." } }
}
