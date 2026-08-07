import { captureCommercialEvidenceAction } from "@/app/admin/actions"
import { AdminActionForm } from "@/components/admin/action-form"
import { AdminRecordCard } from "@/components/admin/record-card"
import {
  AdminField,
  AdminPanel,
  SourceLabel,
  StatusPill,
  first,
  formatAdminDate,
} from "@/components/admin/support"
import { EmptyState, PageTitle, SectionHeader } from "@/components/brand"
import { SubmitButton, SelectField } from "@/components/forms"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { canRenderAdminPage } from "@/lib/admin/auth"
import { getAdminEvidenceWorkspace } from "@/lib/admin/evidence"

export const metadata = { title: "Admin — Commercial evidence" }

const SOURCE_KINDS = [
  ["onboarding_call", "Onboarding call"],
  ["support_call", "Support call"],
  ["dashboard_win", "Dashboard win"],
  ["testimonial_campaign", "Testimonial campaign"],
  ["merchant_submission", "Merchant submission"],
] as const

export default async function AdminEvidencePage() {
  if (!(await canRenderAdminPage())) return null

  const workspace = await getAdminEvidenceWorkspace()

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Internal admin"
        title="Commercial evidence"
        description="Capture source-backed before-and-after evidence, snapshot the loyalty ledger, and publish only with recorded merchant approval."
      />

      <AdminPanel>
        <SectionHeader
          title="Capture an evidence case"
          description="The database recomputes members, normal stamps, verified return visits, and redemptions for the selected dates, then hashes the metric snapshot."
          actions={
            <SourceLabel>Source: loyalty ledgers + approval record</SourceLabel>
          }
        />
        <AdminActionForm
          action={captureCommercialEvidenceAction}
          className="grid gap-4"
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <AdminField label="Merchant">
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
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px_auto] sm:items-end">
            <label className="flex min-h-11 items-center gap-3 text-sm font-bold">
              <input
                type="checkbox"
                name="merchantApproved"
                className="focus-ring size-4 accent-primary"
              />
              Merchant approved this attribution, quote and result summary
            </label>
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

      <AdminPanel>
        <SectionHeader
          title="Evidence ledger"
          description="Published rows are eligible for the public proof section; drafts stay internal."
          actions={<SourceLabel>Source: commercial_evidence_cases</SourceLabel>}
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
                      value: `${caseStudy.new_members} new members · ${caseStudy.verified_return_visits} verified returns · ${caseStudy.rewards_redeemed} rewards used`,
                    },
                    { label: "After", value: caseStudy.after_summary },
                    {
                      label: "Reproducibility",
                      value: `${caseStudy.metric_definition_version} · ${caseStudy.metric_snapshot_hash.slice(0, 12)}… · ${formatAdminDate(caseStudy.metric_snapshot_at)}`,
                    },
                  ]}
                />
              )
            })}
          </div>
        ) : (
          <EmptyState
            title="No evidence cases yet"
            description="Capture the first case after a merchant win and approval source are available."
            className="rounded-none border-0 p-0 shadow-none"
          />
        )}
      </AdminPanel>
    </div>
  )
}
