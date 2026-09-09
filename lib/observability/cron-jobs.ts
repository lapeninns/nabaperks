export const OPERATIONAL_CRON_JOBS = [
  "notifications",
  "privacy-retention",
  "merchant-digest",
  "birthday-rewards",
  "referral-bonus-drain",
  "loyalty-invite-drain",
  "billing-trial-sync",
  "qr-status-email-drain",
] as const

export type OperationalCronJob = (typeof OPERATIONAL_CRON_JOBS)[number]
