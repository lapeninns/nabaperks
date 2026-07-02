import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        // Focus + aria-invalid states live in the unlayered Wet Ink layer
        // (app/globals.css [data-slot=textarea]) — do not re-add ring
        // dialects here; the layer would defeat them anyway.
        "flex field-sizing-content min-h-24 w-full resize-none rounded-2xl border border-input bg-secondary/60 px-4 py-3 text-base leading-6 transition-[border-color,outline-color] duration-[var(--w-dur-fast)] ease-[var(--w-ease)] outline-none placeholder:text-muted-foreground motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
