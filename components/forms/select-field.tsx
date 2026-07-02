import type { SelectHTMLAttributes } from "react"
import { ArrowDown01Icon } from "@hugeicons/core-free-icons"

import { Icon } from "@/components/brand"
import { cn } from "@/lib/utils"

export function SelectField({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className="relative block min-w-0">
      <select
        data-slot="input"
        className={cn(
          "h-12 w-full min-w-0 appearance-none px-4 pr-11 text-sm transition-[border-color,outline-color] duration-[var(--w-dur-fast)] ease-[var(--w-ease)] outline-none motion-reduce:transition-none",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3 grid size-6 -translate-y-1/2 place-items-center text-muted-foreground"
      >
        <Icon icon={ArrowDown01Icon} size={16} strokeWidth={2.25} />
      </span>
    </span>
  )
}
