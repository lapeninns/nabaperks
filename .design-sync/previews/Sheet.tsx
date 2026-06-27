import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
  SheetClose,
  Button,
} from "nabaperks"

export const Default = () => (
  <div className="max-w-md">
    <Sheet defaultOpen>
      <SheetTrigger asChild>
        <Button variant="outline">Member details</Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Priya N.</SheetTitle>
          <SheetDescription>
            Member at Bridge Street Coffee since March. 8 of 8 stamps on the
            current card.
          </SheetDescription>
        </SheetHeader>
        <div className="px-6 text-sm text-muted-foreground">
          Last visit Tue 11:04. Free flat white is ready to redeem at the
          counter.
        </div>
        <SheetFooter>
          <Button variant="reward">Redeem free flat white</Button>
          <SheetClose asChild>
            <Button variant="outline">Close</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  </div>
)

export const BottomSheet = () => (
  <div className="max-w-md">
    <Sheet defaultOpen>
      <SheetTrigger asChild>
        <Button variant="stamp">Add stamp</Button>
      </SheetTrigger>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>Stamp added</SheetTitle>
          <SheetDescription>
            Marcus L. now has 6 of 8 stamps at Maple &amp; Rye. 2 more for a
            free pastry.
          </SheetDescription>
        </SheetHeader>
        <SheetFooter>
          <SheetClose asChild>
            <Button>Done</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  </div>
)

export const Closed = () => (
  <div className="max-w-md">
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">Open member panel</Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Dana R.</SheetTitle>
          <SheetDescription>
            2 of 8 stamps at Bridge Street Coffee.
          </SheetDescription>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  </div>
)
