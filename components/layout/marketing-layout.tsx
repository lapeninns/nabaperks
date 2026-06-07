import type { ReactNode } from "react"
import Link from "next/link"

import { Logo } from "@/components/brand"
import { Button } from "@/components/ui/button"

const marketingLinks = [
  { href: "/pricing", label: "Pricing" },
  { href: "/login", label: "Log in" },
]

export function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-svh overflow-x-clip bg-background">
      <header className="sticky top-0 z-40 border-b bg-card/85 backdrop-blur supports-backdrop-filter:bg-card/75">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-[auto_minmax(0,1fr)] items-center gap-3 px-4 py-3 sm:px-6">
          <Logo className="max-[420px]:[&>span:last-child]:sr-only" />
          <nav
            aria-label="Marketing"
            className="flex min-w-0 flex-wrap items-center justify-end gap-2"
          >
            {marketingLinks.map((item) => (
              <Button key={item.href} asChild variant="ghost" size="sm">
                <Link href={item.href}>{item.label}</Link>
              </Button>
            ))}
            <Button asChild size="sm" className="hidden min-[430px]:inline-flex">
              <Link href="/signup">Start trial</Link>
            </Button>
            <Button
              asChild
              size="sm"
              className="px-3 min-[430px]:hidden"
              aria-label="Start trial"
            >
              <Link href="/signup">Start</Link>
            </Button>
          </nav>
        </div>
      </header>
      <main>{children}</main>
      <footer className="border-t bg-card/70">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-6 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Stampiee. No-app loyalty for local venues.</p>
          <nav aria-label="Legal links" className="flex flex-wrap gap-2">
            <Link
              className="inline-flex min-h-11 items-center rounded-full px-3 underline-offset-4 hover:bg-accent hover:text-accent-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/35 focus-visible:outline-none"
              href="/terms"
            >
              Terms
            </Link>
            <Link
              className="inline-flex min-h-11 items-center rounded-full px-3 underline-offset-4 hover:bg-accent hover:text-accent-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/35 focus-visible:outline-none"
              href="/privacy"
            >
              Privacy
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
