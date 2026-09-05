import {
  Alert02Icon,
  Cancel01Icon,
  CheckmarkBadge04Icon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  GiftIcon,
  InformationCircleIcon,
  QrCode01Icon,
  Settings01Icon,
  UserAdd01Icon,
} from "@hugeicons/core-free-icons"

import type { IconGlyph } from "./icon"

/**
 * Semantic icon maps for the @hugeicons set, so status pills, badges, and the
 * activity feed all reach for the same glyph per meaning rather than each call
 * site picking its own.
 */
export type StatusKind = "success" | "warning" | "error" | "pending" | "info"

export const STATUS_ICON: Record<StatusKind, IconGlyph> = {
  success: CheckmarkCircle02Icon,
  warning: Alert02Icon,
  error: Cancel01Icon,
  pending: Clock01Icon,
  info: InformationCircleIcon,
}

export type ActivityCategory =
  | "customer"
  | "stamp"
  | "reward"
  | "qr"
  | "account"

export const ACTIVITY_CATEGORY_ICON: Record<ActivityCategory, IconGlyph> = {
  customer: UserAdd01Icon,
  stamp: CheckmarkBadge04Icon,
  reward: GiftIcon,
  qr: QrCode01Icon,
  account: Settings01Icon,
}
