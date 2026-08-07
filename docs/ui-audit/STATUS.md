# UI audit — per-finding status

Branch `feat/ui-redesign-audit-fixes`. `[x]` shipped and verified, `[~]` partly
done (remainder blocked — see NEEDS-SIGNOFF.md), `[ ]` outstanding.

Every `[x]` was verified with `pnpm lint`, `pnpm typecheck`, `pnpm quality:fast`
(958 tests) and `pnpm build` before commit.

## 05-design-system.md — 32 done / 1 partial / 34 open (of 67)

|     | ID    | Priority | Finding                                                                                |
| --- | ----- | -------- | -------------------------------------------------------------------------------------- |
| [x] | 05#1  | High     | The radius scale is declared four sizes wider than the contract and is being used      |
| [x] | 05#2  | Critical | Twenty-two different ways to draw "the Wet Ink card"                                   |
| [x] | 05#3  | Medium   | `--radius-sheet` never becomes a utility, so sheets are hand-numbered                  |
| [ ] | 05#4  | High     | `--border` / `--input` at 18% ink fails WCAG 1.4.11 for every 1px boundary             |
| [x] | 05#5  | High     | Sun (`--seal`) is unusable as a foreground yet is exposed as `text-sun`                |
| [x] | 05#6  | Medium   | `.eyebrow` bakes in a colour, so it cannot be used on the inverted band                |
| [ ] | 05#7  | Medium   | 141 declared custom properties; ~74 have zero `var()` consumers                        |
| [ ] | 05#8  | High     | QR tokens exist but every QR surface hard-codes `bg-white`                             |
| [x] | 05#9  | High     | `<h1>` renders at six different sizes; `<h2>` at eleven                                |
| [x] | 05#10 | High     | Fonts are loaded at 400/700 only, but the system specifies 500 and 800                 |
| [ ] | 05#11 | Medium   | Twenty-one hand-rolled `text-[…]` sizes below or around the sanctioned micro scale     |
| [ ] | 05#12 | Low      | Eleven distinct `tracking-[…]` values against a two-value contract                     |
| [ ] | 05#13 | High     | Nine declared sizes, six used, and no page-level consistency                           |
| [ ] | 05#14 | Medium   | The `stamp` and `reward` variants are visually identical to `default` / `Badge reward` |
| [x] | 05#15 | Low      | `link` variant's `rounded-none` is silently overridden to 10px by the unlayered layer  |
| [x] | 05#16 | Medium   | Ghost/link press travels 2px down, not the documented 1px settle                       |
| [x] | 05#17 | Medium   | `outline` variant declares a 1px `border-input` that can never render                  |
| [x] | 05#18 | High     | `Card`'s stock 24px radius survives on nested images and its `ring-1` survives everywh |
| [ ] | 05#19 | High     | `Card`'s `overflow-hidden` clips the rotated stamp family                              |
| [ ] | 05#20 | Medium   | `CardTitle` renders at `text-base font-medium` and relies on CSS to fix the weight     |
| [ ] | 05#21 | Medium   | `ReceiptCard`'s four padding presets fork the 14/22px spacing contract                 |
| [ ] | 05#22 | High     | Three input heights (44/48/48) and a hand-rolled fourth well                           |
| [ ] | 05#23 | High     | Form labels are 11.5px uppercase mono                                                  |
| [ ] | 05#24 | High     | No password visibility toggle, but a "Confirm password" field on two flows             |
| [ ] | 05#25 | Medium   | `PasswordRequirements` announces a count on every keystroke                            |
| [ ] | 05#26 | High     | `focus-ring` on `tabIndex={-1}` recovery containers never renders                      |
| [ ] | 05#27 | Medium   | `field.tsx` ships 240 lines of which six exports have zero consumers                   |
| [ ] | 05#28 | High     | Two competing inline-notice systems: `Alert` (13 uses) and `StatusBanner` (113)        |
| [ ] | 05#29 | High     | `Badge` ships 7 variants; exactly one is reachable, and its 1.5px border is defeated   |
| [x] | 05#30 | Medium   | `Empty` primitive renders no border and 48px padding; `EmptyState` overrides both      |
| [x] | 05#31 | Medium   | `EmptyState` renders its title as a `<div role="heading">`                             |
| [x] | 05#32 | High     | `Skeleton` fill is 1.3:1 and route skeletons don't mirror their surfaces               |
| [x] | 05#33 | Medium   | `Progress` is 8px tall with no accessible label and no indeterminate state             |
| [x] | 05#34 | Critical | Bottom sheets have no max-height and no internal scroll                                |
| [x] | 05#35 | Medium   | Sheet overlay fades in 150ms while the sheet slides 320ms; and its `shadow-xl` is mean |
| [x] | 05#36 | Medium   | `SidebarMenuButton`'s `size` prop has no effect                                        |
| [x] | 05#37 | High     | The mobile nav drawer hides its close button and offers no visible dismissal           |
| [x] | 05#38 | High     | `Table`'s horizontal-scroll container is a focus stop with no accessible name          |
| [x] | 05#39 | Critical | Only one of four shells has a skip link                                                |
| [x] | 05#40 | High     | `CustomerShell` uses `overflow-x-hidden`, which the codebase's own comment forbids     |
| [x] | 05#41 | Medium   | Four different full-height conventions across shells and boundaries                    |
| [x] | 05#42 | Medium   | `AdminShell` is 80rem wide while `MerchantAppShell` is 72rem                           |
| [ ] | 05#43 | Medium   | `AdminShell` has no desktop sidebar control and no `hideMobileChrome` parity           |
| [x] | 05#44 | Medium   | `AdminShell` sidebar footer stacks four `MonoTag` chips of pure decoration             |
| [x] | 05#45 | Low      | `PageTitle` fakes baseline alignment with `md:pt-8`                                    |
| [x] | 05#46 | Medium   | `CustomerAppShell` reserves 128px of bottom padding for a 56px tab bar                 |
| [ ] | 05#47 | High     | The marketing footer is a 4-column, 13-link, 44px-per-row block on every page          |
| [x] | 05#48 | High     | No error boundary moves focus or announces itself                                      |
| [x] | 05#49 | Medium   | `global-error.tsx` speaks a different design system                                    |
| [ ] | 05#50 | Medium   | Loading fallbacks use `role="status"` on a container with no `aria-live` guarantee and |
| [ ] | 05#51 | Low      | Four route-level `not-found` variants with three different container recipes           |
| [ ] | 05#52 | High     | The reset-password confirm step is ~840px tall on a phone                              |
| [ ] | 05#53 | High     | `SignupVerifyForm` renders three escape-hatch paragraphs containing four 44px links    |
| [ ] | 05#54 | Medium   | `AuthPromptLink` is duplicated verbatim in three files                                 |
| [ ] | 05#55 | High     | OTP resend is a borderless ghost button whose label reflows every second               |
| [ ] | 05#56 | Medium   | Both auth flows use banned "create an account" copy                                    |
| [ ] | 05#57 | High     | `WetInkMarquee` pauses on hover only — no operable pause control                       |
| [ ] | 05#58 | Low      | `WetInkRipple` returns `null`, breaking the documented host-invariance rule            |
| [ ] | 05#59 | Low      | `WetInkWiggle` / `WetInkBreathe` are documented as one-shot but read as loops in the t |
| [x] | 05#60 | Medium   | The global reduced-motion rule nukes `transition-duration` on _everything_, including  |
| [~] | 05#61 | High     | `enableSystem` is on while dark mode is an untested dormant capability                 |
| [x] | 05#62 | High     | `focus-visible` recipe is sound, but seven interactive surfaces opt out of it          |
| [x] | 05#63 | High     | Compact sizes honour 44px on coarse pointers — except the four that don't              |
| [ ] | 05#64 | Medium   | `Icon` sizes are passed as numbers, producing 9 distinct glyph sizes with no scale     |
| [ ] | 05#65 | Medium   | `Section` and `ContrastBand` own marketing rhythm, but nothing owns console/customer r |
| [ ] | 05#66 | Low      | `Section size="default"` is `py-7 sm:py-10` while `ContrastBand` is `py-9 sm:py-12`    |
| [ ] | 05#67 | Low      | `numeric-tabular` exists and is used 42 times, but the countdowns don't use it         |

## Cross-cutting fixes already shipped from the other reports

01#12, 01#63, 02#40, 03#25, 03#28, 03#29, 03#48, 04#1, 04#19, 04#29, 04#33,
04#41, 04#46, 04#48, 04#59.

## 01 / 02 / 03 / 04 — remaining

Not yet swept finding-by-finding. Next planned order: 04-admin (74),
03-merchant (67), 02-customer (70), 01-marketing (69).
