import type { ReactNode } from "react"

import { cn } from "@/lib/utils"
import {
  CUSTOMER_COLUMN_BOTTOM,
  CUSTOMER_COLUMN_INSET,
  CUSTOMER_COLUMN_MIN_H,
  CUSTOMER_COLUMN_TOP,
} from "./customer-column"

export function CustomerShell({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <main
      id="main"
      /* One customer rhythm, declared once (CUS 02#5). This shell used to add
         `sm:pt-10 sm:pb-10` on top of `pt-6`, so the same 410px column sat 40px
         down the page next to a sibling screen's 20px. */
      className={cn(
        "flex justify-center bg-background",
        CUSTOMER_COLUMN_MIN_H,
        CUSTOMER_COLUMN_INSET,
        CUSTOMER_COLUMN_TOP,
        CUSTOMER_COLUMN_BOTTOM
      )}
    >
      {/* One customer column: the shared 410px token (CUS-P2-12/16). */}
      <div className={cn("w-full max-w-customer min-w-0", className)}>
        {children}
      </div>
    </main>
  )
}
