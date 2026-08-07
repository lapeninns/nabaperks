import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // Focus + aria-invalid states live in the unlayered Wet Ink layer
        // (app/globals.css [data-slot=input]) — do not re-add ring dialects
        // here; the layer would defeat them anyway.
        "h-12 w-full min-w-0 rounded-2xl border border-input bg-secondary/60 px-4 py-2 text-base transition-[border-color,outline-color] duration-[var(--w-dur-fast)] ease-[var(--w-ease)] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Input }
