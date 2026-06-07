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
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-40 border-b bg-card/85 backdrop-blur supports-backdrop-filter:bg-card/75">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-6 py-3">
          <Logo />
          <nav aria-label="Marketing" className="flex items-center gap-2">
            {marketingLinks.map((item) => (
              <Button key={item.href} asChild variant="ghost" size="sm">
                <Link href={item.href}>{item.label}</Link>
              </Button>
            ))}
            <Button asChild size="sm">
              <Link href="/signup">Start trial</Link>
            </Button>
          </nav>
        </div>
      </header>
      <main>{children}</main>
      <footer className="border-t bg-card/70">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-6 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Stampiee. No-app loyalty for local venues.</p>
          <nav aria-label="Legal links" className="flex flex-wrap gap-4">
            <Link className="underline-offset-4 hover:underline" href="/terms">
              Terms
            </Link>
            <Link className="underline-offset-4 hover:underline" href="/privacy">
              Privacy
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
