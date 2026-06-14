import { notFound } from "next/navigation"

import { CustomerFlowPreviewScreen } from "@/app/dev/customer-flow/preview/screens"
import {
  customerFlowPreviewStep,
  isCustomerFlowPreviewStepId,
} from "@/lib/dev/customer-flow-preview"

type CustomerFlowPreviewPageProps = {
  params: Promise<{
    step: string
  }>
}

export default async function CustomerFlowPreviewPage({
  params,
}: CustomerFlowPreviewPageProps) {
  const { step } = await params

  if (!isCustomerFlowPreviewStepId(step)) {
    notFound()
  }

  const previewStep = customerFlowPreviewStep(step)

  return (
    <div data-customer-flow-preview={step} data-screen-label={previewStep.screenLabel}>
      <CustomerFlowPreviewScreen stepId={step} />
    </div>
  )
}
