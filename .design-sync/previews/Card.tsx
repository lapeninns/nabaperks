import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  CardAction,
  Badge,
  Button,
} from "nabaperks"

export const Default = () => (
  <div className="max-w-sm">
    <Card>
      <CardHeader>
        <CardTitle>Bridge Street Coffee</CardTitle>
        <CardDescription>Collect 8 stamps, earn a free flat white.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          You are 3 stamps away from your next reward. Scan the counter QR on
          every visit to keep collecting.
        </p>
      </CardContent>
      <CardFooter>
        <Button>View stamp card</Button>
      </CardFooter>
    </Card>
  </div>
)

export const WithAction = () => (
  <div className="max-w-sm">
    <Card>
      <CardHeader>
        <CardTitle>Maple & Rye</CardTitle>
        <CardDescription>Loyalty program active</CardDescription>
        <CardAction>
          <Badge variant="secondary">5 of 8</Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Three more stamps unlocks a free pastry of your choice.
        </p>
      </CardContent>
    </Card>
  </div>
)

export const Small = () => (
  <div className="max-w-xs">
    <Card size="sm">
      <CardHeader>
        <CardTitle>Reward unlocked</CardTitle>
        <CardDescription>Free flat white</CardDescription>
      </CardHeader>
      <CardFooter className="border-t">
        <Button variant="reward" size="sm">
          Redeem at counter
        </Button>
      </CardFooter>
    </Card>
  </div>
)
