import Link from "next/link"
import { ArrowRight02Icon } from "@hugeicons/core-free-icons"

import { Icon } from "@/components/brand"
import { Button } from "@/components/ui/button"
import type { LaunchFlowCta } from "@/lib/merchant/launch-readiness-core"

export function LaunchFlowFooter({ cta }: { cta: LaunchFlowCta | null }) {
  if (!cta) return null

  return (
    <aside className="surface-card grid min-w-0 gap-3 bg-muted p-3 sm:flex sm:items-center sm:justify-between sm:p-4">
      <div className="min-w-0">
        <p className="eyebrow">Next step</p>
        {/* Name the concrete destination. "Keep your setup moving" repeated the
            eyebrow and told the merchant nothing the button had not said. */}
        <p className="text-sm font-semibold text-foreground">
          Continue to {cta.label}
        </p>
      </div>
      <div className="min-w-0 pr-1 pb-1">
        <Button asChild className="group w-full justify-between sm:w-auto">
          <Link href={cta.href}>
            {cta.label}
            <Icon
              icon={ArrowRight02Icon}
              size={15}
              className="transition-transform duration-[var(--w-dur-fast)] group-hover:translate-x-0.5 group-focus-visible:translate-x-0.5 motion-reduce:transition-none"
            />
          </Link>
        </Button>
      </div>
    </aside>
  )
}
