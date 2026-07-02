import Link from "next/link"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"

import { Icon, ReceiptCard, SectionHeader } from "@/components/brand"
import { ProgressTrack } from "@/components/loyalty/progress-track"
import { cn } from "@/lib/utils"

const NEXT_ACTION_DOT: Record<"accent" | "sun" | "leaf", string> = {
  accent: "bg-primary",
  sun: "bg-sun",
  leaf: "bg-leaf",
}

export function MerchantNextActions({
  readyCount,
  quietCount,
  repeatCustomers,
  members,
}: {
  readonly readyCount: number
  readonly quietCount: number
  readonly repeatCustomers: number
  readonly members: number
}) {
  return (
    <ReceiptCard className="grid gap-4">
      <SectionHeader title="Do next" />
      <div className="grid gap-1.5">
        <NextActionRow
          href="/app/customers"
          tone={readyCount > 0 ? "accent" : "leaf"}
          label={
            readyCount > 0
              ? `${readyCount} ${readyCount === 1 ? "reward" : "rewards"} ready to redeem`
              : "No rewards waiting, you're all caught up"
          }
        />
        <NextActionRow
          href="/app/customers"
          tone={quietCount > 0 ? "sun" : "leaf"}
          label={
            quietCount > 0
              ? `${quietCount} ${quietCount === 1 ? "member" : "members"} gone quiet`
              : "Every member has visited recently"
          }
        />
      </div>
      <div className="border-t border-dashed border-line pt-4">
        <ProgressTrack
          current={repeatCustomers}
          total={members}
          label="Repeat members"
        />
      </div>
    </ReceiptCard>
  )
}

function NextActionRow({
  href,
  tone,
  label,
}: {
  readonly href: string
  readonly tone: "accent" | "sun" | "leaf"
  readonly label: string
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      className="-mx-2 flex items-center gap-3 rounded-lg border-2 border-transparent px-2 py-2 transition-colors duration-[var(--w-dur-fast)] ease-[var(--w-ease)] hover:border-ink/15 hover:bg-secondary/50 focus-visible:border-ink/15 focus-visible:bg-secondary/50 focus-visible:outline-none motion-reduce:transition-none"
    >
      <span
        className={cn(
          "size-2.5 shrink-0 rounded-full border-2 border-ink",
          NEXT_ACTION_DOT[tone]
        )}
      />
      <span className="min-w-0 flex-1 text-sm font-semibold text-balance">
        {label}
      </span>
      <Icon
        icon={ArrowRight01Icon}
        size={16}
        className="shrink-0 text-ink-soft"
      />
    </Link>
  )
}
