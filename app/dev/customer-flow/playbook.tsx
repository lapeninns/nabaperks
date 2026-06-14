import { CustomerFlowShell } from "@/components/customer/customer-flow-system"
import { StatusBanner } from "@/components/loyalty"
import { JourneyPlaybook } from "@/app/dev/customer-flow/playbook-journey"
import {
  ActionsPanel,
  PlaybookHero,
  PlayFlowHint,
  StatusPanel,
} from "@/app/dev/customer-flow/playbook-panels"
import type { CustomerFlowPreviewLinks } from "@/app/dev/customer-flow/preview/screens"
import type { CustomerFlowStatus } from "@/lib/dev/customer-flow-demo"

type CustomerFlowPlaybookProps = {
  readonly status: CustomerFlowStatus
  readonly links: CustomerFlowPreviewLinks
  readonly otpCode: string
  readonly message?: string
  readonly error?: string
  readonly statusError?: string
}

export function CustomerFlowPlaybook({
  status,
  links,
  otpCode,
  message,
  error,
  statusError,
}: CustomerFlowPlaybookProps) {
  return (
    <CustomerFlowShell
      eyebrow="Dev playbook"
      title="Customer flow playbook"
      description="Every customer screen in one wet-ink run, rendered from mock preview routes."
      screenLabel="Customer flow playbook"
      className="max-w-5xl pb-12"
    >
      {message ? <StatusBanner title={message} tone="success" /> : null}
      {error ? <StatusBanner title={error} tone="error" /> : null}
      {statusError ? (
        <StatusBanner title="Status unavailable" tone="warning">
          {statusError}
        </StatusBanner>
      ) : null}

      <PlaybookHero status={status} />

      <section className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(22rem,1fr)]">
        <StatusPanel status={status} />
        <ActionsPanel />
      </section>

      <PlayFlowHint otpCode={otpCode} status={status} />
      <JourneyPlaybook links={links} />
    </CustomerFlowShell>
  )
}
