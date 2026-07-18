# Public Entry, Legal, And Meta Flows

Flows covered: 1-8.

## Axis Architecture

The public acquisition website has been removed. The site root intentionally
resolves through the root not-found boundary. The remaining public surface is
limited to merchant sign-up, the legal pack, the offline page, and generated
metadata endpoints. Auth and legal pages share a minimal Wet Ink shell with a
logo, one merchant sign-up action, and links to all five legal documents.

`PUBLIC_SITE_ROUTES` is the authoritative sitemap registry. It contains only
merchant sign-up and the five legal documents. The authenticated merchant app,
customer journeys, merchant-specific terms, API routes, and admin tools retain
their existing trust boundaries.

## Flow Analysis

| ID  | Flow             | Architecture                                                                            | Primary boundary                                            |
| --- | ---------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 1   | Root not found   | Deleting the App Router root page lets the root not-found boundary return HTTP 404.     | No redirect or replacement acquisition content.             |
| 2   | Merchant sign-up | Public auth page under the focused minimal shell.                                       | Account creation and telemetry remain server-authoritative. |
| 3   | Privacy notice   | Static legal page under the minimal shell.                                              | Copy and operator contact remain public.                    |
| 4   | Platform terms   | Static legal page under the minimal shell.                                              | Legal wording remains shared with product behaviour.        |
| 5   | Cookie notice    | Static legal document rendered by the shared legal page component.                      | Browser-storage disclosure only.                            |
| 6   | Merchant terms   | Static merchant subscription terms under the shared legal shell.                        | Commercial terms remain aligned with billing facts.         |
| 7   | Data processing  | Static merchant data-processing schedule under the shared legal shell.                  | Processing roles and retention remain explicit.             |
| 8   | Offline and meta | Offline fallback, sitemap, robots, manifest, OpenGraph image, and organisation JSON-LD. | Sitemap discovery is limited to the surviving registry.     |

## Verification

- The site root must return HTTP 404.
- Merchant sign-up and every legal document must render through the minimal
  shell without links to removed acquisition routes.
- Sitemap and `llms.txt` must contain exactly the surviving public registry.
- Authenticated, stateful, customer, merchant, admin, and API surfaces retain
  their existing indexing and server-state controls.
