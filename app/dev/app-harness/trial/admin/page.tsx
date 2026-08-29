import { notFound } from "next/navigation"

import { BillingFulfilmentActions } from "@/components/admin/billing-fulfilment-actions"
import { AdminPanel, StatusPill } from "@/components/admin/support"
import { PageTitle, SectionHeader } from "@/components/brand"

export const dynamic = "force-dynamic"

export default function TrialAdminHarnessPage() {
  if (process.env.NODE_ENV === "production") notFound()

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Internal admin"
        title="Launch fulfilment"
        description="Record poster evidence and protect the merchant's usable platform pilot."
      />
      <AdminPanel>
        {/* The fixture renders the same components as the real billing route
            (SectionHeader + StatusPill + .w-rule): a harness whose fixture
            diverges from production yields false screenshot proof. It used to
            carry a bespoke text-xl heading and its own dashed tone. */}
        <SectionHeader
          title="The Old Crown"
          description="Awaiting delivery evidence."
          actions={<StatusPill tone="warning">Posters dispatched</StatusPill>}
        />
        <hr className="w-rule my-0" />
        <dl className="grid gap-3 sm:grid-cols-3">
          <AdminDate label="Dispatched" value="6 August 2026, 11:30" />
          <AdminDate label="Pilot starts" value="On confirmed delivery" />
          <AdminDate
            label="Recurring billing"
            value="Held until pilot is protected"
          />
        </dl>
        <hr className="w-rule my-0" />
        <BillingFulfilmentActions
          merchantId="10000000-0000-4000-8000-000000000001"
          fulfilmentStatus="dispatched"
          basePilotEndsAt={null}
        />
      </AdminPanel>
    </div>
  )
}

function AdminDate({
  label,
  value,
}: {
  readonly label: string
  readonly value: string
}) {
  return (
    <div className="grid gap-1">
      <dt className="eyebrow">{label}</dt>
      <dd className="text-sm font-semibold">{value}</dd>
    </div>
  )
}
