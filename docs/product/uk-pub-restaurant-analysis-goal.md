# UK Pub-Restaurant Concept Analysis Goal

## Goal

Produce an in-depth, repo-grounded analysis of whether Nabaperks is the right
software concept for UK pubs with restaurants: independent pubs,
pub-restaurants, inns, village pubs, and small hospitality groups serving both
drinks and food.

This is an analysis-only goal. Do not edit product code, commit, create
Micro-Specs, or implement changes unless the user explicitly asks afterward.

## Target Market

Focus on UK hospitality operators where food and drinks both matter:

- Independent village pubs
- City pubs with food
- Food-led pubs and pub-restaurants
- Wet-led pubs that also serve food
- Inns with repeat local trade
- Small multi-site pub groups

## Required Repo Grounding

Inspect the real checkout before making claims:

- `README.md`
- `AGENTS.md`
- `DESIGN.md`
- `micro-specs/README.md`
- `micro-specs/GLOBAL_CONTEXT.md`
- `package.json`
- `app/**`
- `components/**`
- `lib/**`
- `supabase/migrations/**`
- `tests/**`
- Relevant `docs/**` and `reports/**`

Use the Nabaperks source-of-truth order:

1. Live app code, Supabase migrations, and checked-in configuration.
2. `DESIGN.md` for visual language and component conventions.
3. `AGENTS.md` for repo working rules.
4. `micro-specs/GLOBAL_CONTEXT.md` for reusable governance constraints.
5. Active Micro-Spec files only.
6. Historical docs or draft specs only as background, not implementation truth.

## Analysis Questions

### Target Customer Fit

- Does Nabaperks solve a real problem for UK pubs with restaurants?
- Which operator type fits best: village pub, city pub, food-led pub, wet-led
  pub with food, inn, small group, or independent restaurant-pub?
- Is the app simple enough for busy bar and floor staff?
- Does it work naturally around bar ordering, table service, Sunday roasts,
  lunch trade, evening drinks, and regular locals?
- Would a pub owner understand the value within 30 seconds?

### Pub-Specific Use Cases

Evaluate whether the current app supports or could support:

- Regulars coming back weekly
- Lunch loyalty
- Sunday roast bookings or return visits
- Coffee and soft-drink stamps during daytime trade
- Food-led rewards instead of generic discounts
- Bar staff quickly validating customers
- Multiple venues under one operator
- Staff turnover and low-training workflows
- Fraud prevention without slowing service
- Local community loyalty rather than generic SaaS-style points

### Concept Strength

Answer directly:

- Is QR/self-service stamp loyalty for UK pubs with restaurants a strong enough
  wedge?
- Is the current concept too narrow, too broad, or correctly focused?
- Should Nabaperks stay loyalty-first, become a pub customer-retention platform,
  or move toward venue operations/CRM?
- What is differentiated versus existing loyalty cards, Stamp Me,
  Square/Toast-style loyalty, booking systems, and EPOS-adjacent tools?

### Product Improvements

Rank opportunities specifically for UK pubs with restaurants:

- Food reward design: free starter, dessert, coffee, kids meal, roast upgrade,
  regulars' perk
- Visit frequency mechanics
- Quiet-day campaigns
- Birthday and local regular rewards
- Booking-linked loyalty
- EPOS or receipt-linked future integrations
- Merchant dashboard insights a pub owner would actually use
- Staff-safe redemption flows
- Multi-site pub group support
- GDPR, privacy, and alcohol-marketing sensitivity, verified from current
  primary sources before making legal claims

For every idea, include:

- Pub problem solved
- Commercial value
- Evidence from current repo or app
- Operational friction
- Technical risk
- Whether it is Now, Next, Later, or Avoid

## Readiness Reporting

Do not collapse readiness into one green claim. Report separately:

- Local code/build readiness
- DB/RLS/ledger readiness
- Browser journey readiness
- Merchant/staff workflow readiness
- Provider readiness: Stripe, Supabase remote, Resend, Twilio, and Web Push
- Production/staging readiness
- UK pub market readiness

## Non-Destructive Verification

Run non-destructive checks if feasible:

- `pnpm governance:check`
- `pnpm typecheck`
- `pnpm build`
- Targeted read-only tests or Playwright checks when needed

Do not run destructive DB reset or migration commands against non-local
databases. Browser-only proof does not count as DB, RLS, webhook, billing, or
provider proof.

## Required Output

The final report must use this structure:

1. Direct Verdict
   - Keep, refine, or pivot the concept for UK pubs with restaurants.
2. Best-Fit Customer
   - Define the exact pub or pub-restaurant profile Nabaperks should target
     first.
3. What We Built
   - Explain the current product in pub-operator language.
4. Strongest Fit
   - Rank what already works well for UK pubs.
5. Weakest Fit
   - Rank what feels misaligned, missing, or too generic.
6. Concept Improvement Roadmap
   - Now, Next, Later, and Avoid, with pub-specific reasoning.
7. Software Improvement Roadmap
   - Architecture, UX, provider proof, tests, governance, performance,
     accessibility, and operations.
8. Evidence Table
   - Files inspected, commands run, routes checked, and what each proved.
9. 30-Day Recommendation
   - A practical plan to make Nabaperks sharper for UK pubs with restaurants
     without bloating the product.
