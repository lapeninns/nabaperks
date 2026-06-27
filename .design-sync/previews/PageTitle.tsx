import { PageTitle, Button } from "nabaperks"

export const Default = () => (
  <PageTitle
    eyebrow="Loyalty"
    title="Your stamp card"
    description="Collect 8 stamps at Bridge Street Coffee and your 9th flat white is on the house."
  />
)

export const WithActions = () => (
  <PageTitle
    eyebrow="Merchant console"
    title="Today at the counter"
    description="142 stamps issued, 11 rewards redeemed since open."
    actions={
      <>
        <Button variant="outline">Export</Button>
        <Button>New campaign</Button>
      </>
    }
  />
)

export const LongTitle = () => (
  <PageTitle
    eyebrow="Welcome back"
    title="Two more stamps until your reward unlocks"
    description="Tap the counter QR on your next visit to keep the streak going."
  />
)
