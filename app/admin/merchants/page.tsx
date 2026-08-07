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
  AdminEmptyState,
  AdminField,
  AdminPanel,
  AdminPanelFooter,
  AdminPanelHeader,
  SourceLabel,
  StatusPill,
  first,
  formatAdminDate,
} from "@/components/admin/support"
import { AdminCrossLinks } from "@/components/admin/cross-links"
import {
  AdminLookupControls,
  AdminLookupPagination,
} from "@/components/admin/lookup-controls"
import { AdminRecordActions } from "@/components/admin/record-actions"
import { AdminRecordCard } from "@/components/admin/record-card"
import { Icon, PageTitle, SectionHeader } from "@/components/brand"
import { DataTable } from "@/components/data/data-table"
import { SubmitButton } from "@/components/forms"
import { Input } from "@/components/ui/input"
import { canRenderAdminPage } from "@/lib/admin/auth"
import { getAdminMerchants, getAdminQrCodes } from "@/lib/admin/data"
import { formatAdminBillingStatus } from "@/lib/admin/billing-redaction"
import {
  buildLookupHref,
  parseAdminLookupParams,
  parsePageParam,
  type AdminLookupState,
  type AdminSearchParams,
} from "@/lib/admin/lookup-query"

export const metadata = { title: "Admin — Merchants" }

type AdminMerchantsResult = Awaited<ReturnType<typeof getAdminMerchants>>
type AdminMerchant = AdminMerchantsResult["rows"][number]
type AdminQrCodesResult = Awaited<ReturnType<typeof getAdminQrCodes>>
type AdminQrCode = AdminQrCodesResult["rows"][number]

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

type AdminMerchantsPageProps = {
  searchParams?: Promise<AdminSearchParams>
}

export default async function AdminMerchantsPage({
  searchParams,
}: AdminMerchantsPageProps) {
  if (!(await canRenderAdminPage())) return null

  const params = searchParams ? await searchParams : {}
  const lookup = parseAdminLookupParams(params)
  const qrPage = parsePageParam(params.qrPage)

  const [merchants, qrCodes] = await Promise.all([
    getAdminMerchants(lookup),
    getAdminQrCodes({ venue: lookup.venue, page: qrPage }),
  ])

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Internal admin"
        title="Merchants"
        description="Merchant account, plan status, and QR support controls."
      />

      <MerchantAccountsPanel
        merchants={merchants}
        lookup={lookup}
        hrefForPage={(page) =>
          buildLookupHref("/admin/merchants", {
            venue: lookup.venue,
            page,
            qrPage,
          })
        }
      />

      <QrRecordsPanel
        qrCodes={qrCodes}
        venue={lookup.venue}
        hrefForPage={(page) =>
          `${buildLookupHref("/admin/merchants", {
            venue: lookup.venue,
            page: lookup.page,
            qrPage: page,
          })}#qr-records`
        }
      />
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
  return (
    <AdminCrossLinks
      label={`${merchant.business_name} related records`}
      links={[
        {
          label: "Members",
          href: buildLookupHref("/admin/customers", {
            venue: merchant.business_name,
          }),
        },
        { label: "Billing", href: "/admin/billing" },
        {
          label: "Privacy",
          href: buildLookupHref("/admin/privacy", {
            venue: merchant.business_name,
          }),
        },
        {
          // The QR panel below is filtered by the same `venue` param, so the
          // cross-link now narrows it to this venue instead of dropping the
          // operator thousands of pixels into an unfiltered wall.
          label: "QR records",
          href: `${buildLookupHref("/admin/merchants", {
            venue: merchant.business_name,
          })}#qr-records`,
        },
      ]}
    />
  )
}

function MerchantAccountsPanel({
  merchants,
  lookup,
  hrefForPage,
}: {
  readonly merchants: AdminMerchantsResult
  readonly lookup: AdminLookupState
  readonly hrefForPage: (page: number) => string
}) {
  const searching = Boolean(lookup.venue)

  return (
    <AdminPanel variant="flush">
      <AdminPanelHeader>
        <SectionHeader
          title="Merchant accounts"
          description="Service-role admin readback of account status and billing joins."
          actions={
            <SourceLabel>Source: service-role admin readback</SourceLabel>
          }
        />
        <AdminLookupControls
          basePath="/admin/merchants"
          lookup={lookup}
          label="Merchant lookup"
          fields="venue"
        />
      </AdminPanelHeader>
      <DataTable
        caption="Admin merchant account readback"
        cardBreakpoint="xl"
        className="rounded-none border-0 shadow-none"
        mobileClassName="p-5"
        mobilePageSize={10}
        rows={merchants.rows}
        getRowKey={(merchant) => merchant.id}
        emptyState={
          searching ? (
            <AdminEmptyState
              icon={Store01Icon}
              title="No matching merchants"
              description="Adjust the venue search, or clear it to see the newest merchant accounts."
            />
          ) : (
            <AdminEmptyState
              icon={Store01Icon}
              title="No merchants yet"
              description="Merchant accounts will appear once onboarding creates records."
            />
          )
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
      {merchants.meta.total > 0 ? (
        <AdminPanelFooter className="pt-0">
          <AdminLookupPagination
            label="Merchant pages"
            unit="merchant accounts"
            meta={merchants.meta}
            hrefForPage={hrefForPage}
          />
        </AdminPanelFooter>
      ) : null}
    </AdminPanel>
  )
}

/**
 * QR records used to be the one admin list with no table, no pagination, no
 * search and no breakpoint switch: 100 record cards at every width, roughly
 * 20,000px, appended under the merchant table. It is now the same DataTable
 * everything else uses — cards through tablet, a semantic table from xl, a
 * revealed card stack on phones — filtered by the page's venue lookup and
 * paged 25 at a time.
 */
function QrRecordsPanel({
  qrCodes,
  venue,
  hrefForPage,
}: {
  readonly qrCodes: AdminQrCodesResult
  readonly venue?: string
  readonly hrefForPage: (page: number) => string
}) {
  return (
    <AdminPanel id="qr-records" variant="flush" className="scroll-mt-6">
      <AdminPanelHeader>
        <SectionHeader
          title="QR records"
          description="Audited QR activation and regeneration controls. Reasons are required before mutation. Filtered by the venue search above."
          actions={
            <SourceLabel>Source: service-role admin readback</SourceLabel>
          }
        />
      </AdminPanelHeader>
      <DataTable
        caption="Admin QR record readback"
        cardBreakpoint="xl"
        className="rounded-none border-0 shadow-none"
        mobileClassName="p-5"
        mobilePageSize={10}
        rows={qrCodes.rows}
        getRowKey={(qrCode) => qrCode.id}
        emptyState={
          <AdminEmptyState
            icon={QrCode01Icon}
            title={venue ? "No matching QR records" : "No QR records yet"}
            description={
              venue
                ? "Clear the venue search to see the newest QR records."
                : undefined
            }
          />
        }
        columns={[
          {
            key: "qr",
            header: "QR id",
            cell: (qrCode) => (
              <span className="font-mono text-xs">{qrCode.qr_id}</span>
            ),
          },
          {
            key: "merchant",
            header: "Merchant",
            cell: (qrCode) => (
              <span className="font-bold">
                {first(qrCode.merchants)?.business_name ?? "Merchant"}
              </span>
            ),
          },
          {
            key: "state",
            header: "State",
            cell: (qrCode) => (
              <StatusPill tone={qrCode.is_active ? "good" : "danger"}>
                {qrCode.is_active ? "active" : "inactive"}
              </StatusPill>
            ),
          },
          {
            key: "created",
            header: "Created",
            cell: (qrCode) => (
              <time
                className="text-muted-foreground"
                dateTime={qrCode.created_at}
              >
                {formatAdminDate(qrCode.created_at)}
              </time>
            ),
          },
          {
            key: "actions",
            header: "Actions",
            cell: (qrCode) => (
              <AdminRecordActions label="QR controls" group="qr-record-table">
                <QrRecordForms qrCode={qrCode} />
              </AdminRecordActions>
            ),
          },
        ]}
        mobileCard={(qrCode) => <QrRecord qrCode={qrCode} />}
      />
      {qrCodes.meta.total > 0 ? (
        <AdminPanelFooter className="pt-0">
          <AdminLookupPagination
            label="QR record pages"
            unit="QR records"
            meta={qrCodes.meta}
            hrefForPage={hrefForPage}
          />
        </AdminPanelFooter>
      ) : null}
    </AdminPanel>
  )
}

function QrRecordForms({ qrCode }: { readonly qrCode: AdminQrCode }) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <QrStateForm qrCodeId={qrCode.id} nextActive={!qrCode.is_active} />
      <RegenerateQrForm qrCodeId={qrCode.id} />
    </div>
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
          <QrRecordForms qrCode={qrCode} />
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
