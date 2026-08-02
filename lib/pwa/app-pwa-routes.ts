const MERCHANT_AUTH_ROUTES = ["/login", "/signup", "/reset-password"] as const

export function isMerchantAuthRoute(pathname: string): boolean {
  return MERCHANT_AUTH_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  )
}
