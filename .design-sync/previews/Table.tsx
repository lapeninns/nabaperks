import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from "nabaperks"

export const Default = () => (
  <div className="max-w-2xl">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Member</TableHead>
          <TableHead>Reward</TableHead>
          <TableHead>Venue</TableHead>
          <TableHead className="text-right">Redeemed</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell className="font-medium">Priya N.</TableCell>
          <TableCell>Free flat white</TableCell>
          <TableCell>Bridge Street Coffee</TableCell>
          <TableCell className="text-right">Tue 11:04</TableCell>
        </TableRow>
        <TableRow>
          <TableCell className="font-medium">Marcus L.</TableCell>
          <TableCell>Free pastry</TableCell>
          <TableCell>Maple &amp; Rye</TableCell>
          <TableCell className="text-right">Tue 09:41</TableCell>
        </TableRow>
        <TableRow>
          <TableCell className="font-medium">Dana R.</TableCell>
          <TableCell>Free flat white</TableCell>
          <TableCell>Bridge Street Coffee</TableCell>
          <TableCell className="text-right">Mon 16:22</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
)

export const WithFooter = () => (
  <div className="max-w-2xl">
    <Table>
      <TableCaption>Redemptions this week across both venues.</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Reward</TableHead>
          <TableHead>Venue</TableHead>
          <TableHead className="text-right">Count</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell className="font-medium">Free flat white</TableCell>
          <TableCell>Bridge Street Coffee</TableCell>
          <TableCell className="text-right">18</TableCell>
        </TableRow>
        <TableRow>
          <TableCell className="font-medium">Free pastry</TableCell>
          <TableCell>Maple &amp; Rye</TableCell>
          <TableCell className="text-right">11</TableCell>
        </TableRow>
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={2}>Total redeemed</TableCell>
          <TableCell className="text-right">29</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  </div>
)

export const Compact = () => (
  <div className="max-w-sm">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Member</TableHead>
          <TableHead className="text-right">Stamps</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell className="font-medium">Priya N.</TableCell>
          <TableCell className="text-right">8 / 8</TableCell>
        </TableRow>
        <TableRow>
          <TableCell className="font-medium">Marcus L.</TableCell>
          <TableCell className="text-right">5 / 8</TableCell>
        </TableRow>
        <TableRow>
          <TableCell className="font-medium">Dana R.</TableCell>
          <TableCell className="text-right">2 / 8</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
)
