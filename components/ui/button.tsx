import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * Focus: the shared `.pressable` outline recipe (globals.css) — no private
 * ring dialects here. Press: bordered variants translate into their shadow
 * via the unlayered layer; ghost/link stay flat bar a 1px settle. Sizes are
 * honest: compact sizes render as declared on fine pointers and grow to the
 * 44px tap floor on coarse pointers (the FilterPills pattern), including
 * width for icon sizes.
 *
 * Radius: `rounded-lg` (10px, `--radius`), matching the unlayered
 * `[data-slot="button"]` rule. The base string carried `rounded-full` — a v1
 * "Honey & Ink" pill that DESIGN.md · Brand & Style records as "fully
 * superseded" — and it read as dead code because the ink layer beats every
 * layered utility. It was only dead on a real `<Button>`. `buttonVariants` is
 * also exported and applied to plain elements that carry no `data-slot`, and
 * there the layer never matches: measured on a production build, the same
 * class string rendered `border-radius: 3.3554e+07px` with `border-width: 0px`
 * on a plain element and `10px` / `2px` once `data-slot="button"` was present.
 * The two must agree, so the base declares the same 10px the layer does.
 */
const buttonVariants = cva(
  "pressable inline-flex shrink-0 items-center justify-center gap-2 rounded-lg text-sm font-bold whitespace-nowrap transition-[color,background-color,border-color,box-shadow,transform] duration-[var(--w-dur-fast)] ease-[var(--w-ease)] outline-none disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=size-])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
        // `reward` is the one sanctioned second filled silhouette (leaf), for
        // reward collection. A `stamp` variant used to sit beside it rendering
        // bg-stamp/text-stamp-foreground — but --stamp resolves to --w-accent,
        // exactly as --primary does, so it was a pixel-identical duplicate of
        // `default`, and it had zero call sites. Removed.
        reward: "bg-reward text-reward-foreground shadow-xs hover:bg-reward/90",
        secondary:
          "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
        // Border/radius/shadow come from the unlayered [data-slot="button"]
        // rule; declaring them here is dead weight that misreads as live.
        outline: "bg-background hover:bg-accent hover:text-accent-foreground",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        destructive:
          "bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90",
        link: "h-auto rounded-none p-0 text-primary underline-offset-4 shadow-none hover:underline",
      },
      size: {
        xs: "h-8 min-h-8 px-3 text-xs [@media(pointer:coarse)]:min-h-11",
        sm: "h-9 min-h-9 px-4 text-sm [@media(pointer:coarse)]:min-h-11",
        default: "h-11 px-5 py-2",
        lg: "h-12 px-6 text-base",
        xl: "h-14 px-7 text-base",
        icon: "size-11",
        "icon-xs":
          "size-8 min-h-8 [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11",
        "icon-sm":
          "size-9 min-h-9 [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
