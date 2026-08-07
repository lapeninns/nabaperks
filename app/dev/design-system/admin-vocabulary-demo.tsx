import { AdminIdChip } from "@/components/admin/id-chip"
import { AdminRecordActions } from "@/components/admin/record-actions"
import { AdminPanelSkeleton } from "@/components/admin/skeletons"
import {
  AdminConfirmCheck,
  AdminField,
  AdminPanel,
  AdminPanelFooter,
  AdminPanelHeader,
  SourceLabel,
  StatusPill,
} from "@/components/admin/support"
import { AdminViewTabs } from "@/components/admin/view-tabs"
import { Eyebrow, SectionHeader } from "@/components/brand"
import { SelectField } from "@/components/forms"
import { Input } from "@/components/ui/input"

/**
 * The internal console's own vocabulary, as a catalogue section. Every drift
 * the admin audit found — two select stories, two label systems, four rule
 * tones, three mono registers, inverted destructive semantics — happened
 * because these components had no reference surface while the catalogue calls
 * itself the acceptance gate. Extracted into its own module to keep
 * design-system/page.tsx inside the 1,000-line ESLint budget.
 */
export function AdminVocabularyDemo() {
  return (
    <>
      <div className="surface-card-flat grid gap-3 p-5">
        <Eyebrow>Panel anatomy · padded and flush</Eyebrow>
        <div className="grid gap-4 lg:grid-cols-2">
          <AdminPanel>
            <SectionHeader
              title="Padded panel"
              description="AdminPanel (default): p-5, gap-4. For prose, forms and card lists."
              actions={<SourceLabel>Source: example_table</SourceLabel>}
            />
            <p className="text-sm text-muted-foreground">Panel body.</p>
          </AdminPanel>
          <AdminPanel variant="flush">
            <AdminPanelHeader>
              <SectionHeader
                title="Flush panel"
                description="AdminPanel variant=flush + AdminPanelHeader: a DataTable meets the card edge."
              />
            </AdminPanelHeader>
            <div className="p-5 text-sm text-muted-foreground">
              Table body sits here, edge to edge.
            </div>
            <AdminPanelFooter className="pt-0">
              <span className="text-sm text-muted-foreground">
                Paginator sits here.
              </span>
            </AdminPanelFooter>
          </AdminPanel>
        </div>
      </div>

      <div className="surface-card-flat grid gap-3 p-5">
        <Eyebrow>State vs provenance</Eyebrow>
        <p className="text-sm leading-6 text-muted-foreground">
          StatusPill is the ONLY bordered pill and it always means state.
          SourceLabel is provenance and deliberately has no pill silhouette —
          the two used to be indistinguishable in the same row.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <StatusPill>neutral</StatusPill>
          <StatusPill tone="good">good</StatusPill>
          <StatusPill tone="warning">warning</StatusPill>
          <StatusPill tone="danger">danger</StatusPill>
          <SourceLabel>Source: audit_logs</SourceLabel>
        </div>
        <p className="text-sm leading-6 text-muted-foreground">
          warning takes the sun wash and danger a heavier destructive wash: both
          primary and destructive are warm reds, so at one tint a severity queue
          could not be scanned.
        </p>
      </div>

      <div className="surface-card-flat grid gap-3 p-5">
        <Eyebrow>Identifiers · AdminIdChip</Eyebrow>
        <p className="text-sm leading-6 text-muted-foreground">
          The console&rsquo;s single id renderer: head-and-tail (not a bare
          8-character prefix), a copy glyph rather than a link-like underline,
          and a fixed-width copy→tick swap so the row cannot resize.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <AdminIdChip value="3fa9c1b2-88de-4f61-9a0c-2b6f5f217d0e" />
          <AdminIdChip
            value="3fa9c1b2-88de-4f61-9a0c-2b6f5f217d0e"
            prefix="membership"
          />
        </div>
      </div>

      <div className="surface-card-flat grid gap-3 p-5">
        <Eyebrow>Write actions · field, gate, disclosure</Eyebrow>
        <p className="text-sm leading-6 text-muted-foreground">
          AdminField is the console label register (mono eyebrow, helper text
          OUTSIDE the label so it is not folded into the accessible name).
          Selects compose through SelectField — never a hand-rolled select
          class. Irreversible actions carry AdminConfirmCheck, and per-record
          forms live behind AdminRecordActions so a list stays scannable.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <AdminField
            label="Delta"
            helper="Positive adds stamps, negative removes them."
          >
            <Input name="catalogue-delta" type="number" defaultValue={1} />
          </AdminField>
          <AdminField label="Reason">
            <SelectField name="catalogue-reason" defaultValue="goodwill">
              <option value="goodwill">Goodwill</option>
              <option value="correction">Correction</option>
            </SelectField>
          </AdminField>
        </div>
        <AdminConfirmCheck label="I understand this cannot be undone." />
        <AdminRecordActions label="Adjust stamps" group="catalogue-admin">
          <p className="text-sm text-muted-foreground">
            The write form renders here, one open panel at a time.
          </p>
        </AdminRecordActions>
      </div>

      <div className="surface-card-flat grid gap-3 p-5">
        <Eyebrow>Segmented views and loading</Eyebrow>
        <p className="text-sm leading-6 text-muted-foreground">
          AdminViewTabs replaces stacked panels with URL-driven views (real
          links, so a view is deep-linkable and works with JS off).
          AdminPanelSkeleton is the per-panel Suspense fallback.
        </p>
        <AdminViewTabs
          label="Catalogue example views"
          activeId="one"
          tabs={[
            { id: "one", label: "Memberships", href: "#admin", count: 24 },
            { id: "two", label: "Rewards", href: "#admin", count: 3 },
          ]}
        />
        <AdminPanelSkeleton rows={2} />
      </div>
    </>
  )
}
