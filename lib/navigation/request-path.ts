import {
  safeMerchantNextPath,
  safeNextPath,
} from "@/lib/navigation/safe-next-path"

export const REQUEST_PATH_HEADER = "x-nabaperks-path"

type HeaderSource = Pick<Headers, "get">

export function readRequestPath(headers: HeaderSource): string {
  return safeNextPath(headers.get(REQUEST_PATH_HEADER) ?? "/home")
}

export function readMerchantRequestPath(headers: HeaderSource): string {
  return safeMerchantNextPath(headers.get(REQUEST_PATH_HEADER) ?? "/app")
}
