import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const rewardTicketSource = await readFile(
  new URL("../../components/loyalty/reward-ticket.tsx", import.meta.url),
  "utf8"
)
const heroSource = await readFile(
  new URL(
    "../../components/marketing/landing/hero-sample-card.tsx",
    import.meta.url
  ),
  "utf8"
)

test("Given a reward ticket context When its heading level is chosen Then h3 stays the default and h2 is supported", () => {
  assert.match(rewardTicketSource, /headingLevel: Heading = "h3"/)
  assert.match(rewardTicketSource, /headingLevel\?: "h2" \| "h3"/)
  assert.match(rewardTicketSource, /<Heading[\s>]/)
})

test("Given the homepage sample reward When it renders Then it explicitly requests h2", () => {
  assert.match(heroSource, /<RewardTicket[\s\S]*?headingLevel="h2"/)
})
