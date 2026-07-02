import type { ReactNode } from "react"
import Link from "next/link"

import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons"

import { Eyebrow, Icon, MonoTag } from "@/components/brand"
import { MarketingLayout, Section } from "@/components/layout"
import { FinalCta } from "@/components/marketing/landing"
import { JsonLd } from "@/components/seo/json-ld"
import { Button } from "@/components/ui/button"
import { CTA, ROUTES } from "@/lib/marketing/facts"
import { marketingPageGraph } from "@/lib/seo/structured-data"

import { guideByHref, otherGuides } from "./guides-data"

/**
 * GuidePage — the shared shell for the pub-led guide spokes. Keeps every guide
 * consistent (hero, body, reciprocal hub link, related spokes, close) so the
 * cluster reads as one topical authority, not three one-offs. Server component.
 *
 * Reciprocal linking (PDF hub-and-spoke): the hero CTA and the closing band both
 * link back to the hub with the approved "See the pub loyalty guide" label, and
 * the related rail links the sibling spokes (spoke-to-spoke).
 */
export function GuidePage({
  href,
  eyebrow,
  title,
  intro,
  description,
  children,
}: {
  href: string
  eyebrow: string
  title: string
  intro: string
  /** Meta description — also the Article description in the page graph. */
  description: string
  children: ReactNode
}) {
  const related = otherGuides(href)
  const navLinks = [
    { href: ROUTES.pubHub, label: "Loyalty for pubs" },
    { href: ROUTES.pricing, label: "Pricing" },
  ]

  const graph = marketingPageGraph({
    page: { path: href, name: `${title} | Nabaperks`, description, isArticle: true },
    breadcrumbs: [
      { name: "Home", path: ROUTES.home },
      { name: CTA.pub, path: ROUTES.pubHub },
      { name: guideByHref(href)?.nav ?? title, path: href },
    ],
  })

  return (
    <MarketingLayout navLinks={navLinks}>
      <Section width="narrow" className="max-w-3xl">
        <nav aria-label="Breadcrumb">
          <Link
            href={ROUTES.pubHub}
            className="mono-meta inline-flex items-center gap-1 text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
          >
            <Icon icon={ArrowLeft01Icon} size={14} strokeWidth={2.5} />
            {CTA.pub}
          </Link>
        </nav>

        <header className="mt-5">
          <MonoTag tone="accent">{eyebrow}</MonoTag>
          <h1 className="mt-4 text-[clamp(2rem,5vw,3.25rem)] leading-[1.02] font-extrabold tracking-[-0.02em] text-balance">
            {title}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg">
            {intro}
          </p>
        </header>

        <div className="mt-8 flex flex-col gap-8">{children}</div>

        {/* Reciprocal hub link */}
        <div className="surface-card mt-10 flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Eyebrow>The full picture</Eyebrow>
            <p className="mt-2 max-w-[42ch] text-[0.95rem] leading-snug font-bold text-pretty">
              See how a browser-based loyalty card works across the whole pub.
            </p>
          </div>
          <Button asChild className="shrink-0">
            <Link href={ROUTES.pubHub}>{CTA.guideLink}</Link>
          </Button>
        </div>

        {/* Related spokes */}
        {related.length > 0 ? (
          <nav aria-label="Related guides" className="mt-8">
            <Eyebrow className="mb-3">More pub loyalty guides</Eyebrow>
            <ul className="grid gap-3 sm:grid-cols-2">
              {related.map((guide) => (
                <li key={guide.href}>
                  <Link
                    href={guide.href}
                    className="group surface-card flex h-full flex-col p-4 transition-shadow hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/35 focus-visible:outline-none"
                  >
                    <span className="text-[0.95rem] leading-snug font-extrabold text-balance">
                      {guide.nav}
                    </span>
                    <span className="mt-1.5 text-sm leading-snug text-muted-foreground">
                      {guide.summary}
                    </span>
                    <span className="mono-meta mt-3 inline-flex items-center gap-1 text-primary">
                      Read
                      <Icon
                        icon={ArrowRight01Icon}
                        size={13}
                        strokeWidth={2.5}
                        className="transition-transform group-hover:translate-x-0.5"
                      />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </Section>

      <FinalCta />
      <JsonLd id="ld-guide" data={graph} />
    </MarketingLayout>
  )
}

/** A titled prose block within a guide body. */
export function GuideSection({
  id,
  heading,
  children,
}: {
  id?: string
  heading: string
  children: ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-[clamp(1.4rem,3vw,1.9rem)] leading-tight font-extrabold tracking-[-0.01em] text-balance">
        {heading}
      </h2>
      <div className="mt-3 flex flex-col gap-3 text-[0.975rem] leading-relaxed text-pretty text-muted-foreground">
        {children}
      </div>
    </section>
  )
}
