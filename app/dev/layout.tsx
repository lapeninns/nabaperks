import type { ReactNode } from "react"
import { notFound } from "next/navigation"

import { isCustomerFlowDevHarnessEnabled } from "@/lib/dev/customer-flow-gate"

export default function DevLayout({ children }: { children: ReactNode }) {
  if (!isCustomerFlowDevHarnessEnabled()) {
    notFound()
  }

  return children
}
