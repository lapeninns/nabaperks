export type LaunchReadinessTab = "card" | "rewards" | "venue" | "qr"
export type LaunchReadinessStepId = "card" | "rewards" | "venue" | "qr"

export const LAUNCH_SETUP_STEP_LABELS: Record<LaunchReadinessStepId, string> = {
  card: "Your card",
  rewards: "Your rewards",
  venue: "Your venue",
  qr: "Print your QR",
}
