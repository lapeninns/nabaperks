import {
  ReceiptCard,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  MonoTag,
  VenueMark,
} from "nabaperks"

export const Default = () => (
  <div className="max-w-sm">
    <ReceiptCard edge>
      <CardHeader>
        <CardDescription>Bridge Street Coffee</CardDescription>
        <CardTitle>Stamp 8 of 8</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-6 text-muted-foreground">
          Your card is full — your next flat white is on the house.
        </p>
      </CardContent>
    </ReceiptCard>
  </div>
)

export const RedemptionReceipt = () => (
  <div className="max-w-sm">
    <ReceiptCard edge rotated padding="lg">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <VenueMark name="Bridge Street Coffee" size={44} />
          <MonoTag tone="leaf">Redeemed</MonoTag>
        </div>
        <CardTitle>Free flat white</CardTitle>
        <CardDescription>Order #4821 · 27 Jun, 8:14am</CardDescription>
      </CardHeader>
      <CardFooter className="justify-between font-mono text-xs font-bold tracking-[0.06em] text-muted-foreground uppercase">
        <span>10 stamps reset</span>
        <span>Bridge Street</span>
      </CardFooter>
    </ReceiptCard>
  </div>
)

export const FreshStamp = () => (
  <div className="max-w-sm">
    <ReceiptCard shaken padding="md">
      <CardHeader>
        <CardDescription className="flex items-center gap-2">
          <MonoTag tone="accent">+1 stamp</MonoTag>
        </CardDescription>
        <CardTitle>2 more until your reward</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-6 text-muted-foreground">
          Stamp 6 of 8 landed at Old Crown Girton. Keep the streak going.
        </p>
      </CardContent>
    </ReceiptCard>
  </div>
)

export const Padding = () => (
  <div className="grid max-w-sm gap-4">
    <ReceiptCard padding="sm">
      <p className="text-sm font-bold">Tight — padding=&quot;sm&quot;</p>
    </ReceiptCard>
    <ReceiptCard padding="lg" edge>
      <p className="text-sm font-bold">Roomy — padding=&quot;lg&quot; with edge</p>
    </ReceiptCard>
  </div>
)
