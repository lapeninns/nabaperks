import { Separator } from "nabaperks"

export const Default = () => (
  <div className="grid max-w-sm gap-3">
    <div className="text-sm font-medium">Bridge Street Coffee</div>
    <Separator />
    <div className="text-sm text-muted-foreground">Collect 8 stamps, earn a free flat white.</div>
  </div>
)

export const Vertical = () => (
  <div className="flex h-5 items-center gap-3 text-sm">
    <span>5 of 8 stamps</span>
    <Separator orientation="vertical" />
    <span className="text-muted-foreground">Joined Apr 2026</span>
  </div>
)

export const InList = () => (
  <div className="grid max-w-sm gap-3 text-sm">
    <div className="flex items-center justify-between">
      <span>Free flat white</span>
      <span className="text-muted-foreground">8 stamps</span>
    </div>
    <Separator />
    <div className="flex items-center justify-between">
      <span>Free pastry</span>
      <span className="text-muted-foreground">12 stamps</span>
    </div>
  </div>
)
