import Link from "next/link"

import { MonoTag } from "@/components/brand"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  PUB_LOYALTY_OPTIONS,
  ROUTES,
  type PubLoyaltyOption,
} from "@/lib/marketing/facts"
import { cn } from "@/lib/utils"

const CAPTION =
  "The four shapes of pub loyalty scheme compared across what they ask, what they cost and where they break"

/**
 * The aspect rows. Presentation labels for `PubLoyaltyOption`'s fields — the
 * compared facts themselves live in `lib/marketing/facts.ts`.
 */
const ASPECTS = [
  { label: "What your guest does", field: "guestDoes" },
  { label: "What you're buying", field: "youBuy" },
  { label: "What you learn", field: "youLearn" },
  { label: "Where it breaks", field: "failsWhen" },
  { label: "Best when", field: "bestWhen" },
] as const satisfies readonly {
  label: string
  field: keyof Omit<PubLoyaltyOption, "key" | "name" | "ours">
}[]

/**
 * The hub's centrepiece: paper / app / wallet pass / QR browser card, compared
 * honestly in all four directions.
 *
 * Our own column is *labelled* as ours rather than quietly styled to win — a
 * comparison the reader can't audit is worth nothing to them. Table from `lg`
 * up (four prose columns need the width); option cards below that, following
 * the guides' established comparison idiom.
 * Server component.
 */
export function OptionsMatrix() {
  return (
    <div className="grid gap-4">
      {/* `Table` supplies its own focusable overflow container — don't nest a
          second scroll region around it. */}
      <div className="hidden rounded-lg border-2 border-ink bg-card lg:block">
        <Table className="min-w-[56rem]">
          <TableCaption className="sr-only">{CAPTION}</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead className="eyebrow w-[10rem]">Aspect</TableHead>
              {PUB_LOYALTY_OPTIONS.map((option) => (
                <TableHead
                  key={option.key}
                  scope="col"
                  className={cn("eyebrow", option.ours && "text-primary")}
                >
                  {option.name}
                  {option.ours ? " · ours" : null}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {ASPECTS.map((aspect) => (
              <TableRow key={aspect.field}>
                <TableHead
                  scope="row"
                  className="align-top text-sm font-bold whitespace-normal text-foreground"
                >
                  {aspect.label}
                </TableHead>
                {PUB_LOYALTY_OPTIONS.map((option) => (
                  <TableCell
                    key={option.key}
                    className={cn(
                      "align-top text-sm leading-6 whitespace-normal",
                      option.ours
                        ? "bg-paper-deep/60 text-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    {option[aspect.field]}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul aria-label={CAPTION} className="grid gap-3 sm:grid-cols-2 lg:hidden">
        {PUB_LOYALTY_OPTIONS.map((option) => (
          <li
            key={option.key}
            className={cn(
              "grid content-start gap-3 rounded-lg border-2 p-4 sm:p-5",
              option.ours
                ? "border-ink bg-card shadow-sm"
                : "border-dashed border-line-strong bg-card"
            )}
          >
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg leading-snug font-extrabold text-foreground">
                {option.name}
              </h3>
              {option.ours ? <MonoTag tone="accent">Ours</MonoTag> : null}
            </div>
            <dl className="grid gap-2">
              {ASPECTS.map((aspect) => (
                <div key={aspect.field} className="grid gap-0.5">
                  <dt className="mono-id text-muted-foreground uppercase">
                    {aspect.label}
                  </dt>
                  <dd className="text-sm leading-6 text-muted-foreground">
                    {option[aspect.field]}
                  </dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>

      <p className="max-w-[68ch] text-sm leading-6 text-muted-foreground">
        Paper and QR are the two most pubs actually choose between.{" "}
        <Link
          href={ROUTES.guidePaperVsQr}
          className="focus-ring rounded-sm font-bold text-primary underline underline-offset-4"
        >
          We compare those two in detail
        </Link>{" "}
        — including what paper genuinely does better.
      </p>
    </div>
  )
}
