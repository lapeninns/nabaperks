import type { ReactNode } from "react"
import Link from "next/link"
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons"

import { Icon, Logo } from "@/components/brand"
import { cn } from "@/lib/utils"

/** The welcome journey's paper column. Navigation remains ordinary page links. */
export function OfferFlowShell({
  children,
  backHref,
  label,
  className,
}: {
  children: ReactNode
  backHref?: string
  label?: string
  className?: string
}) {
  return (
    <main className="min-h-dvh bg-background text-foreground sm:px-6 sm:py-8">
      <div className="mx-auto w-full max-w-customer">
        <header className="flex min-h-16 items-center justify-between gap-3 border-b border-line px-5 py-2 max-[374px]:px-4">
          {backHref ? (
            <>
              <Link
                href={backHref}
                aria-label="Back"
                className="focus-ring grid size-11 shrink-0 place-items-center rounded-lg"
              >
                <Icon icon={ArrowLeft01Icon} size={20} />
              </Link>
              <span className="min-w-0 text-center font-extrabold break-words">
                {label}
              </span>
              <span aria-hidden="true" className="size-11 shrink-0" />
            </>
          ) : (
            <>
              <Logo
                href="/home"
                className="gap-2 text-xl [&>span:first-child]:size-7"
              />
              <span className="mono-id shrink-0 text-right">
                Your local.
                <br />
                Your perks.
              </span>
            </>
          )}
        </header>
        <div
          className={cn(
            "grid min-w-0 gap-6 px-5 pt-6 pb-8 max-[374px]:px-4",
            className
          )}
        >
          {children}
        </div>
      </div>
    </main>
  )
}

export function OfferVenueLine({ children }: { children: ReactNode }) {
  return (
    <p className="mono-meta flex items-center gap-3 text-sm text-foreground after:h-0.5 after:min-w-8 after:flex-1 after:bg-ink">
      <span className="min-w-0 break-words">{children}</span>
    </p>
  )
}
