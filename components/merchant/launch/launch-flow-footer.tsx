import Link from "next/link"
import { ArrowRight02Icon } from "@hugeicons/core-free-icons"

import { Icon } from "@/components/brand"
import { Button } from "@/components/ui/button"
import type { LaunchFlowCta } from "@/lib/merchant/launch-readiness-core"

export function LaunchFlowFooter({ cta }: { cta: LaunchFlowCta | null }) {
  if (!cta) return null

  return (
    <div className="flex justify-end pt-1">
      <Button asChild className="w-full sm:w-fit">
        <Link href={cta.href}>
          {cta.label}
          <Icon icon={ArrowRight02Icon} size={15} />
        </Link>
      </Button>
    </div>
  )
}
