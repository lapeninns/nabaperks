import { buildCustomerFlowPreviewLinks } from "@/app/dev/customer-flow/preview/screens"
import { CustomerFlowPlaybook } from "@/app/dev/customer-flow/playbook"
import {
  CUSTOMER_FLOW_DEMO,
  customerFlowStatusFromRow,
  getCustomerFlowStatus,
  type CustomerFlowStatus,
} from "@/lib/dev/customer-flow-demo"

export const dynamic = "force-dynamic"

type CustomerFlowHarnessPageProps = {
  searchParams: Promise<{
    message?: string
    error?: string
  }>
}

type StatusResult =
  | { readonly status: CustomerFlowStatus; readonly error: null }
  | { readonly status: null; readonly error: string }

export default async function CustomerFlowHarnessPage({
  searchParams,
}: CustomerFlowHarnessPageProps) {
  const query = await searchParams
  const statusResult = await loadStatus()
  const status =
    statusResult.status ??
    customerFlowStatusFromRow({
      phone: CUSTOMER_FLOW_DEMO.phone,
      row: null,
      latestReward: null,
    })
  const links = buildCustomerFlowPreviewLinks()
  const otpCode = process.env.CUSTOMER_DEV_OTP_CODE ?? "424242"

  return (
    <CustomerFlowPlaybook
      status={status}
      links={links}
      otpCode={otpCode}
      message={query.message}
      error={query.error}
      statusError={statusResult.error ?? undefined}
    />
  )
}

async function loadStatus(): Promise<StatusResult> {
  try {
    return { status: await getCustomerFlowStatus(), error: null }
  } catch (error) {
    if (error instanceof Error) {
      return { status: null, error: error.message }
    }

    throw error
  }
}
