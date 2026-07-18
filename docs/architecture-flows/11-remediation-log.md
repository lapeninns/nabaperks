# Architecture Remediation Ledger

Updated: 2026-07-18.

This file records the current release gates after the public acquisition site
was removed. Historical acquisition-page remediation details and their retired
test commands were removed with the deleted surface.

## Current Boundaries

- The site root returns 404 through the root not-found boundary.
- Merchant sign-up, login, verification, and password reset remain available.
- Privacy, platform terms, cookie notice, merchant terms, and data-processing
  pages share the minimal public shell.
- Merchant, customer, admin, API, QR, reward, and offline flows retain their
  existing server-state and indexing controls.
- `PUBLIC_SITE_ROUTES` drives sitemap discovery for sign-up and the five legal
  documents only.
- Root organisation JSON-LD remains emitted by the shared application layout.

## Required Repository Gates

- `pnpm quality:fast`
- `pnpm deadcode:check`
- `pnpm build`
- `pnpm jsonld:check`
- `pnpm claims:check`
- `pnpm smoke:providers`
- `pnpm smoke:supabase:migrations`
- `pnpm env:check:production`

## Service-Backed Gates

The following remain separate from source-only readiness and require configured
services or a disposable local environment:

- `pnpm test:db`
- `pnpm test:e2e`
- `pnpm test:a11y`
- `pnpm test:visual`

Do not infer provider or production readiness from local source checks alone.
