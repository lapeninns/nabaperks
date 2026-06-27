import { EmptyState, Button } from "nabaperks"
import { GiftIcon, InboxIcon } from "@hugeicons/core-free-icons"

export const Default = () => (
  <div className="max-w-md">
    <EmptyState
      title="No rewards yet"
      description="Collect 8 stamps at Bridge Street Coffee to unlock your first free flat white."
    />
  </div>
)

export const WithIconAndAction = () => (
  <div className="max-w-md">
    <EmptyState
      icon={GiftIcon}
      title="No rewards to redeem"
      description="You're 2 stamps away. Tap the counter QR on your next visit."
      actions={<Button variant="reward">Show my card</Button>}
    />
  </div>
)

export const MerchantInbox = () => (
  <div className="max-w-md">
    <EmptyState
      icon={InboxIcon}
      title="No stamps issued today"
      description="Scan a member's QR at the counter to start the day's tally."
      actions={
        <>
          <Button>Open scanner</Button>
          <Button variant="outline">View yesterday</Button>
        </>
      }
    />
  </div>
)
