// design-sync shim: next/link → plain <a>.
// next/link drags Next's client runtime (process.env.__NEXT_* refs) into the
// IIFE, which throws "process is not defined" at eval time and aborts the whole
// window.WetInk assignment. The DS bundle is framework-agnostic, so an anchor is
// the honest standalone equivalent. Mapped in .design-sync/tsconfig.ds.json.
import * as React from "react"

type NextHref = string | { pathname?: string; href?: string }

type LinkProps = Omit<React.ComponentPropsWithoutRef<"a">, "href"> & {
  href?: NextHref
  prefetch?: boolean
  replace?: boolean
  scroll?: boolean
  shallow?: boolean
  passHref?: boolean
  locale?: string | false
}

const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { href, prefetch, replace, scroll, shallow, passHref, locale, children, ...rest },
  ref,
) {
  const resolved =
    typeof href === "object" && href ? (href.pathname ?? href.href ?? "#") : (href ?? "#")
  return (
    <a ref={ref} href={typeof resolved === "string" ? resolved : "#"} {...rest}>
      {children}
    </a>
  )
})

export default Link
