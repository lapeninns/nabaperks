import { notFound } from "next/navigation"

import { BillingFulfilmentActions } from "@/components/admin/billing-fulfilment-actions"
import { AdminPanel, SourceLabel, StatusPill } from "@/components/admin/support"
import { PageTitle } from "@/components/brand"

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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="grid gap-1">
            <h2 className="font-heading text-xl font-extrabold">
              The Old Crown
            </h2>
            <SourceLabel>Awaiting delivery evidence</SourceLabel>
          </div>
          <StatusPill tone="warning">Posters dispatched</StatusPill>
        </div>
        <dl className="grid gap-3 border-y border-dashed border-ink/30 py-4 sm:grid-cols-3">
          <AdminDate label="Dispatched" value="6 August 2026, 11:30" />
          <AdminDate label="Pilot starts" value="On confirmed delivery" />
          <AdminDate
            label="Recurring billing"
            value="Held until pilot is protected"
          />
        </dl>
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
