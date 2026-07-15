# Copy Inventory — Admin + Public Merchant Pages

_Scope: app/admin/** (root, layout, error, loading, actions, audit, billing, customers, fraud, pilot, privacy, merchants); app/merchant/[merchantSlug]/** (terms page + loading); components/admin/**. `shared:` strings resolved from lib/admin/*, components/layout/admin-shell + console-nav, lib/customer/consent._

## Admin root (overview) — `app/admin/page.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Admin console | route title | app/admin/page.tsx:34 | inline |
| Internal admin | eyebrow | app/admin/page.tsx:51 | inline |
| Admin console | heading | app/admin/page.tsx:52 | inline |
| Restricted support views and audited manual actions. | subhead | app/admin/page.tsx:53 | inline |
| Merchants | metric label | app/admin/page.tsx:58 | inline |
| Customers | metric label | app/admin/page.tsx:63 | inline |
| Billing issues | metric label | app/admin/page.tsx:68 | inline |
| Pilot funnel readback | section heading | app/admin/page.tsx:76 | inline |
| The eight-stage merchant-to-redemption journey, counted from Supabase product events. | section subhead | app/admin/page.tsx:77 | inline |
| Source: product_events | source label | app/admin/page.tsx:78 | inline |
| Recent audited actions | section heading | app/admin/page.tsx:84 | inline |
| The last six entries from the audit trail; times in UK local time. | section subhead | app/admin/page.tsx:85 | inline |
| Source: audit_logs | source label | app/admin/page.tsx:86 | inline |
| Recent audited actions | aria-label | app/admin/page.tsx:89 | inline |
| No audited actions yet | empty-state title | app/admin/page.tsx:96 | inline |
| Audited support actions will appear here as operators work. | empty-state body | app/admin/page.tsx:97 | inline |
| View audit log | button/link | app/admin/page.tsx:104 | inline |
| No merchant | fallback text (audit row) | app/admin/page.tsx:135 | inline |
| Overview | nav label | app/admin/page.tsx:116 (renders adminNavItems) | shared:console-nav |
| Pilot | nav label | app/admin/page.tsx:116 | shared:console-nav |
| Merchants | nav label | app/admin/page.tsx:116 | shared:console-nav |
| Customers | nav label | app/admin/page.tsx:116 | shared:console-nav |
| Billing | nav label | app/admin/page.tsx:116 | shared:console-nav |
| Privacy | nav label | app/admin/page.tsx:116 | shared:console-nav |
| Fraud | nav label | app/admin/page.tsx:116 | shared:console-nav |
| Audit | nav label | app/admin/page.tsx:116 | shared:console-nav |

## Admin layout (access shell) — `app/admin/layout.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Internal admin | eyebrow | app/admin/layout.tsx:19 | inline |
| Access denied | heading | app/admin/layout.tsx:21 | inline |
| Internal admin access is required. | denial reason body | app/admin/layout.tsx:24 (access.reason) | shared:auth |
| Admin MFA verification is required. | denial reason body | app/admin/layout.tsx:24 (access.reason) | shared:auth |

## Admin shell (chrome around every /admin page) — `components/layout/admin-shell.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Nabaperks Admin | logo label | components/layout/admin-shell.tsx:42, 87 | shared:admin-shell |
| Admin navigation | nav aria-label | components/layout/admin-shell.tsx:46 | shared:admin-shell |
| Operator: {email} | footer tag | components/layout/admin-shell.tsx:58 | shared:admin-shell |
| Service-role readbacks | footer tag | components/layout/admin-shell.tsx:19 | shared:admin-shell |
| Audited support actions | footer tag | components/layout/admin-shell.tsx:20 | shared:admin-shell |
| MFA-aware access | footer tag | components/layout/admin-shell.tsx:21 | shared:admin-shell |
| AAL2 verified | footer status tag / title | components/layout/admin-shell.tsx:73, 77 | shared:admin-shell |
| Admin verified | footer status tag / title | components/layout/admin-shell.tsx:73, 77 | shared:admin-shell |
| MFA enforcement is enabled for this admin session. | banner | components/layout/admin-shell.tsx:99 | shared:admin-shell |

## Admin error boundary — `app/admin/error.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| This admin view hit an error | empty-state title | app/admin/error.tsx:25 | inline |
| The view could not load safely. Retry, and if it keeps happening check the server logs. | empty-state body | app/admin/error.tsx:29-30 | inline |
| Log reference: {digest} | inline detail | app/admin/error.tsx:32 | inline |
| Retry | button | app/admin/error.tsx:39 | inline |

## Admin loading skeleton — `app/admin/loading.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Loading admin workspace | loading aria-label | app/admin/loading.tsx:14 | inline |

## Admin server actions (inline result/validation messages) — `app/admin/actions.ts`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Membership and stamp delta are required. | validation error | app/admin/actions.ts:46 | inline |
| Operator reason is required. | validation error | app/admin/actions.ts:49, 82, 118, 156, 194, 232 | inline |
| Stamp adjustment failed. Try again or review audit logs. | error toast/inline | app/admin/actions.ts:61 | inline |
| Stamps adjusted. Logged to the audit trail. | success inline | app/admin/actions.ts:67 | inline |
| Reward is required. | validation error | app/admin/actions.ts:79 | inline |
| Reward cancellation failed. Try again or review audit logs. | error inline | app/admin/actions.ts:93 | inline |
| Reward cancelled. Logged to the audit trail. | success inline | app/admin/actions.ts:99 | inline |
| Fraud flag is required. | validation error | app/admin/actions.ts:112 | inline |
| Fraud flag status is invalid. | validation error | app/admin/actions.ts:115 | inline |
| Fraud flag update failed. Try again or review audit logs. | error inline | app/admin/actions.ts:130 | inline |
| Flag marked reviewed. Logged to the audit trail. | success inline | app/admin/actions.ts:138 | inline |
| Flag dismissed. Logged to the audit trail. | success inline | app/admin/actions.ts:139 | inline |
| QR code is required. | validation error | app/admin/actions.ts:153, 191 | inline |
| QR update failed. Try again or review audit logs. | error inline | app/admin/actions.ts:168 | inline |
| QR code enabled. Logged to the audit trail. | success inline | app/admin/actions.ts:177 | inline |
| QR code disabled. Logged to the audit trail. | success inline | app/admin/actions.ts:178 | inline |
| QR regeneration failed. Try again or review audit logs. | error inline | app/admin/actions.ts:205 | inline |
| QR code regenerated. Logged to the audit trail. | success inline | app/admin/actions.ts:212 | inline |
| Customer and merchant context are required. | validation error | app/admin/actions.ts:229, 268 | inline |
| Consent opt-out failed. Try again or review audit logs. | error inline | app/admin/actions.ts:247 | inline |
| Opt-out recorded. Logged to the audit trail. | success inline | app/admin/actions.ts:253 | inline |
| Request type is required. | validation error | app/admin/actions.ts:271 | inline |
| Support channel is required. | validation error | app/admin/actions.ts:274 | inline |
| Support notes are required. | validation error | app/admin/actions.ts:277, 321 | inline |
| Data request log failed. Try again or review audit logs. | error inline | app/admin/actions.ts:291 | inline |
| Data request logged to the audit trail. | success inline | app/admin/actions.ts:297 | inline |
| Merchant context is required. | validation error | app/admin/actions.ts:315 | inline |
| Note type is required. | validation error | app/admin/actions.ts:318 | inline |
| Setup check minutes must be a number. | validation error | app/admin/actions.ts:325 | inline |
| Setup check minutes must be between 1 and 3. | validation error | app/admin/actions.ts:328 | inline |
| Pilot note log failed. Try again or review audit logs. | error inline | app/admin/actions.ts:341 | inline |
| Pilot note logged to the audit trail. | success inline | app/admin/actions.ts:347 | inline |

## Admin — Audit logs — `app/admin/audit/page.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Admin — Audit logs | route title | app/admin/audit/page.tsx:20 | inline |
| Internal admin | eyebrow | app/admin/audit/page.tsx:31 | inline |
| Audit logs | heading | app/admin/audit/page.tsx:31 | inline |
| Actor, action, context, timestamp, and non-sensitive metadata. Newest first, times in UK local time. | subhead | app/admin/audit/page.tsx:32 | inline |
| Source: audit_logs | source label | app/admin/audit/page.tsx:37 | inline |
| Admin audit log readback | table caption | app/admin/audit/page.tsx:41 | inline |
| No audit logs yet | empty-state title | app/admin/audit/page.tsx:49 | inline |
| Audited support and security-sensitive actions will appear here. | empty-state body | app/admin/audit/page.tsx:50 | inline |
| Actor | table header / card label | app/admin/audit/page.tsx:62, 103 | inline |
| Context | table header / card label | app/admin/audit/page.tsx:66, 108 | inline |
| No merchant | fallback text | app/admin/audit/page.tsx:69, 114 | inline |
| Target | table header / card label | app/admin/audit/page.tsx:79, 124 | inline |
| When | table header / card label | app/admin/audit/page.tsx:83, 129 | inline |
| Action | table header | app/admin/audit/page.tsx:98 | inline |

## Admin — Billing — `app/admin/billing/page.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Account | cross-link | app/admin/billing/page.tsx:29 | inline |
| Members | cross-link | app/admin/billing/page.tsx:35 | inline |
| Admin — Billing | route title | app/admin/billing/page.tsx:41 | inline |
| Internal admin | eyebrow | app/admin/billing/page.tsx:52 | inline |
| Billing | heading | app/admin/billing/page.tsx:52 | inline |
| Stripe subscription state synced into Supabase. | subhead | app/admin/billing/page.tsx:53 | inline |
| Source: billing_customers | source label | app/admin/billing/page.tsx:58 | inline |
| Admin billing subscription readback | table caption | app/admin/billing/page.tsx:61 | inline |
| No billing records yet | empty-state title | app/admin/billing/page.tsx:71 | inline |
| Merchant | table header | app/admin/billing/page.tsx:77 | inline |
| Plan | table header / card label | app/admin/billing/page.tsx:92, 147 | inline |
| Status | table header | app/admin/billing/page.tsx:96 | inline |
| Period end | table header / card label | app/admin/billing/page.tsx:103, 149 | inline |
| Updated {date} | inline metadata | app/admin/billing/page.tsx:111 | inline |
| Stripe refs | table header | app/admin/billing/page.tsx:118 | inline |
| Subscription {ref} | inline metadata | app/admin/billing/page.tsx:122 | inline |
| Customer {ref} | inline metadata | app/admin/billing/page.tsx:124 | inline |
| Email | card label | app/admin/billing/page.tsx:141 | inline |
| Links | card label | app/admin/billing/page.tsx:144 | inline |
| Updated | card label | app/admin/billing/page.tsx:153 | inline |
| Stripe subscription | card label | app/admin/billing/page.tsx:157 | inline |
| Stripe customer | card label | app/admin/billing/page.tsx:161 | inline |
| No plan | plan fallback value | app/admin/billing/page.tsx (row.plan) | shared:billing-data |
| Active / Trial / Trialing / Past due / Incomplete / Cancelled / Suspended / No billing record | status pill labels | app/admin/billing/page.tsx:99 (statusLabel) | shared:billing-redaction |

## Admin — Customers (page) — `app/admin/customers/page.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Admin — Customers | route title | app/admin/customers/page.tsx:14 | inline |
| Internal admin | eyebrow | app/admin/customers/page.tsx:51 | inline |
| Customers | heading | app/admin/customers/page.tsx:51 | inline |
| Customer lookup with audited stamp and reward support actions. | subhead | app/admin/customers/page.tsx:52 | inline |

## Admin — Customers: Memberships panel — `app/admin/customers/customer-memberships-panel.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Memberships | section heading | app/admin/customers/customer-memberships-panel.tsx:43 | inline |
| Search every membership by venue or masked-contact fragment. Masked customer contacts and merchant-scoped stamp counters from service-role support reads. | section subhead | app/admin/customers/customer-memberships-panel.tsx:44 | inline |
| Source: service-role admin readback | source label | app/admin/customers/customer-memberships-panel.tsx:46 | inline |
| Membership lookup | lookup form label/aria | app/admin/customers/customer-memberships-panel.tsx:50 | inline |
| Admin customer membership support readback | table caption | app/admin/customers/customer-memberships-panel.tsx:56 | inline |
| No matching memberships | empty-state title | app/admin/customers/customer-memberships-panel.tsx:66 | inline |
| Adjust the venue or contact search, or clear it to see the newest memberships. | empty-state body | app/admin/customers/customer-memberships-panel.tsx:67 | inline |
| No customer memberships yet | empty-state title | app/admin/customers/customer-memberships-panel.tsx:73 | inline |
| Merchant | card label | app/admin/customers/customer-memberships-panel.tsx:86 | inline |
| Stamps | card label / table header | app/admin/customers/customer-memberships-panel.tsx:90, 141 | inline |
| {n} current · {n} total | inline value | app/admin/customers/customer-memberships-panel.tsx:93-94, 143-144 | inline |
| Rewards redeemed | card label / table header | app/admin/customers/customer-memberships-panel.tsx:99, 151 | inline |
| Joined | card label / table header | app/admin/customers/customer-memberships-panel.tsx:107, 159 | inline |
| Customer | table header | app/admin/customers/customer-memberships-panel.tsx:122 | inline |
| Audited action | table header | app/admin/customers/customer-memberships-panel.tsx:172 | inline |
| Membership pages | pagination nav label | app/admin/customers/customer-memberships-panel.tsx:180 | inline |
| memberships | pagination unit | app/admin/customers/customer-memberships-panel.tsx:181 | inline |
| Membership lookup unavailable | error-state title | app/admin/customers/customer-memberships-panel.tsx:190 | inline |
| Delta | form field label | app/admin/customers/customer-memberships-panel.tsx:206 | inline |
| Positive adds stamps, negative removes them. | field helper | app/admin/customers/customer-memberships-panel.tsx:207 | inline |
| Reason | form field label | app/admin/customers/customer-memberships-panel.tsx:212 | inline |
| Adjusting… | submit pending label | app/admin/customers/customer-memberships-panel.tsx:216 | inline |
| Adjust stamps | submit button | app/admin/customers/customer-memberships-panel.tsx:218 | inline |

## Admin — Customers: Rewards panel — `app/admin/customers/customer-rewards-panel.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Rewards | section heading | app/admin/customers/customer-rewards-panel.tsx:39 | inline |
| Assigned reward readbacks preserve customer masking and require a reason before cancellation. | section subhead | app/admin/customers/customer-rewards-panel.tsx:40 | inline |
| Source: service-role admin readback | source label | app/admin/customers/customer-rewards-panel.tsx:41 | inline |
| Admin reward support readback | table caption | app/admin/customers/customer-rewards-panel.tsx:47 | inline |
| No rewards yet | empty-state title | app/admin/customers/customer-rewards-panel.tsx:55 | inline |
| Reward | fallback value / table header | app/admin/customers/customer-rewards-panel.tsx:68, 104, 110 | inline |
| Context | card label / table header | app/admin/customers/customer-rewards-panel.tsx:72, 116 | inline |
| Merchant | fallback value | app/admin/customers/customer-rewards-panel.tsx:75, 123 | inline |
| Created | card label / table header | app/admin/customers/customer-rewards-panel.tsx:81, 135 | inline |
| No action available | inline text | app/admin/customers/customer-rewards-panel.tsx:94, 154 | inline |
| Status | table header | app/admin/customers/customer-rewards-panel.tsx:130 | inline |
| Audited action | table header | app/admin/customers/customer-rewards-panel.tsx:148 | inline |
| Reward pages | pagination nav label | app/admin/customers/customer-rewards-panel.tsx:163 | inline |
| reward events | pagination unit | app/admin/customers/customer-rewards-panel.tsx:164 | inline |
| Reward readback unavailable | error-state title | app/admin/customers/customer-rewards-panel.tsx:174 | inline |
| Reason | form field label | app/admin/customers/customer-rewards-panel.tsx:185 | inline |
| Cancelling permanently removes this unlocked reward from the member; it cannot be undone. The action is written to the audit log. | field helper | app/admin/customers/customer-rewards-panel.tsx:187 | inline |
| I understand this cancellation cannot be undone. | confirm-check label | app/admin/customers/customer-rewards-panel.tsx:191 | inline |
| Cancelling… | submit pending label | app/admin/customers/customer-rewards-panel.tsx:192 | inline |
| Cancel reward | submit button | app/admin/customers/customer-rewards-panel.tsx:194 | inline |

## Admin — Fraud (page) — `app/admin/fraud/page.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Admin — Fraud | route title | app/admin/fraud/page.tsx:8 | inline |
| Internal admin | eyebrow | app/admin/fraud/page.tsx:19 | inline |
| Fraud | heading | app/admin/fraud/page.tsx:19 | inline |
| Fraud flags, soft geofence anomalies, and security-related product events. | subhead | app/admin/fraud/page.tsx:20 | inline |

## Admin — Fraud: Flags panel — `app/admin/fraud/fraud-flags-panel.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Fraud flags | section heading | app/admin/fraud/fraud-flags-panel.tsx:54 | inline |
| Security support signals with masked customer context and bucketed location evidence. | section subhead | app/admin/fraud/fraud-flags-panel.tsx:55 | inline |
| Source: service-role admin readback | source label | app/admin/fraud/fraud-flags-panel.tsx:56 | inline |
| Admin fraud flag readback | table caption | app/admin/fraud/fraud-flags-panel.tsx:59 | inline |
| No fraud flags yet | empty-state title | app/admin/fraud/fraud-flags-panel.tsx:67 | inline |
| Signal | table header | app/admin/fraud/fraud-flags-panel.tsx:74 | inline |
| Context | table header | app/admin/fraud/fraud-flags-panel.tsx:83 | inline |
| Evidence | table header / card label | app/admin/fraud/fraud-flags-panel.tsx:95, 137 | inline |
| Severity | table header | app/admin/fraud/fraud-flags-panel.tsx:99 | inline |
| Status | table header | app/admin/fraud/fraud-flags-panel.tsx:106 | inline |
| When | table header / card label | app/admin/fraud/fraud-flags-panel.tsx:111, 139 | inline |
| Review | table header | app/admin/fraud/fraud-flags-panel.tsx:120 | inline |
| Merchant | card label | app/admin/fraud/fraud-flags-panel.tsx:135 | inline |
| Customer | card label | app/admin/fraud/fraud-flags-panel.tsx:136 | inline |
| location {status} · distance {bucket} · accuracy {bucket} | inline evidence | app/admin/fraud/fraud-flags-panel.tsx:167-169 | inline |
| confidence {value} | inline evidence | app/admin/fraud/fraud-flags-panel.tsx:172 | inline |
| · cycle stamp {n} | inline evidence | app/admin/fraud/fraud-flags-panel.tsx:174 | inline |
| Mark reviewed | action button label | app/admin/fraud/fraud-flags-panel.tsx:193 | inline |
| Dismiss | action button label | app/admin/fraud/fraud-flags-panel.tsx:199 | inline |
| Review reason | form field label | app/admin/fraud/fraud-flags-panel.tsx:225 | inline |
| Dismissal reason | form field label | app/admin/fraud/fraud-flags-panel.tsx:225 | inline |
| Saving… | submit pending label | app/admin/fraud/fraud-flags-panel.tsx:230 | inline |

## Admin — Fraud: Redemption failures panel — `app/admin/fraud/redemption-failures-panel.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Redemption failures | section heading | app/admin/fraud/redemption-failures-panel.tsx:26 | inline |
| Product-event failures retained for support analysis without exposing raw RPC payloads. | section subhead | app/admin/fraud/redemption-failures-panel.tsx:27 | inline |
| Source: product_events | source label | app/admin/fraud/redemption-failures-panel.tsx:28 | inline |
| Admin redemption failure event readback | table caption | app/admin/fraud/redemption-failures-panel.tsx:31 | inline |
| No redemption failures yet | empty-state title | app/admin/fraud/redemption-failures-panel.tsx:40 | inline |
| Event | table header | app/admin/fraud/redemption-failures-panel.tsx:45 | inline |
| Merchant | table header / card label / fallback | app/admin/fraud/redemption-failures-panel.tsx:52, 57, 80, 83 | inline |
| When | table header / card label | app/admin/fraud/redemption-failures-panel.tsx:60, 83 | inline |

## Admin — Pilot readiness — `app/admin/pilot/page.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Admin — Pilot readiness | route title | app/admin/pilot/page.tsx:28 | inline |
| Internal admin | eyebrow | app/admin/pilot/page.tsx:42 | inline |
| Pilot readiness | heading | app/admin/pilot/page.tsx:42 | inline |
| Launch gates, source-backed funnel metrics, and merchant pilot notes. | subhead | app/admin/pilot/page.tsx:43 | inline |
| Pilot report | section heading | app/admin/pilot/page.tsx:65 | inline |
| Event counts come from Supabase product events. Derived rates, billing state, and interview notes are labelled separately. | section subhead | app/admin/pilot/page.tsx:66 | inline |
| Source: product_events | source label | app/admin/pilot/page.tsx:70 | inline |
| Source: merchants table | source label | app/admin/pilot/page.tsx:71 | inline |
| Source: billing_customers | source label | app/admin/pilot/page.tsx:72 | inline |
| Pilot readiness source-labelled metrics | table caption | app/admin/pilot/page.tsx:77 | inline |
| No pilot metrics available yet | empty-state title | app/admin/pilot/page.tsx:85 | inline |
| Pilot metrics appear here once the report source returns data. | empty-state body | app/admin/pilot/page.tsx:86 | inline |
| Value | card label / table header | app/admin/pilot/page.tsx:94, 116 | inline |
| Pilot target | card label / table header | app/admin/pilot/page.tsx:99, 124 | inline |
| Source | card label / table header | app/admin/pilot/page.tsx:101, 130 | inline |
| Source: {source} | source label (row) | app/admin/pilot/page.tsx:102, 133 | inline |
| Metric | table header | app/admin/pilot/page.tsx:110 | inline |
| Pilot merchant notes | section heading | app/admin/pilot/page.tsx:142 | inline |
| Capture support notes, cancellation reasons, payment objections, and self-service launch checks as audited admin records. | section subhead | app/admin/pilot/page.tsx:143 | inline |
| Source: audit_logs | source label | app/admin/pilot/page.tsx:144 | inline |
| Account | card label | app/admin/pilot/page.tsx:157 | inline |
| Billing | card label | app/admin/pilot/page.tsx:161 | inline |
| no billing record | fallback value | app/admin/pilot/page.tsx:164 | inline |
| Note type | form field label | app/admin/pilot/page.tsx:183 | inline |
| Support note | select option | app/admin/pilot/page.tsx:190 | inline |
| Interview note | select option | app/admin/pilot/page.tsx:191 | inline |
| Payment objection | select option | app/admin/pilot/page.tsx:193 | inline |
| Cancellation reason | select option | app/admin/pilot/page.tsx:195 | inline |
| Self-service launch check | select option | app/admin/pilot/page.tsx:198 | inline |
| Setup check minutes | form field label | app/admin/pilot/page.tsx:204 | inline |
| Optional for self-service launch checks. | field helper | app/admin/pilot/page.tsx:205 | inline |
| 1-3 | input placeholder | app/admin/pilot/page.tsx:212 | inline |
| Notes | form field label | app/admin/pilot/page.tsx:216 | inline |
| What happened, source, and next action | textarea placeholder | app/admin/pilot/page.tsx:224 | inline |
| Saving… | submit pending label | app/admin/pilot/page.tsx:228 | inline |
| Save note | submit button | app/admin/pilot/page.tsx:232 | inline |
| No pilot merchants yet | empty-state title | app/admin/pilot/page.tsx:244 | inline |

### Pilot checklist tiles + metric rows (rendered on pilot page) — `shared:pilot-report`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Pilot size | checklist tile label | lib/admin/pilot-report.ts:65 | shared:pilot-report |
| 10-20 merchants | checklist tile target | lib/admin/pilot-report.ts:66 | shared:pilot-report |
| Launch offer | checklist tile label | lib/admin/pilot-report.ts:75 | shared:pilot-report |
| 30 days free, then GBP 29/mo | checklist tile target | lib/admin/pilot-report.ts:76 | shared:pilot-report |
| Configured | checklist tile value | lib/admin/pilot-report.ts:77 | shared:pilot-report |
| Pilot window | checklist tile label | lib/admin/pilot-report.ts:80 | shared:pilot-report |
| 60-90 days | checklist tile target | lib/admin/pilot-report.ts:81 | shared:pilot-report |
| Tracked | checklist tile value | lib/admin/pilot-report.ts:82 | shared:pilot-report |
| Self-service launch proof | checklist tile label | lib/admin/pilot-report.ts:85 | shared:pilot-report |
| QR and venue checks complete | checklist tile target | lib/admin/pilot-report.ts:86 | shared:pilot-report |
| Merchant signups | metric label | lib/admin/pilot-report.ts:91 | shared:pilot-report |
| Cards created | metric label | lib/admin/pilot-report.ts:93 | shared:pilot-report |
| QR codes created | metric label | lib/admin/pilot-report.ts:99 | shared:pilot-report |
| QR scans | metric label | lib/admin/pilot-report.ts:104 | shared:pilot-report |
| Customer joins | metric label | lib/admin/pilot-report.ts:106 | shared:pilot-report |
| Scan-to-join rate | metric label | lib/admin/pilot-report.ts:112 | shared:pilot-report |
| Stamps issued | metric label | lib/admin/pilot-report.ts:117 | shared:pilot-report |
| Second-stamp customers | metric label | lib/admin/pilot-report.ts:119 | shared:pilot-report |
| First-to-second stamp rate | metric label | lib/admin/pilot-report.ts:125 | shared:pilot-report |
| Rewards unlocked | metric label | lib/admin/pilot-report.ts:131 | shared:pilot-report |
| Rewards redeemed | metric label | lib/admin/pilot-report.ts:137 | shared:pilot-report |
| Trialing subscriptions | metric label | lib/admin/pilot-report.ts:143 | shared:pilot-report |
| Paid subscriptions | metric label | lib/admin/pilot-report.ts:149 | shared:pilot-report |
| Trial-to-paid rate | metric label | lib/admin/pilot-report.ts:155 | shared:pilot-report |
| Paid launch proof merchants | metric label | lib/admin/pilot-report.ts:161 | shared:pilot-report |
| Support actions | metric label | lib/admin/pilot-report.ts:166 | shared:pilot-report |
| Cancellation notes | metric label | lib/admin/pilot-report.ts:167 | shared:pilot-report |
| 1 per pilot merchant | metric target | lib/admin/pilot-report.ts:96, 101 | shared:pilot-report |
| Readback only | metric target | lib/admin/pilot-report.ts:104, 117, 133, 147 | shared:pilot-report |
| Scan-to-join 40%+ | metric target | lib/admin/pilot-report.ts:109 | shared:pilot-report |
| 40%+ | metric target | lib/admin/pilot-report.ts:115 | shared:pilot-report |
| First-to-second 25%+ | metric target | lib/admin/pilot-report.ts:122 | shared:pilot-report |
| 25%+ | metric target | lib/admin/pilot-report.ts:128 | shared:pilot-report |
| Low dispute rate | metric target | lib/admin/pilot-report.ts:140 | shared:pilot-report |
| Trial-to-paid 40-60% | metric target | lib/admin/pilot-report.ts:152 | shared:pilot-report |
| 40-60% | metric target | lib/admin/pilot-report.ts:158 | shared:pilot-report |
| At least 1 test merchant | metric target | lib/admin/pilot-report.ts:164 | shared:pilot-report |
| <2 per merchant/month | metric target | lib/admin/pilot-report.ts:166 | shared:pilot-report |
| Reasons captured | metric target | lib/admin/pilot-report.ts:170 | shared:pilot-report |
| 10-20 | metric target | lib/admin/pilot-report.ts:91 | shared:pilot-report |

## Admin — Privacy support (page) — `app/admin/privacy/page.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Admin — Privacy support | route title | app/admin/privacy/page.tsx:19 | inline |
| Internal admin | eyebrow | app/admin/privacy/page.tsx:56 | inline |
| Privacy support | heading | app/admin/privacy/page.tsx:56 | inline |
| Consent readback and audited support actions for privacy, export, deletion, and opt-out requests. | subhead | app/admin/privacy/page.tsx:59 | inline |

## Admin — Privacy: Data request workflow panel — `app/admin/privacy/data-request-workflow-panel.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Data request workflow | section heading | app/admin/privacy/data-request-workflow-panel.tsx:48 | inline |
| Verify the requester outside this console, find the relevant customer and merchant row by venue or contact fragment, log the request, then handle export, deletion, or consent follow-up manually until self-service exists. | section subhead | app/admin/privacy/data-request-workflow-panel.tsx:49 | inline |
| Source: service-role admin readback | source label | app/admin/privacy/data-request-workflow-panel.tsx:50 | inline |
| Data request subject lookup | lookup form label/aria | app/admin/privacy/data-request-workflow-panel.tsx:54 | inline |
| No matching memberships | empty-state title | app/admin/privacy/data-request-workflow-panel.tsx:75 | inline |
| Adjust the venue or contact search, or clear it to see the newest memberships. | empty-state body | app/admin/privacy/data-request-workflow-panel.tsx:76 | inline |
| No privacy support rows yet | empty-state title | app/admin/privacy/data-request-workflow-panel.tsx:82 | inline |
| No customer memberships are available for privacy support yet. | empty-state body | app/admin/privacy/data-request-workflow-panel.tsx:83 | inline |
| Privacy lookup unavailable | error-state title | app/admin/privacy/data-request-workflow-panel.tsx:88 | inline |
| Merchant | card label | app/admin/privacy/data-request-workflow-panel.tsx:107 | inline |
| References | card label | app/admin/privacy/data-request-workflow-panel.tsx:111 | inline |
| Channel | form field label | app/admin/privacy/data-request-workflow-panel.tsx:142, 172 | inline |
| Email | select option | app/admin/privacy/data-request-workflow-panel.tsx:144, 174 | inline |
| SMS | select option | app/admin/privacy/data-request-workflow-panel.tsx:145 | inline |
| WhatsApp | select option | app/admin/privacy/data-request-workflow-panel.tsx:146 | inline |
| Reason | form field label | app/admin/privacy/data-request-workflow-panel.tsx:149 | inline |
| Recording… | submit pending label | app/admin/privacy/data-request-workflow-panel.tsx:152 | inline |
| Record opt-out | submit button | app/admin/privacy/data-request-workflow-panel.tsx:152 | inline |
| Request type | form field label | app/admin/privacy/data-request-workflow-panel.tsx:163 | inline |
| Access | select option | app/admin/privacy/data-request-workflow-panel.tsx:165 | inline |
| Export | select option | app/admin/privacy/data-request-workflow-panel.tsx:166 | inline |
| Deletion | select option | app/admin/privacy/data-request-workflow-panel.tsx:167 | inline |
| Rectification | select option | app/admin/privacy/data-request-workflow-panel.tsx:168 | inline |
| Consent | select option | app/admin/privacy/data-request-workflow-panel.tsx:169 | inline |
| Phone | select option | app/admin/privacy/data-request-workflow-panel.tsx:175 | inline |
| In person | select option | app/admin/privacy/data-request-workflow-panel.tsx:176 | inline |
| Other | select option | app/admin/privacy/data-request-workflow-panel.tsx:177 | inline |
| Notes | form field label | app/admin/privacy/data-request-workflow-panel.tsx:181 | inline |
| Logging… | submit pending label | app/admin/privacy/data-request-workflow-panel.tsx:184 | inline |
| Log request | submit button | app/admin/privacy/data-request-workflow-panel.tsx:185 | inline |

## Admin — Privacy: Logged requests panel — `app/admin/privacy/logged-requests-panel.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Logged data requests | section heading | app/admin/privacy/logged-requests-panel.tsx:35 | inline |
| Recent requests from the audit trail with their age against the {30}-day response window. Exports and erasures complete at the moment they are logged. | section subhead | app/admin/privacy/logged-requests-panel.tsx:37 | inline (interpolates DATA_REQUEST_WINDOW_DAYS) |
| Source: audit_logs | source label | app/admin/privacy/logged-requests-panel.tsx:38 | inline |
| Logged data requests | aria-label | app/admin/privacy/logged-requests-panel.tsx:42 | inline |
| No data requests logged yet | empty-state title | app/admin/privacy/logged-requests-panel.tsx:47 | inline |
| Requests logged through the workflow above will appear here with their response deadline. | empty-state body | app/admin/privacy/logged-requests-panel.tsx:48 | inline |
| Data request readback unavailable | error-state title | app/admin/privacy/logged-requests-panel.tsx:54 | inline |
| overdue | status pill | app/admin/privacy/logged-requests-panel.tsx:72 | inline |
| open | status pill | app/admin/privacy/logged-requests-panel.tsx:72 | inline |
| completed | status pill | app/admin/privacy/logged-requests-panel.tsx:75 | inline |
| · via {channel} | inline metadata | app/admin/privacy/logged-requests-panel.tsx:80 | inline |
| Export completed | feed item title | app/admin/privacy/logged-requests-panel.tsx:94 | inline |
| Erasure completed | feed item title | app/admin/privacy/logged-requests-panel.tsx:95 | inline |
| {Type} request | feed item title | app/admin/privacy/logged-requests-panel.tsx:98 | inline |
| Data request | feed item title (fallback) | app/admin/privacy/logged-requests-panel.tsx:99 | inline |
| Logged today | age line | lib/admin/data-request-status.ts:38 | shared:data-request-status |
| Logged 1 day ago | age line | lib/admin/data-request-status.ts:40 | shared:data-request-status |
| Logged {n} days ago | age line | lib/admin/data-request-status.ts:41 | shared:data-request-status |
| {logged} · {n} day(s) over the 30-day window | age line (overdue) | lib/admin/data-request-status.ts:44 | shared:data-request-status |
| {logged} · {n} day(s) left of the 30-day window | age line | lib/admin/data-request-status.ts:47-49 | shared:data-request-status |

## Admin — Privacy: Consent log panel — `app/admin/privacy/consent-log-panel.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Consent log | section heading | app/admin/privacy/consent-log-panel.tsx:33 | inline |
| Historical opt-in and opt-out records are retained as evidence. | section subhead | app/admin/privacy/consent-log-panel.tsx:34 | inline |
| Source: consent_records | source label | app/admin/privacy/consent-log-panel.tsx:35 | inline |
| Admin consent support readback | table caption | app/admin/privacy/consent-log-panel.tsx:41 | inline |
| No consent records yet | empty-state title | app/admin/privacy/consent-log-panel.tsx:51 | inline |
| Merchant | card label / table header / fallback | app/admin/privacy/consent-log-panel.tsx:67, 99, 103 | inline |
| Channel | card label / table header | app/admin/privacy/consent-log-panel.tsx:70, 117 | inline |
| Policy | card label / table header | app/admin/privacy/consent-log-panel.tsx:71, 128 | inline |
| When | card label / table header | app/admin/privacy/consent-log-panel.tsx:73, 133 | inline |
| Source | card label / table header | app/admin/privacy/consent-log-panel.tsx:82, 121 | inline |
| Source: {source} | source label (row) | app/admin/privacy/consent-log-panel.tsx:83, 124 | inline |
| Customer | table header | app/admin/privacy/consent-log-panel.tsx:92 | inline |
| Status | table header | app/admin/privacy/consent-log-panel.tsx:107 | inline |
| Consent record pages | pagination nav label | app/admin/privacy/consent-log-panel.tsx:150 | inline |
| consent records | pagination unit | app/admin/privacy/consent-log-panel.tsx:151 | inline |
| Consent readback unavailable | error-state title | app/admin/privacy/consent-log-panel.tsx:159 | inline |

## Admin — Merchants — `app/admin/merchants/page.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Admin — Merchants | route title | app/admin/merchants/page.tsx:31 | inline |
| Internal admin | eyebrow | app/admin/merchants/page.tsx:66 | inline |
| Merchants | heading | app/admin/merchants/page.tsx:66 | inline |
| Merchant account, plan status, and QR support controls. | subhead | app/admin/merchants/page.tsx:67 | inline |
| Members | cross-link | app/admin/merchants/page.tsx:97 | inline |
| Billing | cross-link | app/admin/merchants/page.tsx:100 | inline |
| Privacy | cross-link | app/admin/merchants/page.tsx:106 | inline |
| QR records | cross-link | app/admin/merchants/page.tsx:111 | inline |
| Merchant accounts | section heading | app/admin/merchants/page.tsx:126 | inline |
| Service-role admin readback of account status and billing joins. | section subhead | app/admin/merchants/page.tsx:127 | inline |
| Source: service-role admin readback | source label | app/admin/merchants/page.tsx:129 | inline |
| Admin merchant account readback | table caption | app/admin/merchants/page.tsx:134 | inline |
| No merchants yet | empty-state title | app/admin/merchants/page.tsx:143 | inline |
| Merchant accounts will appear once onboarding creates records. | empty-state body | app/admin/merchants/page.tsx:144 | inline |
| Merchant | table header | app/admin/merchants/page.tsx:151 | inline |
| Email | table header / card label | app/admin/merchants/page.tsx:163, 218 | inline |
| Account | table header | app/admin/merchants/page.tsx:171 | inline |
| Billing | table header | app/admin/merchants/page.tsx:179 | inline |
| Created | table header / card label | app/admin/merchants/page.tsx:189, 223 | inline |
| Links | card label | app/admin/merchants/page.tsx:220 | inline |
| QR records | section heading | app/admin/merchants/page.tsx:244 | inline |
| Audited QR activation and regeneration controls. Reasons are required before mutation. | section subhead | app/admin/merchants/page.tsx:245 | inline |
| Source: service-role admin readback | source label | app/admin/merchants/page.tsx:246 | inline |
| No QR records yet | empty-state title | app/admin/merchants/page.tsx:256 | inline |
| active | status pill | app/admin/merchants/page.tsx:273 | inline |
| inactive | status pill | app/admin/merchants/page.tsx:273 | inline |
| Merchant | card label / fallback value | app/admin/merchants/page.tsx:278, 279 | inline |
| Created | card label | app/admin/merchants/page.tsx:281 | inline |
| Reason | form field label | app/admin/merchants/page.tsx:311, 336 | inline |
| Disabling stops scans immediately; the QR can be re-enabled later. | field helper | app/admin/merchants/page.tsx:316 | inline |
| Enabling… | submit pending label | app/admin/merchants/page.tsx:322 | inline |
| Disabling… | submit pending label | app/admin/merchants/page.tsx:322 | inline |
| Enable QR | submit button | app/admin/merchants/page.tsx:326 | inline |
| Disable QR | submit button | app/admin/merchants/page.tsx:326 | inline |
| Regenerating invalidates the QR on the current printed poster; the venue must reprint before customers can scan again. The action is written to the audit log. | field helper | app/admin/merchants/page.tsx:338 | inline |
| I understand the current printed poster QR will stop working. | confirm-check label | app/admin/merchants/page.tsx:342 | inline |
| Regenerating… | submit pending label | app/admin/merchants/page.tsx:343 | inline |
| Regenerate QR | submit button | app/admin/merchants/page.tsx:345 | inline |

## Admin components — `components/admin/action-form.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| {state.message} (renders action success text) | success banner | components/admin/action-form.tsx:53 | inline (message from actions.ts) |
| {state.message} (renders action error text) | error alert | components/admin/action-form.tsx:60 | inline (message from actions.ts) |

## Admin components — `components/admin/id-chip.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| copied | inline confirmation | components/admin/id-chip.tsx:59 | inline |
| Identifier copied to clipboard | sr-only live region | components/admin/id-chip.tsx:61 | inline |

## Admin components — `components/admin/lookup-controls.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Member lookup | form aria-label (default) | components/admin/lookup-controls.tsx:24 | inline |
| Venue | field label | components/admin/lookup-controls.tsx:39 | inline |
| Business name | input placeholder | components/admin/lookup-controls.tsx:44 | inline |
| Member contact | field label | components/admin/lookup-controls.tsx:48 | inline |
| Email or phone fragment | input placeholder | components/admin/lookup-controls.tsx:53 | inline |
| Search | submit button | components/admin/lookup-controls.tsx:59 | inline |
| Clear | link button | components/admin/lookup-controls.tsx:64 | inline |
| {n} {unit} | pagination summary | components/admin/lookup-controls.tsx:95-99 | inline |
| {n} {unit} · page {n} of {n} | pagination summary | components/admin/lookup-controls.tsx:108-119 | inline |
| Previous | pagination button | components/admin/lookup-controls.tsx:126, 130 | inline |
| Next | pagination button | components/admin/lookup-controls.tsx:136, 140 | inline |
| The lookup could not be loaded safely. Adjust the search or retry; other console panels stay available. | error-state default body | components/admin/lookup-controls.tsx:163-164 | inline |

## Admin components — `components/admin/record-card.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| _(no hardcoded user-facing copy; all labels/values passed in as props)_ | — | components/admin/record-card.tsx | — |

## Admin components — `components/admin/support.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| - | empty-value fallback (dates) | components/admin/support.tsx:161, 166 | inline |
| Customer | masked-contact fallback | components/admin/support.tsx:176 | inline |

## Public merchant storefront — Terms — `app/merchant/[merchantSlug]/terms/page.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Venue loyalty terms \| Nabaperks | route title | app/merchant/[merchantSlug]/terms/page.tsx:12 | inline |
| Venue-specific loyalty terms for Nabaperks rewards — earning rules, redemption, exclusions, and venue contact details. | route description (meta) | app/merchant/[merchantSlug]/terms/page.tsx:13-14 | inline |
| Reward terms | eyebrow | app/merchant/[merchantSlug]/terms/page.tsx:47 | inline |
| {business_name} loyalty terms | heading | app/merchant/[merchantSlug]/terms/page.tsx:49 | inline |
| These loyalty terms are shown before you join and stay available any time from your loyalty card. | subhead | app/merchant/[merchantSlug]/terms/page.tsx:52-54 | inline |
| Reward | term label | app/merchant/[merchantSlug]/terms/page.tsx:59 | inline |
| A mystery reward is assigned from the venue reward pool when the customer earns the final visit stamp. | term value | app/merchant/[merchantSlug]/terms/page.tsx:60 | inline |
| Earning rule | term label | app/merchant/[merchantSlug]/terms/page.tsx:63 | inline |
| Collect {n} visit stamps from the venue QR. One stamp may be issued per UK date. | term value | app/merchant/[merchantSlug]/terms/page.tsx:64 | inline |
| Stamps needed | term label | app/merchant/[merchantSlug]/terms/page.tsx:67 | inline |
| {n} stamps | term value | app/merchant/[merchantSlug]/terms/page.tsx:68 | inline |
| Redemption | term label | app/merchant/[merchantSlug]/terms/page.tsx:71 | inline |
| The assigned reward can be collected from the next UK business day after it is revealed. Show your reward QR at the counter and the venue team scans it to collect. | term value | app/merchant/[merchantSlug]/terms/page.tsx:72 | inline |
| Exclusions | term label | app/merchant/[merchantSlug]/terms/page.tsx:75 | inline |
| No additional exclusions configured. | term value (fallback) | app/merchant/[merchantSlug]/terms/page.tsx:77 | inline |
| Fraud and abuse | term label | app/merchant/[merchantSlug]/terms/page.tsx:81 | inline |
| The merchant may refuse, cancel, or adjust stamps and rewards where abuse, duplicate claims, QR misuse, or location anomalies are suspected. | term value | app/merchant/[merchantSlug]/terms/page.tsx:82 | inline |
| Merchant contact | term label | app/merchant/[merchantSlug]/terms/page.tsx:85 | inline |
| Ask the venue team | term value (fallback) | app/merchant/[merchantSlug]/terms/page.tsx:86 | inline |
| Close | button/link | app/merchant/[merchantSlug]/terms/page.tsx:92 | inline |
| Privacy notice | button/link | app/merchant/[merchantSlug]/terms/page.tsx:95 | inline |
| Terms unavailable | status-banner title | app/merchant/[merchantSlug]/terms/page.tsx:107 | inline |
| Ask the venue team for the current loyalty QR before joining. | status-banner body | app/merchant/[merchantSlug]/terms/page.tsx:108 | inline |

## Public merchant storefront — Terms loading — `app/merchant/[merchantSlug]/terms/loading.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Loading venue terms | loading aria-label | app/merchant/[merchantSlug]/terms/loading.tsx:16 | inline |

## Micro-labels (generic, recurring)
| Label | ~count |
|---|---|
| Reason (form field label) | 6 (customers, rewards, privacy opt-out, merchants x2) |
| Notes | 2 (pilot, privacy) |
| Channel | 2 select field labels (privacy) |
| Email | 3 (billing card label + 2 privacy select options) |
| Merchant (table header / card label / fallback) | ~10 across audit, billing, customers, fraud, privacy, pilot |
| Customer (table header / fallback) | ~4 |
| Created | 3 (customers, merchants, rewards) |
| When | ~6 (audit, fraud, consent, redemption) |
| Status | 3 (billing, fraud, consent) |
| Source / Source: {x} | ~15 SourceLabel usages across all admin pages |
| Saving… (submit pending) | 3 (fraud, pilot, + fraud dismiss) |
| Previous / Next | 2 each (lookup pagination) |
| Search / Clear | 1 each (lookup controls) |
| Audited action | 2 (customers memberships + rewards table headers) |
| Internal admin (eyebrow) | 7 (every admin page + layout) |
| Close | 1 (merchant terms) |

## Scope notes / surprises
- **Storefront ↔ customer overlap (flagged per instructions):** `app/merchant/[merchantSlug]/terms/` is a public, customer-VISIBLE storefront page (rendered inside `CustomerShell`, not the merchant admin shell). Its "Terms unavailable" / "Ask the venue team for the current loyalty QR before joining." fallback reuses `StatusBanner` and the shared `UnavailableRecoveryActions` component, and it pulls merchant/card data via `getMerchantJoinContext` — the same join-flow module the customer `/m/[slug]` join page uses. The "Close" button links back to `/m/{slug}` (customer join). The terms body copy (earning rule, "A mystery reward is assigned…", redemption, fraud & abuse) is very likely duplicated/paraphrased on the customer join flow — worth cross-checking against Agent B's customer-app inventory. `reward_terms` and stamp counts here are merchant-configured DB values (not static copy).
- **`shared:` sources feeding admin pages:** admin nav labels (Overview/Pilot/Merchants/Customers/Billing/Privacy/Fraud/Audit) come from `components/layout/console-nav.ts`; the AdminShell chrome (logo "Nabaperks Admin", footer tags "Service-role readbacks"/"Audited support actions"/"MFA-aware access"/"Admin verified"/"AAL2 verified", "Operator: {email}", and the "MFA enforcement is enabled for this admin session." banner) come from `components/layout/admin-shell.tsx`. Access-denied reasons ("Internal admin access is required." / "Admin MFA verification is required.") resolve from `lib/admin/auth.ts`. Pilot checklist/metric labels+targets+values ("10-20 merchants", "30 days free, then GBP 29/mo", "Configured", "Tracked", etc.) resolve from `lib/admin/pilot-report.ts`. Billing status pill labels ("Active"/"Trial"/"Trialing"/"Past due"/"Incomplete"/"Cancelled"/"Suspended"/"No billing record") from `lib/admin/billing-redaction.ts`; "No plan" plan fallback from `lib/admin/billing-data.ts`. Logged-request age lines ("Logged today", "Logged {n} days ago", "{logged} · {n} days left of the 30-day window", overdue variant) from `lib/admin/data-request-status.ts`.
- **Within-slice duplication:** the empty-state pair "No matching memberships" + "Adjust the venue or contact search, or clear it to see the newest memberships." appears verbatim in BOTH the customers memberships panel and the privacy data-request-workflow panel. "Source: service-role admin readback" repeats across ~6 panels. Every audited-action success string shares the tail "Logged to the audit trail." and every RPC-failure string shares the tail "Try again or review audit logs." "Operator reason is required." repeats for 6 different actions. The `first()` / `maskAdminContact()` "Merchant" and "Customer" fallbacks repeat across almost every table.
- **Internal / operator-facing terminology (not customer copy):** the entire admin console is internal-only ("Internal admin", "Restricted support views and audited manual actions.", raw source-table names surfaced as visible `SourceLabel` chips like "Source: product_events", "Source: audit_logs", "Source: billing_customers", "Source: consent_records"). These are deliberately internal but ARE rendered on screen, so captured as copy.
- **No placeholder / TODO / lorem copy** found anywhere in this slice. No `app/dev/**` harness within these paths (nearest dev harness for admin lives elsewhere — none present under app/admin, app/merchant). Two input placeholders exist and are real UX copy, not lorem: "1-3" (setup minutes) and "What happened, source, and next action" (pilot notes textarea); plus lookup placeholders "Business name" and "Email or phone fragment".
- **Interpolated numerics recorded with braces** ({n}, {date}, {ref}, {email}, {source}, {channel}) where a data value is spliced into a sentence; the surrounding static words are the copy under audit.
- `components/admin/record-card.tsx` contains NO hardcoded copy — it is a pure presentational shell; all labels/titles/values arrive as props from the calling pages (already inventoried at their call sites).
