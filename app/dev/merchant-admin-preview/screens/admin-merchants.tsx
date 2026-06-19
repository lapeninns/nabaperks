import {
  Cancel01Icon,
  QrCode01Icon,
  RefreshIcon,
  Store01Icon,
} from "@hugeicons/core-free-icons"

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
import {
  ADMIN_MERCHANTS,
  ADMIN_QR_CODES,
  type AdminMerchantRow,
  type AdminQrCodeRow,
} from "./mock-data"
import { PreviewActionForm } from "./preview-forms"

/**
 * Mirror of `/admin/merchants`. Reuses the real merchant `DataTable` and the
 * `StatusPill`/`SourceLabel` chrome with mock readback rows. QR activation and
 * regeneration forms are rendered statically (disabled) — their server actions
 * are not imported.
 *
 * `empty` swaps the merchant readback and QR records to `[]` so the merchant
 * `DataTable` and the QR section both render their real `EmptyState` — the
 * empty-state preview variant.
 */
export function AdminMerchantsScreen({ empty = false }: { empty?: boolean }) {
  const merchants = empty ? [] : ADMIN_MERCHANTS
  const qrCodes = empty ? [] : ADMIN_QR_CODES

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
          getRowKey={(merchant: AdminMerchantRow) => merchant.id}
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
              cell: (merchant: AdminMerchantRow) => (
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
              cell: (merchant: AdminMerchantRow) => (
                <span className="text-muted-foreground">{merchant.email}</span>
              ),
            },
            {
              key: "account",
              header: "Account",
              cell: (merchant: AdminMerchantRow) => (
                <StatusPill>{merchant.status}</StatusPill>
              ),
            },
            {
              key: "billing",
              header: "Billing",
              cell: (merchant: AdminMerchantRow) => {
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
              cell: (merchant: AdminMerchantRow) => (
                <time
                  className="text-muted-foreground"
                  dateTime={merchant.created_at}
                >
                  {formatAdminDate(merchant.created_at)}
                </time>
              ),
            },
          ]}
          mobileCard={(merchant: AdminMerchantRow) => {
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
            {qrCodes.map((qrCode: AdminQrCodeRow) => {
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
                    <PreviewActionForm className="grid gap-2">
                      <AdminField label="Reason">
                        <input className={adminInputClasses} disabled />
                      </AdminField>
                      <Button type="button" variant="destructive" disabled>
                        <Icon icon={Cancel01Icon} size={16} />
                        Disable QR
                      </Button>
                    </PreviewActionForm>
                    <PreviewActionForm className="grid gap-2">
                      <AdminField label="Reason">
                        <input className={adminInputClasses} disabled />
                      </AdminField>
                      <Button type="button" variant="secondary" disabled>
                        <Icon icon={RefreshIcon} size={16} />
                        Regenerate QR
                      </Button>
                    </PreviewActionForm>
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
