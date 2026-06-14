# Nabaperks Environment Keys

Use `.env.example` as the contract. Keep real values in `.env.local` locally and
in Vercel environment variables for deployed environments.

Run the local key guide:

```bash
pnpm env:keys
```

After collecting values, export them in your shell and write `.env.local`:

```bash
export NEXT_PUBLIC_APP_URL=http://localhost:3000
export NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
export NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
export NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=<pk_test_or_pk_live>
export SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
export SUPABASE_DB_URL=<postgres-connection-url-for-migrations>
export SUPABASE_DB_PASSWORD=<postgres-password-for-linked-pooler>
export STRIPE_SECRET_KEY=<sk_test_or_sk_live>
export STRIPE_GROWTH_PRICE_ID=<price_id>
export STRIPE_WEBHOOK_SECRET=<whsec_secret>
export RESEND_API_KEY=<re_key>

pnpm env:write-local
pnpm env:check
```

Optional analytics:

```bash
export NEXT_PUBLIC_POSTHOG_KEY=<posthog-project-key>
export NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com
```

## Supabase

The Supabase CLI can list projects and project API keys after login:

```bash
pnpm dlx supabase projects list
pnpm dlx supabase projects api-keys --project-ref <ref> --output json
```

To merge the selected project's URL, anon key, and service role key directly
into `.env.local` without printing secrets:

```bash
pnpm env:pull-supabase <ref>
```

Use:

- `NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` from the anon key
- `SUPABASE_SERVICE_ROLE_KEY` from the service role key
- Optional `SUPABASE_DB_URL` from Supabase project database connection settings
  for `pnpm db:setup`, `pnpm db:seed`, and `pnpm db:test:rls`
- Optional `SUPABASE_DB_PASSWORD` with `supabase/.temp/pooler-url` when the
  project is linked locally and `SUPABASE_DB_URL` is not set

Do not expose the service role key to browser code or any `NEXT_PUBLIC_`
variable.

## Stripe

Install and authenticate the Stripe CLI:

```bash
brew install stripe/stripe-cli/stripe
stripe login
```

Webhook secret for local development:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Use the printed `whsec_...` value for `STRIPE_WEBHOOK_SECRET`.

The app also needs:

- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_GROWTH_PRICE_ID`

The publishable and secret API keys come from Stripe API keys. The recurring
Price ID can come from the Stripe dashboard or from Stripe CLI/API commands such
as `stripe prices list`.

## Resend

The Resend CLI can be run through `pnpm dlx`:

```bash
pnpm dlx resend-cli login
pnpm dlx resend-cli api-keys --help
```

Use a `re_...` key for `RESEND_API_KEY`.

After creating the key, merge it locally without printing it:

```bash
RESEND_API_KEY=re_... pnpm env:set-resend
pnpm env:check
```

## PostHog

The PostHog CLI can authenticate for API-backed workflows:

```bash
pnpm dlx @posthog/cli login
```

For this app, the browser analytics values are:

- `NEXT_PUBLIC_POSTHOG_KEY`
- `NEXT_PUBLIC_POSTHOG_HOST`

Get the public project key from PostHog project settings. It should start with
`phc_`; do not use a personal API token that starts with `phx_`.

Merge the browser analytics values locally without printing them:

```bash
NEXT_PUBLIC_POSTHOG_KEY=phc_... NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com pnpm env:set-posthog
pnpm env:check
```

These values are optional for local development.

## Vercel

Vercel can pull and manage environment variables for a linked project:

```bash
pnpm dlx vercel link
pnpm dlx vercel env pull .env.local
pnpm dlx vercel env add <NAME> production
pnpm dlx vercel env add <NAME> preview
```

Use the same variable names as `.env.example`.

To sync all non-empty contract values from `.env.local` into the linked Vercel
project without printing secret values:

```bash
pnpm env:push-vercel production
```

That command adds values missing from the target environment and skips existing
names. Production pushes reject localhost or private `NEXT_PUBLIC_APP_URL`
origins; set it to the live domain first:

```bash
NEXT_PUBLIC_APP_URL=https://nabaperks.com
```

To intentionally rotate or overwrite existing Vercel values from `.env.local`,
run:

```bash
pnpm env:push-vercel production --replace
```
