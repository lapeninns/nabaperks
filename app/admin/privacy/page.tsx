import { PageTitle } from "@/components/brand"
import { canRenderAdminPage } from "@/lib/admin/auth"
import {
  getAdminConsentRecords,
  getAdminPrivacySupportRows,
} from "@/lib/admin/data"

import { ConsentLogPanel } from "./consent-log-panel"
import { DataRequestWorkflowPanel } from "./data-request-workflow-panel"

export default async function AdminPrivacyPage() {
  if (!(await canRenderAdminPage())) return null

  const [supportRows, consentRecords] = await Promise.all([
    getAdminPrivacySupportRows(),
    getAdminConsentRecords(),
  ])

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Internal admin"
        title="Privacy support"
        description="Consent readback and audited support actions for privacy, export, deletion, and opt-out requests."
      />

      <DataRequestWorkflowPanel supportRows={supportRows} />
      <ConsentLogPanel consentRecords={consentRecords} />
    </div>
  )
}
