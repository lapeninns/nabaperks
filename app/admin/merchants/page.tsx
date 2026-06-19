import {
  Cancel01Icon,
  QrCode01Icon,
  RefreshIcon,
  Store01Icon,
  ToggleOnIcon,
} from "@hugeicons/core-free-icons"

import { regenerateQrAction, setQrActiveAction } from "@/app/admin/actions"
import {
  AdminField,
  AdminPanel,
  SourceLabel,
  StatusPill,
  adminInputClasses,
  first,
  formatAdminDate,
} from "@/components/admin/support"
import { AdminRecordCard } from "@/components/admin/record-card"
import { EmptyState, Icon, PageTitle, SectionHeader } from "@/components/brand"
import { DataTable } from "@/components/data/data-table"
import { Button } from "@/components/ui/button"
import { getAdminMerchants, getAdminQrCodes } from "@/lib/admin/data"

export default async function AdminMerchantsPage() {
  const [merchants, qrCodes] = await Promise.all([
    getAdminMerchants(),
    getAdminQrCodes(),
  ])

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Internal admin"
        title="Merchants"
        description="Merchant account, plan status, and QR support controls."
      />

      <AdminPanel className="p-0">
        <div className="border-b p-5">
          <SectionHeader
            title="Merchant accounts"
            description="Service-role admin readback of account status and billing joins."
            actions={
              <SourceLabel>Source: service-role admin readback</SourceLabel>
            }
          />
        </div>
        <DataTable
          caption="Admin merchant account readback"
          cardBreakpoint="lg"
          className="rounded-none border-0 shadow-none"
          rows={merchants}
          getRowKey={(merchant) => merchant.id}
          emptyState={
            <EmptyState
              icon={Store01Icon}
              title="No merchants yet"
              description="Merchant accounts will appear once onboarding creates records."
              className="rounded-none border-0 shadow-none"
            />
          }
          columns={[
            {
              key: "merchant",
              header: "Merchant",
              cell: (merchant) => (
                <div className="grid gap-1">
                  <span className="font-bold">{merchant.business_name}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {merchant.business_slug}
                  </span>
                </div>
              ),
            },
            {
              key: "email",
              header: "Email",
              cell: (merchant) => (
                <span className="text-muted-foreground">{merchant.email}</span>
              ),
            },
            {
              key: "account",
              header: "Account",
              cell: (merchant) => <StatusPill>{merchant.status}</StatusPill>,
            },
            {
              key: "billing",
              header: "Billing",
              cell: (merchant) => {
                const billing = first(merchant.billing_customers)
                return (
                  <span className="text-muted-foreground">
                    {billing?.status ?? "not started"}
                  </span>
                )
              },
            },
            {
              key: "created",
              header: "Created",
              cell: (merchant) => (
                <time
                  className="text-muted-foreground"
                  dateTime={merchant.created_at}
                >
                  {formatAdminDate(merchant.created_at)}
                </time>
              ),
            },
          ]}
          mobileCard={(merchant) => {
            const billing = first(merchant.billing_customers)
            return (
              <AdminRecordCard
                title={merchant.business_name}
                eyebrow={merchant.business_slug}
                status={<StatusPill>{merchant.status}</StatusPill>}
                fields={[
                  { label: "Email", value: merchant.email },
                  {
                    label: "Billing",
                    value: billing?.status ?? "not started",
                  },
                  {
                    label: "Created",
                    value: (
                      <time dateTime={merchant.created_at}>
                        {formatAdminDate(merchant.created_at)}
                      </time>
                    ),
                  },
                ]}
              />
            )
          }}
        />
      </AdminPanel>

      <AdminPanel>
        <SectionHeader
          title="QR records"
          description="Audited QR activation and regeneration controls. Reasons are required before mutation."
          actions={
            <SourceLabel>Source: service-role admin readback</SourceLabel>
          }
        />
        {qrCodes.length ? (
          <div className="grid gap-3">
            {qrCodes.map((qrCode) => {
              const merchant = first(qrCode.merchants)
              return (
                <article
                  key={qrCode.id}
                  className="grid gap-3 rounded-lg border p-4"
                >
                  <div className="grid gap-1">
                    <p className="font-mono text-sm font-bold">
                      {qrCode.qr_id}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {merchant?.business_name ?? "Merchant"} ·{" "}
                      {qrCode.is_active ? "active" : "inactive"} ·{" "}
                      {formatAdminDate(qrCode.created_at)}
                    </p>
                  </div>
                  <div className="grid gap-2 lg:grid-cols-2">
                    <QrStateForm
                      qrCodeId={qrCode.id}
                      nextActive={!qrCode.is_active}
                    />
                    <RegenerateQrForm qrCodeId={qrCode.id} />
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <EmptyState
            icon={QrCode01Icon}
            title="No QR records yet"
            className="rounded-none border-0 p-0 shadow-none"
          />
        )}
      </AdminPanel>
    </div>
  )
}

function QrStateForm({
  qrCodeId,
  nextActive,
}: {
  qrCodeId: string
  nextActive: boolean
}) {
  return (
    <form action={setQrActiveAction} className="grid gap-2">
      <input type="hidden" name="qrCodeId" value={qrCodeId} />
      <input type="hidden" name="isActive" value={String(nextActive)} />
      <AdminField label="Reason">
        <input
          name="reason"
          required
          minLength={4}
          className={adminInputClasses}
        />
      </AdminField>
      <Button type="submit" variant={nextActive ? "secondary" : "destructive"}>
        <Icon icon={nextActive ? ToggleOnIcon : Cancel01Icon} size={16} />
        {nextActive ? "Enable QR" : "Disable QR"}
      </Button>
    </form>
  )
}

function RegenerateQrForm({ qrCodeId }: { qrCodeId: string }) {
  return (
    <form action={regenerateQrAction} className="grid gap-2">
      <input type="hidden" name="qrCodeId" value={qrCodeId} />
      <AdminField label="Reason">
        <input
          name="reason"
          required
          minLength={4}
          className={adminInputClasses}
        />
      </AdminField>
      <Button type="submit" variant="secondary">
        <Icon icon={RefreshIcon} size={16} />
        Regenerate QR
      </Button>
    </form>
  )
}
