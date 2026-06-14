You are working in `/Users/amankumarshrestha/LapenInns Project/Nabaperks`.

Goal: redesign all 32 current Next.js pages across the full Nabaperks app, using the attached reference file `/Users/amankumarshrestha/Downloads/Nabaperks v2 Full Flow.html` as the visual direction.

Use the reference’s “Wet Ink” direction:
- Riso-print / rubber-stamp feel
- warm paper background, ink-black text, vermillion accent
- tactile hard offset shadows
- subtle paper grain / print texture
- chunky expressive display type like Bricolage Grotesque
- mono details like Space Mono for codes, stats, IDs, timestamps
- stamped approval moments, short purposeful motion, no generic SaaS gradients
- compact but polished operational surfaces for staff, merchant, and admin routes

Routes to redesign:
1. Public/auth/legal: 6
   - `/`
   - `/login`
   - `/signup`
   - `/pricing`
   - `/privacy`
   - `/terms`

2. Customer/QR/reward/merchant-facing: 7
   - `/q/[qrId]`
   - `/m/[merchantSlug]`
   - `/m/[merchantSlug]/join`
   - `/merchant/[merchantSlug]/terms`
   - `/card/[membershipId]`
   - `/card/[membershipId]/stamp`
   - `/reward/[rewardId]`

3. Staff: 2
   - `/staff`
   - `/staff/stamp`

4. Merchant console `/app`: 9
   - `/app`
   - `/app/activity`
   - `/app/billing`
   - `/app/card`
   - `/app/customers`
   - `/app/onboarding`
   - `/app/qr`
   - `/app/settings`
   - `/app/staff`

5. Admin console `/admin`: 8
   - `/admin`
   - `/admin/audit`
   - `/admin/billing`
   - `/admin/customers`
   - `/admin/fraud`
   - `/admin/merchants`
   - `/admin/pilot`
   - `/admin/privacy`

Hard constraints:
- Read `AGENTS.md`, `nabaperks-micro-specs-final.md`, `docs/ARCHITECTURE.md`, and `DESIGN.md` before editing.
- Read the relevant Next.js docs under `node_modules/next/dist/docs/` before changing route/layout conventions.
- This is a frontend redesign. Preserve backend contracts, route paths, Supabase queries, server actions, FormData names, RPCs, auth behavior, Stripe/webhook behavior, QR binary/download routes, and database semantics.
- Do not widen any micro-spec blast radius.
- Do not add new product features unless needed to make an existing route coherent.
- Do not use `as any`, `@ts-ignore`, or `@ts-expect-error`.
- Do not remove tests or weaken tests.
- Do not change route URLs.

Design system requirements:
- Build shared primitives instead of redesigning each page separately.
- Create/rework reusable components for:
  - shell/layout navigation
  - page headers
  - stamped status badges
  - metric tiles
  - activity/event rows
  - empty states
  - error states
  - loading skeletons
  - QR preview/download panels
  - customer loyalty card
  - approval/code panels
  - staff station controls
  - merchant/admin tables
  - billing plan cards
  - audit/risk timeline
- Use a consistent token system for color, radius, shadows, spacing, typography, and motion.
- Keep cards at 8px radius or less unless the Wet Ink stamp style needs a deliberate exception.
- Use icon buttons where icons are clearer than text.
- All controls must have hover, active, focus, disabled, loading, empty, and error states where applicable.
- Ensure mobile-first layouts for customer/staff flows and dense scan-friendly layouts for merchant/admin flows.
- Use tabular numbers for money, codes, timestamps, counters, and stats.
- Use semantic HTML and accessible labels.
- Respect `prefers-reduced-motion`.

Visual principles:
- Avoid generic AI SaaS design: no purple-blue gradients, no bland white card grids, no oversized empty dashboard cards, no fake-glass panels everywhere.
- Keep the personality strong but the operational pages efficient.
- Public/customer routes should feel warm, trustworthy, and quick.
- Staff routes should be extremely clear under counter pressure: large code, obvious approve/deny actions, strong state feedback.
- Merchant routes should feel like a practical business console: compact summaries, clear next action, readable activity.
- Admin routes should feel serious and auditable: dense tables, risk markers, timeline evidence, restrained visual noise.

Implementation approach:
1. Audit the current `app/**/page.tsx` files and existing components.
2. Map every page to a shared route family and component set.
3. Define/align the Wet Ink design tokens.
4. Build the shared primitives first.
5. Redesign route family by route family.
6. Keep each route functional with its existing data and server actions.
7. Run typecheck, lint, and relevant tests.
8. Start the dev server and manually verify all 32 routes in browser at desktop and mobile widths.
9. Confirm there are no blank pages, overlapping text, broken navigation, inaccessible controls, or missing loading/error/empty states.

Definition of done:
- All 32 pages are visibly redesigned.
- Shared components are used consistently.
- Backend/data/auth/payment/QR behavior is preserved.
- Typecheck passes.
- Lint passes or pre-existing failures are clearly separated.
- Relevant tests pass.
- Browser verification covers every route group.
- Final response lists changed files, verification commands, and any remaining risks.


Shadcn/UI constraint:
- Do not modify core shadcn primitive files directly.
- Do not change the underlying shadcn component API unless absolutely required and approved.
- Treat shadcn components as stable base primitives.
- Compose around them with Nabaperks-specific wrapper components, variants, tokens, and layout components.
- If a shadcn component needs visual changes, prefer:
  1. design tokens in globals/theme files,
  2. className composition at usage sites,
  3. app-specific wrapper components under `components/`,
  4. only then a minimal local extension.
- Do not break existing imports from `components/ui/*`.
- Do not replace shadcn with another UI library.
- Keep Radix accessibility behavior intact.
- Preserve focus rings, keyboard behavior, ARIA wiring, and controlled/uncontrolled component contracts.