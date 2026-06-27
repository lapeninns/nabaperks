import { Button } from "nabaperks"

export const Default = () => <Button>Collect stamp</Button>

export const Variants = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Button variant="default">Collect stamp</Button>
    <Button variant="stamp">Stamp it</Button>
    <Button variant="reward">Redeem reward</Button>
    <Button variant="secondary">View card</Button>
    <Button variant="outline">Maybe later</Button>
    <Button variant="ghost">Skip</Button>
    <Button variant="destructive">Remove</Button>
    <Button variant="link">Terms apply</Button>
  </div>
)

export const Sizes = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Button size="sm">Small</Button>
    <Button size="default">Default</Button>
    <Button size="lg">Large</Button>
    <Button size="xl">Extra large</Button>
  </div>
)

export const States = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Button>Enabled</Button>
    <Button disabled>Disabled</Button>
    <Button variant="reward" disabled>
      Reward locked
    </Button>
  </div>
)
