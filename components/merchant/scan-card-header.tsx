import { Eyebrow } from "@/components/brand/typography"

export function ScanCardHeader() {
  return (
    <div className="grid gap-1.5">
      <Eyebrow>Customer codes</Eyebrow>
      <h1 className="text-3xl leading-tight font-extrabold tracking-[-0.01em] sm:text-4xl">
        Scan customer code
      </h1>
      <p className="text-sm leading-6 text-muted-foreground">
        Point your camera at the code on the customer&apos;s phone. It can be a
        reward to collect or a discount pass to honour, and we will open the
        right screen for it.
      </p>
    </div>
  )
}
