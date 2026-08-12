import { type NextRequest } from "next/server.js"

import { requireAdminAction } from "@/lib/admin/auth"
import {
  createAdminPrivacyExportPost,
  type ExportRequest,
} from "@/lib/admin/data-export"
import { isSameOriginRequest } from "@/lib/http/bounded-json-request"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const post = createAdminPrivacyExportPost<NextRequest>({
  async authorise() {
    await requireAdminAction()
  },
  sameOrigin: isSameOriginRequest,
  async exportCustomer(input: ExportRequest) {
    const supabase = await createSupabaseServerClient()
    return supabase.rpc("admin_export_customer_data", {
      p_customer_id: input.customerId,
      p_merchant_id: input.merchantId,
      p_channel: input.channel,
      p_notes: input.notes,
    })
  },
})

export async function POST(request: NextRequest): Promise<Response> {
  return post(request)
}
