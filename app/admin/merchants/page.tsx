import Link from "next/link"
import {
  Cancel01Icon,
  QrCode01Icon,
  RefreshIcon,
  Store01Icon,
  ToggleOnIcon,
} from "@hugeicons/core-free-icons"

import { regenerateQrAction, setQrActiveAction } from "@/app/admin/actions"
import { AdminActionForm } from "@/components/admin/action-form"
import {
  AdminConfirmCheck,
  AdminField,
  AdminPanel,
  SourceLabel,
  StatusPill,
  first,
  formatAdminDate,
} from "@/components/admin/support"
import { AdminRecordActions } from "@/components/admin/record-actions"
import { AdminRecordCard } from "@/components/admin/record-card"
import { EmptyState, Icon, PageTitle, SectionHeader } from "@/components/brand"
import { DataTable } from "@/components/data/data-table"
import { SubmitButton } from "@/components/forms"
import { Input } from "@/components/ui/input"
import { canRenderAdminPage } from "@/lib/admin/auth"
import { getAdminMerchants, getAdminQrCodes } from "@/lib/admin/data"
import { formatAdminBillingStatus } from "@/lib/admin/billing-redaction"
import { buildLookupHref } from "@/lib/admin/lookup-query"

export const metadata = { title: "Admin — Merchants" }

type AdminMerchants = Awaited<ReturnType<typeof getAdminMerchants>>
type AdminMerchant = AdminMerchants[number]
type AdminQrCodes = Awaited<ReturnType<typeof getAdminQrCodes>>
type AdminQrCode = AdminQrCodes[number]

/** merchants.status check constraint: trial/active/paused/cancelled/suspended. */
const ACCOUNT_STATUS_TONE: Record<
  string,
  "neutral" | "good" | "warning" | "danger"
> = {
  trial: "good",
  active: "good",
  paused: "warning",
  cancelled: "danger",
  suspended: "danger",
}

function accountStatusTone(status: string) {
  return ACCOUNT_STATUS_TONE[status.toLowerCase()] ?? "neutral"
}

export default async function AdminMerchantsPage() {
  if (!(await canRenderAdminPage())) return null

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

      <MerchantAccountsPanel merchants={merchants} />

      <QrRecordsPanel qrCodes={qrCodes} />
    </div>
  )
}

/**
 * Cross-links from a merchant row to its related records: venue-filtered
 * members and privacy lookups, the billing list, and the QR records further
 * down this page.
 */
function MerchantCrossLinks({
  merchant,
}: {
  readonly merchant: AdminMerchant
}) {
  const linkClasses =
    "focus-ring rounded-sm font-semibold text-primary underline underline-offset-2 hover:text-[color-mix(in_srgb,var(--primary)_80%,var(--w-ink))]"
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
      <Link
        className={linkClasses}
        href={buildLookupHref("/admin/customers", {
          venue: merchant.business_name,
        })}
      >
        Members
      </Link>
      <Link className={linkClasses} href="/admin/billing">
        Billing
      </Link>
      <Link
        className={linkClasses}
        href={buildLookupHref("/admin/privacy", {
          venue: merchant.business_name,
        })}
      >
        Privacy
      </Link>
      <Link className={linkClasses} href="#qr-records">
        QR records
      </Link>
    </span>
  )
}

function MerchantAccountsPanel({
  merchants,
}: {
  readonly merchants: AdminMerchants
}) {
  return (
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
        cardBreakpoint="xl"
        className="rounded-none border-0 shadow-none"
        mobileClassName="p-5"
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
                <MerchantCrossLinks merchant={merchant} />
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
            cell: (merchant) => (
              <StatusPill tone={accountStatusTone(merchant.status)}>
                {merchant.status}
              </StatusPill>
            ),
          },
          {
            key: "billing",
            header: "Billing",
            cell: (merchant) => {
              const billing = formatAdminBillingStatus(
                first(merchant.billing_customers)?.status
              )
              return (
                <StatusPill tone={billing.tone}>{billing.label}</StatusPill>
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
          const billing = formatAdminBillingStatus(
            first(merchant.billing_customers)?.status
          )
          return (
            <AdminRecordCard
              title={merchant.business_name}
              eyebrow={merchant.business_slug}
              status={
                <>
                  <StatusPill tone={accountStatusTone(merchant.status)}>
                    {merchant.status}
                  </StatusPill>
                  <StatusPill tone={billing.tone}>{billing.label}</StatusPill>
                </>
              }
              fields={[
                { label: "Email", value: merchant.email },
                {
                  label: "Links",
                  value: <MerchantCrossLinks merchant={merchant} />,
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
  )
}

function QrRecordsPanel({ qrCodes }: { readonly qrCodes: AdminQrCodes }) {
  return (
    <AdminPanel id="qr-records" className="scroll-mt-6">
      <SectionHeader
        title="QR records"
        description="Audited QR activation and regeneration controls. Reasons are required before mutation."
        actions={<SourceLabel>Source: service-role admin readback</SourceLabel>}
      />
      {qrCodes.length ? (
        <div className="grid gap-3">
          {qrCodes.map((qrCode) => (
            <QrRecord key={qrCode.id} qrCode={qrCode} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={QrCode01Icon}
          title="No QR records yet"
          className="rounded-none border-0 p-0 shadow-none"
        />
      )}
    </AdminPanel>
  )
}

function QrRecord({ qrCode }: { readonly qrCode: AdminQrCode }) {
  const merchant = first(qrCode.merchants)

  return (
    <AdminRecordCard
      title={<span className="font-mono text-sm">{qrCode.qr_id}</span>}
      status={
        <StatusPill tone={qrCode.is_active ? "good" : "danger"}>
          {qrCode.is_active ? "active" : "inactive"}
        </StatusPill>
      }
      fields={[
        {
          label: "Merchant",
          value: merchant?.business_name ?? "Merchant",
        },
        {
          label: "Created",
          value: (
            <time dateTime={qrCode.created_at}>
              {formatAdminDate(qrCode.created_at)}
            </time>
          ),
        },
      ]}
      action={
        <AdminRecordActions label="QR controls" group="qr-record">
          <div className="grid gap-3 lg:grid-cols-2">
            <QrStateForm qrCodeId={qrCode.id} nextActive={!qrCode.is_active} />
            <RegenerateQrForm qrCodeId={qrCode.id} />
          </div>
        </AdminRecordActions>
      }
    />
  )
}

function QrStateForm({
  qrCodeId,
  nextActive,
}: {
  readonly qrCodeId: string
  readonly nextActive: boolean
}) {
  return (
    <AdminActionForm action={setQrActiveAction}>
      <input type="hidden" name="qrCodeId" value={qrCodeId} />
      <input type="hidden" name="isActive" value={String(nextActive)} />
      <AdminField
        label="Reason"
        helper={
          nextActive
            ? undefined
            : "Disabling stops scans immediately; the QR can be re-enabled later."
        }
      >
        <Input name="reason" required minLength={4} />
      </AdminField>
      {/* Disabling is reversible (the helper says so), so it takes the
          reversible weight. The irreversible control on this record is
          Regenerate, which owns `destructive` below. */}
      <SubmitButton
        pendingLabel={nextActive ? "Enabling…" : "Disabling…"}
        variant={nextActive ? "secondary" : "outline"}
      >
        <Icon icon={nextActive ? ToggleOnIcon : Cancel01Icon} size={16} />
        {nextActive ? "Enable QR" : "Disable QR"}
      </SubmitButton>
    </AdminActionForm>
  )
}

function RegenerateQrForm({ qrCodeId }: { readonly qrCodeId: string }) {
  return (
    <AdminActionForm action={regenerateQrAction}>
      <input type="hidden" name="qrCodeId" value={qrCodeId} />
      <AdminField
        label="Reason"
        helper="Regenerating invalidates the QR on the current printed poster; the venue must reprint before customers can scan again. The action is written to the audit log."
      >
        <Input name="reason" required minLength={4} />
      </AdminField>
      <AdminConfirmCheck label="I understand the current printed poster QR will stop working." />
      <SubmitButton pendingLabel="Regenerating…" variant="destructive">
        <Icon icon={RefreshIcon} size={16} />
        Regenerate QR
      </SubmitButton>
    </AdminActionForm>
  )
}
