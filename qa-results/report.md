## QA Report

| # | Test Case | App | Persona | Result | Notes |
| --- | --- | --- | --- | --- | --- |
| 1 | Public marketing and pricing surfaces render with primary CTAs | web | guest | :white_check_mark: PASS | Home and pricing pages rendered locally with expected merchant/customer actions. |
| 2 | Customer QR join, phone OTP, and first stamp flow | web | customer | :white_check_mark: PASS | QR redirected to join, dev OTP `424242` completed, and the customer reached the stamped card surface. |
| 3 | Customer duplicate stamp boundary | web | customer | :white_check_mark: PASS | Re-opening the venue QR kept the already-stamped state and did not offer a second same-day stamp. |
| 4 | Merchant login and dashboard access | web | merchant | :white_check_mark: PASS | Seeded merchant login reached the Old Crown Girton merchant dashboard. |
| 5 | Merchant launch and billing surfaces | web | merchant | :white_check_mark: PASS | Launch showed live QR/card/reward readiness, and billing showed Growth Plan actions. |
| 6 | Merchant cannot access admin console | web | merchant | :white_check_mark: PASS | Opening `/admin` as merchant showed Access denied. |
| 7 | Admin dashboard and billing readback | web | admin | :white_check_mark: PASS | Seeded admin login reached the admin dashboard and billing readback table. |
| 8 | Local health endpoint | web | system | :white_check_mark: PASS | `/api/health` returned `200` with `status: ok`. |

Result values: :white_check_mark: PASS, :x: FAIL, :no_entry: BLOCKED, :warning: FLAKY, :grey_question: INCONCLUSIVE

<details>
<summary>Screenshots & Evidence</summary>

Text snapshots were captured under `qa-results/local-run/`:

- `01-marketing.snapshot.txt`
- `02-pricing.snapshot.txt`
- `03-customer-qr-full.snapshot.txt`
- `04-customer-phone-form.snapshot.txt`
- `05-customer-validation.snapshot.txt`
- `06-customer-otp.snapshot.txt`
- `07-customer-after-otp.snapshot.txt`
- `08-duplicate-stamp-guard.snapshot.txt`
- `09-merchant-login.snapshot.txt`
- `11-merchant-login-attempt.snapshot.txt`
- `12-merchant-launch.snapshot.txt`
- `13-merchant-billing.snapshot.txt`
- `14-merchant-admin-denied.snapshot.txt`
- `15-admin-login.snapshot.txt`
- `16-admin-dashboard.snapshot.txt`
- `17-admin-billing.snapshot.txt`

</details>
