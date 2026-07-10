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

/**
 * Privacy support surface. Shares the member lookup capability with the
 * customers page (MS-admin-member-lookup R6) so a GDPR requester can be found
 * by venue or contact fragment regardless of how old their membership is.
 */
export default async function AdminPrivacyPage({
  searchParams,
}: AdminPrivacyPageProps) {
  if (!(await canRenderAdminPage())) return null

  const params = searchParams ? await searchParams : {}
  const lookup = parseAdminLookupParams(params)
  const consentPage = parsePageParam(params.consentPage)
  const unaffiliatedPage = parsePageParam(params.unaffiliatedPage)

  const [supportRows, consentRecords, dataRequests, unaffiliated] =
    await Promise.all([
      getAdminPrivacySupportRows(lookup).catch((error: unknown) => {
        console.error("Admin privacy lookup failed", error)
        return null
      }),
      getAdminConsentRecords(consentPage).catch((error: unknown) => {
        console.error("Admin consent readback failed", error)
        return null
      }),
      getAdminDataRequestActivity().catch((error: unknown) => {
        console.error("Admin data request readback failed", error)
        return null
      }),
      getAdminUnaffiliatedCustomers({
        contact: lookup.contact,
        page: unaffiliatedPage,
      }).catch((error: unknown) => {
        console.error("Admin unaffiliated lookup failed", error)
        return null
      }),
    ])

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Internal admin"
        title="Privacy support"
        description="Consent readback and audited support actions for privacy, export, deletion, and opt-out requests."
      />

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
          })
        }
      />
      <UnaffiliatedCustomersPanel
        result={unaffiliated}
        searching={Boolean(lookup.contact)}
        hrefForPage={(page) =>
          buildLookupHref("/admin/privacy", {
            venue: lookup.venue,
            contact: lookup.contact,
            page: lookup.page,
            consentPage,
            unaffiliatedPage: page,
          })
        }
      />
      <LoggedRequestsPanel requests={dataRequests} />
      <ConsentLogPanel
        result={consentRecords}
        hrefForPage={(page) =>
          buildLookupHref("/admin/privacy", {
            venue: lookup.venue,
            contact: lookup.contact,
            page: lookup.page,
            consentPage: page,
            unaffiliatedPage,
          })
        }
      />
    </div>
  )
}
