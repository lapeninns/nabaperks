import Link from "next/link"

import { Button } from "@/components/ui/button"

export function MarketingHeaderNav() {
  return (
    <nav aria-label="Public">
      <Button asChild size="sm">
        <Link href="/signup">Start free pilot</Link>
      </Button>
    </nav>
  )
}
