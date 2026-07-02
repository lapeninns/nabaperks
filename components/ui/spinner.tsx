import { cn } from "@/lib/utils"
import { HugeiconsIcon } from "@hugeicons/react"
import { Loading03Icon } from "@hugeicons/core-free-icons"

/**
 * The one loading glyph. Adopted by `SubmitButton` (components/forms), where
 * it renders decorative (`aria-hidden`) because the button announces the
 * pending state itself via `aria-busy` + the pending label. Standalone uses
 * keep the default `role="status"`. `animate-spin` is the sanctioned CSS
 * animation exception to "motion lives in Framer" (DESIGN.md Motion) and is
 * neutralised under reduced motion.
 */
function Spinner({
  className,
  ...props
}: Omit<React.ComponentProps<"svg">, "strokeWidth">) {
  return (
    <HugeiconsIcon
      icon={Loading03Icon}
      strokeWidth={2}
      role="status"
      aria-label="Loading"
      data-slot="spinner"
      className={cn("size-4 animate-spin motion-reduce:animate-none", className)}
      {...props}
    />
  )
}

export { Spinner }
