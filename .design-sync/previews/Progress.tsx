import { Progress } from "nabaperks"

export const Default = () => (
  <div className="max-w-sm">
    <Progress value={60} />
  </div>
)

export const Values = () => (
  <div className="grid max-w-sm gap-4">
    <Progress value={25} />
    <Progress value={60} />
    <Progress value={100} />
  </div>
)

export const StampProgress = () => (
  <div className="grid max-w-sm gap-2">
    <div className="flex items-center justify-between text-sm">
      <span className="font-medium">Bridge Street Coffee</span>
      <span className="text-muted-foreground">5 of 8 stamps</span>
    </div>
    <Progress value={62.5} />
  </div>
)
