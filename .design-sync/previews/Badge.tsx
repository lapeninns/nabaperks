import { Badge } from "nabaperks"

export const Default = () => <Badge>New</Badge>

export const Variants = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Badge variant="default">Reward ready</Badge>
    <Badge variant="secondary">5 of 8 stamps</Badge>
    <Badge variant="destructive">Expired</Badge>
    <Badge variant="outline">Members only</Badge>
    <Badge variant="ghost">Bonus week</Badge>
    <Badge variant="link">View card</Badge>
  </div>
)

export const Statuses = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Badge variant="default">Free flat white</Badge>
    <Badge variant="secondary">Bridge Street Coffee</Badge>
    <Badge variant="outline">Joined Apr 2026</Badge>
  </div>
)
