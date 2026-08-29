import { Suspense } from "react"

import {
  AdminPanelSkeleton,
  AdminTableSkeleton,
} from "@/components/admin/skeletons"
import { AdminViewTabs } from "@/components/admin/view-tabs"
import { PageTitle } from "@/components/brand"
import { canRenderAdminPage } from "@/lib/admin/auth"
import {
  getAdminConsentRecords,
  getAdminDataRequestActivity,
  getAdminPrivacySupportRows,
  getAdminUnaffiliatedCustomers,
} from "@/lib/admin/data"
import {
  buildLookupHref,
  parseAdminLookupParams,
  parsePageParam,
  type AdminSearchParamValue,
  type AdminSearchParams,
} from "@/lib/admin/lookup-query"

import { ConsentLogPanel } from "./consent-log-panel"
import { DataRequestWorkflowPanel } from "./data-request-workflow-panel"
import { LoggedRequestsPanel } from "./logged-requests-panel"
import { UnaffiliatedCustomersPanel } from "./unaffiliated-customers-panel"

export const metadata = { title: "Admin — Privacy support" }

type AdminPrivacyPageProps = {
  searchParams?: Promise<AdminSearchParams>
}

const PRIVACY_VIEWS = [
  "requests",
  "unaffiliated",
  "activity",
  "consent",
] as const
type PrivacyView = (typeof PRIVACY_VIEWS)[number]

/** Unknown/absent `?panel=` falls back to the request workflow. */
function parsePrivacyView(value: AdminSearchParamValue): PrivacyView {
  const raw = Array.isArray(value) ? value[0] : value
  return PRIVACY_VIEWS.includes(raw as PrivacyView)
    ? (raw as PrivacyView)
    : "requests"
}

/**
 * Privacy support surface. Shares the member lookup capability with the
 * customers page (admin member lookup R6) so a GDPR requester can be found
 * by venue or contact fragment regardless of how old their membership is.
 *
 * The four panels are four jobs — service a request, find an orphan account,
 * track the SLA, read consent evidence — that are never needed at the same
 * time. They are segmented views on `?panel=`, not a single ~13,000px stack
 * with three independent paginators, and only the active view is read from
 * the database.
 */
export default async function AdminPrivacyPage({
  searchParams,
}: AdminPrivacyPageProps) {
  if (!(await canRenderAdminPage())) return null

  const params = searchParams ? await searchParams : {}
  const lookup = parseAdminLookupParams(params)
  const view = parsePrivacyView(params.panel)
  const consentPage = parsePageParam(params.consentPage)
  const unaffiliatedPage = parsePageParam(params.unaffiliatedPage)

  const hrefForView = (panel: PrivacyView) =>
    buildLookupHref("/admin/privacy", {
      panel: panel === "requests" ? undefined : panel,
      venue: lookup.venue,
      contact: lookup.contact,
      size: lookup.size,
    })

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Internal admin"
        title="Privacy support"
        description="Consent readback and audited support actions for privacy, export, deletion, and opt-out requests."
      />

      <div className="grid gap-4">
        <AdminViewTabs
          label="Privacy views"
          activeId={view}
          tabs={[
            {
              id: "requests",
              label: "Requests",
              href: hrefForView("requests"),
            },
            {
              id: "unaffiliated",
              label: "Unaffiliated",
              href: hrefForView("unaffiliated"),
            },
            {
              id: "activity",
              label: "Activity",
              href: hrefForView("activity"),
            },
            {
              id: "consent",
              label: "Consent log",
              href: hrefForView("consent"),
            },
          ]}
        />
      </div>

      {/* Each view streams behind its own boundary: the page shell, tabs and
          lookup paint immediately instead of waiting on a service-role
          readback. */}
      {view === "requests" ? (
        <Suspense fallback={<AdminPanelSkeleton rows={3} />}>
          <RequestsView
            lookup={lookup}
            consentPage={consentPage}
            unaffiliatedPage={unaffiliatedPage}
          />
        </Suspense>
      ) : null}
      {view === "unaffiliated" ? (
        <Suspense fallback={<AdminPanelSkeleton rows={3} />}>
          <UnaffiliatedView
            lookup={lookup}
            unaffiliatedPage={unaffiliatedPage}
          />
        </Suspense>
      ) : null}
      {view === "activity" ? (
        <Suspense fallback={<AdminPanelSkeleton rows={4} />}>
          <ActivityView />
        </Suspense>
      ) : null}
      {view === "consent" ? (
        <Suspense fallback={<AdminTableSkeleton />}>
          <ConsentView lookup={lookup} consentPage={consentPage} />
        </Suspense>
      ) : null}
    </div>
  )
}

async function RequestsView({
  lookup,
  consentPage,
  unaffiliatedPage,
}: {
  readonly lookup: ReturnType<typeof parseAdminLookupParams>
  readonly consentPage: number
  readonly unaffiliatedPage: number
}) {
  const supportRows = await getAdminPrivacySupportRows(lookup).catch(
    (error: unknown) => {
      console.error("Admin privacy lookup failed", error)
      return null
    }
  )

  return (
    <DataRequestWorkflowPanel
      result={supportRows}
      lookup={lookup}
      hrefForPage={(page) =>
        buildLookupHref("/admin/privacy", {
          venue: lookup.venue,
          contact: lookup.contact,
          page,
          consentPage,
          unaffiliatedPage,
          size: lookup.size,
        })
      }
    />
  )
}

async function UnaffiliatedView({
  lookup,
  unaffiliatedPage,
}: {
  readonly lookup: ReturnType<typeof parseAdminLookupParams>
  readonly unaffiliatedPage: number
}) {
  const unaffiliated = await getAdminUnaffiliatedCustomers({
    contact: lookup.contact,
    page: unaffiliatedPage,
    size: lookup.size,
  }).catch((error: unknown) => {
    console.error("Admin unaffiliated lookup failed", error)
    return null
  })

  return (
    <UnaffiliatedCustomersPanel
      result={unaffiliated}
      lookup={lookup}
      hrefForPage={(page) =>
        buildLookupHref("/admin/privacy", {
          panel: "unaffiliated",
          venue: lookup.venue,
          contact: lookup.contact,
          unaffiliatedPage: page,
          size: lookup.size,
        })
      }
    />
  )
}

async function ActivityView() {
  const dataRequests = await getAdminDataRequestActivity().catch(
    (error: unknown) => {
      console.error("Admin data request readback failed", error)
      return null
    }
  )

  return <LoggedRequestsPanel requests={dataRequests} />
}

async function ConsentView({
  lookup,
  consentPage,
}: {
  readonly lookup: ReturnType<typeof parseAdminLookupParams>
  readonly consentPage: number
}) {
  const consentRecords = await getAdminConsentRecords(
    consentPage,
    lookup.size
  ).catch((error: unknown) => {
    console.error("Admin consent readback failed", error)
    return null
  })

  return (
    <ConsentLogPanel
      result={consentRecords}
      hrefForPage={(page) =>
        buildLookupHref("/admin/privacy", {
          panel: "consent",
          venue: lookup.venue,
          contact: lookup.contact,
          consentPage: page,
          size: lookup.size,
        })
      }
    />
  )
}
