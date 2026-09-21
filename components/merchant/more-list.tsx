import Link from "next/link"
import type { ComponentProps } from "react"
import { Logout01Icon } from "@hugeicons/core-free-icons"

import { Icon, Logo, MonoTag } from "@/components/brand"
import { Button } from "@/components/ui/button"
import type { MoreRow } from "@/lib/merchant/more-model"

/**
 * The More screen (handoff §6.4): everything configured once, as two
 * receipt lists split by a dashed rule. Rows are 58px, left-aligned, title
 * plus one live line of state, mono chevron. Log out keeps the sign-out
 * form and is not styled destructive; it is reversible.
 */
export function MoreList({
  rows,
  signOutAction,
  logoutPending = false,
}: {
  rows: readonly MoreRow[]
  signOutAction: ComponentProps<"form">["action"]
  /** Harness only: pin the in-flight log out state. */
  logoutPending?: boolean
}) {
  return (
    <div className="mx-auto grid w-full max-w-[35rem] gap-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl leading-tight font-extrabold">More</h1>
        <Logo linked={false} compact />
      </div>

      <nav aria-label="More" data-more-list>
        <ul className="surface-card divide-y-2 divide-dashed divide-line overflow-hidden p-0">
          {rows.map((row) => (
            <li key={row.key}>
              <Link
                href={row.href}
                prefetch={false}
                data-more-row={row.key}
                className="focus-ring flex min-h-[3.625rem] items-center gap-3 px-4 py-2 text-left transition-colors duration-[var(--w-dur-fast)] ease-[var(--w-ease)] hover:bg-paper-deep/60 motion-reduce:transition-none"
              >
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span className="text-sm leading-5 font-extrabold text-foreground">
                    {row.title}
                  </span>
                  {row.subtitle || row.chip ? (
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      {row.subtitle ? (
                        <span
                          className="truncate text-xs leading-5 text-muted-foreground"
                          data-more-subtitle
                        >
                          {row.subtitle}
                        </span>
                      ) : null}
                      {row.chip ? (
                        <MonoTag tone="sun">{row.chip}</MonoTag>
                      ) : null}
                    </span>
                  ) : null}
                </span>
                <span aria-hidden="true" className="mono-meta text-ink-soft">
                  ›
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div
        aria-hidden="true"
        className="w-rule border-t-2 border-dashed border-line-strong"
      />

      <form action={signOutAction} className="surface-card p-3">
        <Button
          type="submit"
          variant="secondary"
          size="lg"
          className="w-full justify-start"
          disabled={logoutPending}
          aria-busy={logoutPending}
        >
          <Icon icon={Logout01Icon} size={18} />
          {logoutPending ? "Logging out…" : "Log out"}
        </Button>
      </form>
    </div>
  )
}
