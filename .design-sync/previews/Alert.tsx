import { Alert, AlertTitle, AlertDescription, AlertAction, Button } from "nabaperks"

export const Default = () => (
  <div className="max-w-md">
    <Alert>
      <AlertTitle>Reward ready to redeem</AlertTitle>
      <AlertDescription>
        You collected 8 stamps at Bridge Street Coffee. Show this card at the
        counter for your free flat white.
      </AlertDescription>
    </Alert>
  </div>
)

export const Destructive = () => (
  <div className="max-w-md">
    <Alert variant="destructive">
      <AlertTitle>Stamp could not be added</AlertTitle>
      <AlertDescription>
        That QR code expired at close yesterday. Ask a barista to scan a fresh
        one on your next visit.
      </AlertDescription>
    </Alert>
  </div>
)

export const WithAction = () => (
  <div className="max-w-md">
    <Alert>
      <AlertTitle>2 stamps from a free pastry</AlertTitle>
      <AlertDescription>
        Keep the streak going at Maple & Rye this week.
      </AlertDescription>
      <AlertAction>
        <Button variant="ghost" size="sm">
          View card
        </Button>
      </AlertAction>
    </Alert>
  </div>
)
