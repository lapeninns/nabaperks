import { Spinner, Button } from "nabaperks"

export const Default = () => <Spinner />

export const Sizes = () => (
  <div className="flex flex-wrap items-center gap-4">
    <Spinner className="size-4" />
    <Spinner className="size-6" />
    <Spinner className="size-8" />
  </div>
)

export const InButton = () => (
  <Button disabled>
    <Spinner />
    Adding stamp…
  </Button>
)
