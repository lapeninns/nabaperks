import "server-only"

// The phone PII codec is pure and unit-tested in phone-pii-core.ts; this module
// re-exports it behind the server-only guard so app code keeps the same imports.
export {
  customerPhonePii,
  customerPhoneHmac,
  encryptCustomerPhone,
  maskedPhoneFromLast4,
} from "@/lib/customer/phone-pii-core"
export type { PhonePii } from "@/lib/customer/phone-pii-core"
