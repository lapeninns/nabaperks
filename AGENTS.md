# Nabaperks Agent Guide

This repo is a buildable Next.js app with a retained Wet Ink design system and
a small current AI governance spine.

## Stack

| Layer | Current surface |
| --- | --- |
| Frontend | Next.js App Router, React, Tailwind CSS 4 |
| UI system | `DESIGN.md`, `app/globals.css`, `components/brand`, `components/ui`, `components/motion`, `components/loyalty` |
| Backend | Next.js Route Handlers and Server Actions |
| Database | Supabase Postgres migrations under `supabase/migrations` |
| Auth | Supabase Auth and RLS |
| Payments | Stripe Billing and webhooks |
| Notifications | Resend email, Web Push support, Twilio later |
| Hosting | Vercel |

## Working Rules

- Keep the app buildable. Verify meaningful code changes with `pnpm typecheck`
  and `pnpm build`.
- Treat the design system as the durable product contract. Preserve
  `DESIGN.md`, `app/globals.css`, and the shared component foundations.
- Treat `micro-specs/README.md`, `micro-specs/GLOBAL_CONTEXT.md`,
  `Instructions_MircroSpecsCreation.md`, and `Instructions_tdd.md` as
  governance only unless an active Micro-Spec exists.
- Keep governance current-only. Add planning packs, generated route docs,
  screenshot evidence folders, design-source mirrors, or `.omo` evidence files
  only when the user explicitly asks for them.
- Read the relevant Next.js 16 guide in `node_modules/next/dist/docs/` before
  changing app-router APIs, route handlers, server actions, or config.
- Server state remains authoritative. Browser storage is cache only; loyalty and
  billing-affecting changes must stay server-side and auditable.

## Design System

Wet Ink is the active visual language: warm paper, hard ink borders, offset
shadows, short British copy, and stamp-led interactions. Runtime styling lives
in `app/globals.css` and the shared components; design-tool exports are not
tracked runtime inputs.

## AI Governance

The governance spine is deliberately small:

- `Instructions_MircroSpecsCreation.md` defines how to author future
  Micro-Specs.
- `Instructions_tdd.md` defines the implementation workflow when an active spec
  and its required harness exist.
- `micro-specs/README.md` is the governance index, lifecycle policy, and current
  gate list.
- `micro-specs/GLOBAL_CONTEXT.md` holds reusable project constraints.

There are currently no active feature Micro-Specs checked in. Do not treat
absent spec paths as implementation input.
