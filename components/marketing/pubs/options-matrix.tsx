import Link from "next/link"

import { MarketingDisclosure } from "@/components/marketing"
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
 * comparison the reader can't audit is worth nothing to them.
 *
 * Table from `xl:` up, not `lg:`. The table is `min-w-[56rem]` (896px) and at
 * `lg` the content column is ~736px after the gutter, the 12rem spine and the
 * gap — so the "table from lg up" scrolled horizontally at every laptop width,
 * losing the aspect label as soon as the reader compared columns three and
 * four. The aspect row label is `sticky left-0` for the widths where it still
 * scrolls.
 *
 * Below `xl:` the comparison is grouped by ASPECT, not by option: five
 * disclosures, first open, each holding all four options for one question.
 * Grouping by option meant four ~380px cards — ~1,550px of vertical read for
 * something whose entire purpose is LATERAL comparison, where the reader had
 * to hold "what your guest does" for Paper in mind while scrolling past 380px
 * to reach it for QR.
 * Server component.
 */
export function OptionsMatrix() {
  return (
    <div className="grid gap-4">
      {/* `Table` supplies its own focusable overflow container — don't nest a
          second scroll region around it. */}
      <div className="surface-card-flat hidden xl:block">
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
                  className="sticky left-0 z-10 bg-card align-top text-sm font-bold whitespace-normal text-foreground"
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

      <ul aria-label={CAPTION} className="grid gap-3 xl:hidden">
        {ASPECTS.map((aspect, index) => (
          <li key={aspect.field}>
            <MarketingDisclosure
              className="surface-card-flat"
              defaultOpen={index === 0}
              summary={aspect.label}
            >
              <dl className="grid gap-3 sm:grid-cols-2">
                {PUB_LOYALTY_OPTIONS.map((option) => (
                  <div
                    key={option.key}
                    className={cn(
                      "grid content-start gap-0.5 border-l-2 pl-3",
                      option.ours ? "border-primary" : "border-border"
                    )}
                  >
                    <dt
                      className={cn(
                        "mono-id uppercase",
                        option.ours ? "text-primary" : "text-muted-foreground"
                      )}
                    >
                      {option.name}
                      {option.ours ? " · ours" : null}
                    </dt>
                    <dd className="text-sm leading-6 text-muted-foreground">
                      {option[aspect.field]}
                    </dd>
                  </div>
                ))}
              </dl>
            </MarketingDisclosure>
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
