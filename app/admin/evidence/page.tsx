import { captureCommercialEvidenceAction } from "@/app/admin/actions"
import { AdminActionForm } from "@/components/admin/action-form"
import { AdminIdChip } from "@/components/admin/id-chip"
import { AdminRecordCard } from "@/components/admin/record-card"
import {
  AdminEmptyState,
  AdminField,
  AdminPanel,
  SourceLabel,
  StatusPill,
  first,
  formatAdminDate,
} from "@/components/admin/support"
import {
  AdminAppliedFilters,
  AdminLookupControls,
  AdminLookupPagination,
} from "@/components/admin/lookup-controls"
import { AdminViewTabs } from "@/components/admin/view-tabs"
import { PageTitle, SectionHeader } from "@/components/brand"
import { SubmitButton, SelectField } from "@/components/forms"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { canRenderAdminPage } from "@/lib/admin/auth"
import { getAdminEvidenceWorkspace } from "@/lib/admin/evidence"
import {
  buildLookupHref,
  parseAdminLookupParams,
} from "@/lib/admin/lookup-query"
import type { AdminSearchParams } from "@/lib/admin/lookup-query"

export const metadata = { title: "Admin — Commercial evidence" }

const SOURCE_KINDS = [
  ["onboarding_call", "Onboarding call"],
  ["support_call", "Support call"],
  ["dashboard_win", "Dashboard win"],
  ["testimonial_campaign", "Testimonial campaign"],
  ["merchant_submission", "Merchant submission"],
] as const

type AdminEvidencePageProps = {
  searchParams?: Promise<AdminSearchParams>
}

/**
 * Reading the ledger is frequent; capturing a case is occasional — yet the
 * 13-control capture form (four textareas, ~900-1,100px) sat permanently above
 * the ledger the operator usually came to read. The two are segmented views on
 * `?view=`, with the ledger as the default.
 */
export default async function AdminEvidencePage({
  searchParams,
}: AdminEvidencePageProps) {
  if (!(await canRenderAdminPage())) return null

  const params = searchParams ? await searchParams : {}
  const rawView = Array.isArray(params.view) ? params.view[0] : params.view
  const view = rawView === "capture" ? "capture" : "ledger"

  const lookup = parseAdminLookupParams(params)
  const workspace = await getAdminEvidenceWorkspace(lookup)
  // Preserve the active view (and drop `page`, which the pager re-adds) so a
  // paged ledger does not bounce the operator back to the capture form.
  const ledgerHref = (page: number) =>
    buildLookupHref("/admin/evidence", {
      view: view === "ledger" ? undefined : view,
      venue: lookup.venue,
      page,
      size: lookup.size,
    })

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Internal admin"
        title="Commercial evidence"
        description="Capture source-backed before-and-after evidence, snapshot the loyalty ledger, and publish only with recorded merchant approval."
      />

      <AdminViewTabs
        label="Evidence views"
        activeId={view}
        tabs={[
          { id: "ledger", label: "Evidence ledger", href: "/admin/evidence" },
          {
            id: "capture",
            label: "Capture a case",
            href: "/admin/evidence?view=capture",
          },
        ]}
      />

      {view === "capture" ? (
        <AdminPanel>
          <SectionHeader
            title="Capture an evidence case"
            description="The database recomputes members, normal stamps, verified return visits, and redemptions for the selected dates, then hashes the metric snapshot."
            actions={
              <SourceLabel>
                Source: loyalty ledgers + approval record
              </SourceLabel>
            }
          />
          {/* Same `?venue=` term the ledger uses. On this view it narrows the
              merchant picker, which is the only way to reach a venue past the
              alphabetical cap. */}
          <AdminLookupControls
            basePath="/admin/evidence"
            lookup={lookup}
            label="Find a venue to file evidence against"
            fields="venue"
            hiddenParams={{ view: "capture" }}
          />
          <AdminAppliedFilters
            basePath="/admin/evidence"
            lookup={lookup}
            extraParams={{ view: "capture" }}
          />
          <AdminActionForm
            action={captureCommercialEvidenceAction}
            className="grid gap-4"
          >
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <AdminField
                label="Merchant"
                // The picker is alphabetical and hard-capped, so past the cap
                // a venue late in the alphabet was absent with nothing on
                // screen to say so — an operator would read "not on the
                // platform" and stop. The search above now narrows this list,
                // so the helper points at the way out rather than just naming
                // the ceiling (ADM 04#6).
                helper={
                  workspace.merchantTotal > workspace.merchants.length
                    ? `First ${workspace.merchants.length} of ${workspace.merchantTotal} venues, alphabetically. Search by venue above to reach a name further down.`
                    : undefined
                }
              >
                <SelectField name="merchantId" required>
                  <option value="">Select a merchant</option>
                  {workspace.merchants.map((merchant) => (
                    <option key={merchant.id} value={merchant.id}>
                      {merchant.business_name}
                    </option>
                  ))}
                </SelectField>
              </AdminField>
              <AdminField label="Evidence source">
                <SelectField name="sourceKind" required>
                  {SOURCE_KINDS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </SelectField>
              </AdminField>
              <AdminField label="Measurement starts">
                <Input name="measurementStart" type="date" required />
              </AdminField>
              <AdminField label="Measurement ends">
                <Input name="measurementEnd" type="date" required />
              </AdminField>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <AdminField label="Before">
                <Textarea
                  name="beforeSummary"
                  required
                  maxLength={1200}
                  placeholder="What was true before launch, in the merchant’s own context?"
                />
              </AdminField>
              <AdminField label="After">
                <Textarea
                  name="afterSummary"
                  required
                  maxLength={1200}
                  placeholder="What changed, without adding a revenue claim the ledger cannot prove?"
                />
              </AdminField>
              <AdminField
                label="Approved testimonial quote"
                helper="Optional for a draft."
              >
                <Textarea name="testimonialQuote" maxLength={600} />
              </AdminField>
              <AdminField
                label="Approved public attribution"
                helper="Venue or operator wording exactly as approved."
              >
                <Input name="attributionName" maxLength={160} />
              </AdminField>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <AdminField
                label="Source reference"
                helper="Secure call, transcript, ticket or dashboard reference. Never a public URL."
              >
                <Input name="sourceReference" required maxLength={500} />
              </AdminField>
              <AdminField
                label="Asset reference"
                helper="Optional screenshot or recording storage reference."
              >
                <Input name="assetReference" maxLength={500} />
              </AdminField>
              <AdminField
                label="Approval reference"
                helper="Email, signed release or support-ticket reference."
              >
                <Input name="approvalReference" maxLength={500} />
              </AdminField>
            </div>

            <hr className="w-rule my-0" />
            {/* The legal gate carried the least visual weight on the page: a
              16px native tick in a footer row. It now reads as a gate — a
              2px-ink well, a 20px box on a 44px tap row, foreground copy —
              matching AdminConfirmCheck on the other consequential actions.
              (Not `required`: an internal draft can be saved unapproved.) */}
            <label className="focus-ring-within flex min-h-11 items-start gap-3 rounded-lg border-2 border-ink bg-secondary px-3 py-2.5 text-sm">
              <input
                type="checkbox"
                name="merchantApproved"
                className="ink-check focus-ring shrink-0"
              />
              <span className="leading-5 font-semibold text-foreground">
                Merchant approved this attribution, quote and result summary
              </span>
            </label>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <AdminField label="Save as">
                <SelectField name="caseStatus">
                  <option value="draft">Internal draft</option>
                  <option value="published">Approved and published</option>
                </SelectField>
              </AdminField>
              <SubmitButton pendingLabel="Snapshotting…">
                Capture evidence
              </SubmitButton>
            </div>
          </AdminActionForm>
        </AdminPanel>
      ) : (
        <AdminPanel>
          <SectionHeader
            title="Evidence ledger"
            description="Published rows are eligible for the public proof section; drafts stay internal."
            actions={
              <SourceLabel>Source: commercial_evidence_cases</SourceLabel>
            }
          />
          {/* The ledger is searchable and paged now, so it no longer needs the
              truncation notice that stood in for it (ADM 04#6). */}
          <AdminLookupControls
            basePath="/admin/evidence"
            lookup={lookup}
            label="Search evidence by venue"
            fields="venue"
            hiddenParams={{ view: view === "ledger" ? undefined : view }}
          />
          <AdminAppliedFilters
            basePath="/admin/evidence"
            lookup={lookup}
            extraParams={{ view: view === "ledger" ? undefined : view }}
          />
          {workspace.cases.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {workspace.cases.map((caseStudy) => {
                const merchant = first(caseStudy.merchants)
                return (
                  <AdminRecordCard
                    key={caseStudy.id}
                    title={
                      caseStudy.attribution_name ??
                      merchant?.business_name ??
                      "Evidence draft"
                    }
                    fields={[
                      {
                        label: "State",
                        value: (
                          <StatusPill
                            tone={
                              caseStudy.status === "published"
                                ? "good"
                                : "neutral"
                            }
                          >
                            {caseStudy.status}
                          </StatusPill>
                        ),
                      },
                      {
                        label: "Window",
                        value: `${caseStudy.measurement_start} to ${caseStudy.measurement_end}`,
                      },
                      {
                        label: "Ledger snapshot",
                        emphasis: true,
                        value: `${caseStudy.new_members} new members · ${caseStudy.verified_return_visits} verified returns · ${caseStudy.rewards_redeemed} rewards used`,
                      },
                      {
                        // The reproducibility handle was plain truncated text,
                        // so the one value that lets someone re-derive the
                        // snapshot could not be copied.
                        label: "Reproducibility",
                        value: (
                          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            {caseStudy.metric_definition_version}
                            <AdminIdChip
                              value={caseStudy.metric_snapshot_hash}
                              prefix="hash"
                            />
                            <time dateTime={caseStudy.metric_snapshot_at}>
                              {formatAdminDate(caseStudy.metric_snapshot_at)}
                            </time>
                          </span>
                        ),
                      },
                    ]}
                    // The "After" narrative is up to 1,200 characters. In a `dd`
                    // it printed as muted body text inside a label/value list;
                    // it now has its own foreground block at reading size.
                    body={
                      <>
                        <span className="eyebrow block">After</span>
                        <span className="mt-1 block">
                          {caseStudy.after_summary}
                        </span>
                      </>
                    }
                  />
                )
              })}
            </div>
          ) : (
            <AdminEmptyState
              title="No evidence cases yet"
              description="Capture the first case after a merchant win and approval source are available."
              padded={false}
            />
          )}
          {workspace.caseMeta.total > 0 ? (
            <AdminLookupPagination
              label="Evidence ledger pages"
              unit="evidence cases"
              meta={workspace.caseMeta}
              hrefForPage={ledgerHref}
            />
          ) : null}
        </AdminPanel>
      )}
    </div>
  )
}
