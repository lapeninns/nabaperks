import { Tabs, TabsList, TabsTrigger, TabsContent } from "nabaperks"

export const Default = () => (
  <div className="max-w-md">
    <Tabs defaultValue="stamps">
      <TabsList>
        <TabsTrigger value="stamps">Stamps</TabsTrigger>
        <TabsTrigger value="rewards">Rewards</TabsTrigger>
        <TabsTrigger value="history">History</TabsTrigger>
      </TabsList>
      <TabsContent value="stamps" className="pt-3 text-muted-foreground">
        5 of 8 stamps collected at Bridge Street Coffee. 3 more for a free flat
        white.
      </TabsContent>
      <TabsContent value="rewards" className="pt-3 text-muted-foreground">
        No rewards ready yet. Your free flat white unlocks at 8 stamps.
      </TabsContent>
      <TabsContent value="history" className="pt-3 text-muted-foreground">
        Last stamp added Tue 11:04 by Priya at the counter.
      </TabsContent>
    </Tabs>
  </div>
)

export const LineVariant = () => (
  <div className="max-w-md">
    <Tabs defaultValue="rewards">
      <TabsList variant="line">
        <TabsTrigger value="stamps">Stamps</TabsTrigger>
        <TabsTrigger value="rewards">Rewards</TabsTrigger>
        <TabsTrigger value="history">History</TabsTrigger>
      </TabsList>
      <TabsContent value="stamps" className="pt-3 text-muted-foreground">
        Collect stamps at Maple &amp; Rye to fill your card.
      </TabsContent>
      <TabsContent value="rewards" className="pt-3 text-muted-foreground">
        Free pastry ready to redeem. Show this at the counter.
      </TabsContent>
      <TabsContent value="history" className="pt-3 text-muted-foreground">
        Redeemed a free flat white last Saturday.
      </TabsContent>
    </Tabs>
  </div>
)

export const Vertical = () => (
  <div className="max-w-md">
    <Tabs defaultValue="rewards" orientation="vertical">
      <TabsList>
        <TabsTrigger value="stamps">Stamps</TabsTrigger>
        <TabsTrigger value="rewards">Rewards</TabsTrigger>
        <TabsTrigger value="history">History</TabsTrigger>
      </TabsList>
      <TabsContent value="stamps" className="text-muted-foreground">
        2 of 6 stamps on your current card.
      </TabsContent>
      <TabsContent value="rewards" className="text-muted-foreground">
        1 free pastry waiting to be claimed.
      </TabsContent>
      <TabsContent value="history" className="text-muted-foreground">
        12 stamps collected across 3 visits this month.
      </TabsContent>
    </Tabs>
  </div>
)
