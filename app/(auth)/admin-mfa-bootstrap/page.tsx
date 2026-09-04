import type { Metadata } from "next"

import { AdminMfaBootstrap } from "@/components/admin/mfa-bootstrap"
import { PRIVATE_ROUTE_METADATA } from "@/lib/seo/metadata"

export const metadata: Metadata = PRIVATE_ROUTE_METADATA

export default function AdminMfaBootstrapPage() {
  return <AdminMfaBootstrap />
}
