import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
  Button,
} from "nabaperks"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Coffee02Icon,
  QrCodeIcon,
  GiftIcon,
} from "@hugeicons/core-free-icons"

export const Default = () => (
  <div className="max-w-md">
    <Empty>
      <EmptyHeader>
        <EmptyTitle>No stamps yet</EmptyTitle>
        <EmptyDescription>
          Scan the counter QR at Bridge Street Coffee to collect your first
          stamp. Eight stamps gets you a free flat white.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  </div>
)

export const WithMedia = () => (
  <div className="max-w-md">
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <HugeiconsIcon icon={Coffee02Icon} strokeWidth={2} />
        </EmptyMedia>
        <EmptyTitle>Your card is empty</EmptyTitle>
        <EmptyDescription>
          Start your loyalty card at Maple &amp; Rye. Stamps appear here the
          moment a barista scans your code.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  </div>
)

export const WithAction = () => (
  <div className="max-w-md">
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <HugeiconsIcon icon={QrCodeIcon} strokeWidth={2} />
        </EmptyMedia>
        <EmptyTitle>No card scanned</EmptyTitle>
        <EmptyDescription>
          Add Bridge Street Coffee to start collecting stamps toward your free
          flat white.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="stamp">Scan counter QR</Button>
      </EmptyContent>
    </Empty>
  </div>
)

export const NoRewards = () => (
  <div className="max-w-md">
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <HugeiconsIcon icon={GiftIcon} strokeWidth={2} />
        </EmptyMedia>
        <EmptyTitle>No rewards to redeem</EmptyTitle>
        <EmptyDescription>
          You are 3 stamps away from your next free pastry at Maple &amp; Rye.
          Keep the streak going.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline">View stamp card</Button>
      </EmptyContent>
    </Empty>
  </div>
)
