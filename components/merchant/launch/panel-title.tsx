import type { ReactNode } from "react"

import { Eyebrow } from "@/components/brand"
import { cn } from "@/lib/utils"

/**
 * PageTitle's visual voice at panel rank (`<h2>`). Launch tabs and /app/qr
 * render these panels UNDER a page-level h1 (launch/page.tsx keeps a single
 * h1 by design; app/app/qr/page.tsx has its own PageTitle), so an in-panel
 * PageTitle would mint a second h1 on the document (MER-P2-14). If PageTitle
 * ever grows a `headingLevel` prop, this helper collapses into it.
 */
export function PanelTitle({
  eyebrow,
  title,
  description,
  className,
  titleClassName,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  className?: string
  titleClassName?: string
}) {
  return (
    <div className={cn("grid min-w-0 gap-3", className)}>
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <h2
        className={cn(
          "max-w-3xl min-w-0 text-3xl leading-tight font-extrabold text-balance break-words text-foreground sm:text-4xl",
          titleClassName
        )}
      >
        {title}
      </h2>
      {description ? (
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  )
}
