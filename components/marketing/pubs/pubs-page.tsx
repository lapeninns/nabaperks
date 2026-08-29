import type { ReactNode } from "react"

import { MarketingLayout, Section } from "@/components/layout"
import { type QrMatrix } from "@/components/marketing/landing"
import { JsonLd } from "@/components/seo/json-ld"
import {
  PUB_GUIDE_HERO,
  PUB_GUIDE_SECTIONS,
  ROUTES,
  type MarketingPersona,
  type PubGuideSectionId,
} from "@/lib/marketing/facts"
import {
  articleSchema,
  breadcrumbSchema,
  webPageSchema,
} from "@/lib/seo/structured-data"

import { FailureModes } from "./failure-modes"
import { GuideSection } from "./guide-section"
import { GuideSpine } from "./guide-spine"
import { HubHandoff } from "./hub-handoff"
import { OptionsMatrix } from "./options-matrix"
import { PubFitTest } from "./pub-fit-test"
import { PubGuideHero } from "./pub-guide-hero"
import { StaffTime } from "./staff-time"
import { TillMoment } from "./till-moment"
import { VendorQuestions } from "./vendor-questions"

/** Each spine entry's structured payload; `decide` is lead prose only. */
function sectionPayload(
  id: PubGuideSectionId,
  persona: MarketingPersona
): ReactNode {
  switch (id) {
    case "options":
      return <OptionsMatrix />
    case "staff-time":
      return <StaffTime />
    case "at-the-till":
      return <TillMoment />
    case "failures":
      return <FailureModes />
    case "questions":
      return <VendorQuestions />
    case "fit":
      return <PubFitTest persona={persona} />
    case "guides":
      return <HubHandoff />
    default:
      return null
  }
}

/**
 * `/loyalty-for-pubs` — the pub cluster's hub and buyer's guide.
 *
 * One page, one job: this route answers "should I run a loyalty scheme, and
 * which kind?" and routes onward. It deliberately renders NO band owned by
 * another route — `/` sells, `/how-it-works` explains the launch, `/pricing`
 * states the commercials, and the three `/guides/*` pages go deep. Before this
 * rebuild the page re-rendered eight of those bands and shared `/`'s exact H1;
 * `tests/contracts/marketing-offer-source.test.mjs` now holds that line.
 *
 * The spine is the only client component on the page — everything else renders
 * on the server so the whole guide is in the initial HTML for a crawler.
 */
export function PubsPage({
  persona,
  demoQr,
  title,
  description,
}: {
  persona: MarketingPersona
  demoQr: QrMatrix
  title: string
  description: string
}) {
  return (
    <MarketingLayout>
      <PubGuideHero
        persona={persona}
        demoQr={demoQr}
        updatedOn={PUB_GUIDE_HERO.updatedLabel}
      />
      {/* `entrance={false}`: a lingering transform on this grid would become
          the spine's containing block and break its sticky positioning. */}
      <Section
        as="div"
        size="dense"
        entrance={false}
        className="lg:grid lg:grid-cols-[minmax(0,12rem)_minmax(0,1fr)] lg:items-start lg:gap-12 xl:gap-16"
      >
        <GuideSpine />
        {/* 48px/64px between sections was the largest gap token on the
            marketing surface, applied to the tallest page in the product. The
            Nº markers plus GuideSection's own dashed top rule separate the
            bands for 2px instead. */}
        <div className="grid gap-8 pt-6 sm:gap-10 lg:gap-12 lg:pt-0">
          {PUB_GUIDE_SECTIONS.map((section, index) => (
            <GuideSection key={section.id} section={section} index={index}>
              {sectionPayload(section.id, persona)}
            </GuideSection>
          ))}
        </div>
      </Section>
      <JsonLd
        id={`ld-${persona.slug}`}
        data={{
          "@context": "https://schema.org",
          "@graph": [
            webPageSchema({ path: persona.path, title, description }),
            articleSchema({
              path: persona.path,
              headline: PUB_GUIDE_HERO.headline,
              description,
              datePublished: PUB_GUIDE_HERO.publishedOn,
              dateModified: PUB_GUIDE_HERO.updatedOn,
            }),
            breadcrumbSchema([
              { name: "Home", path: ROUTES.home },
              { name: persona.title, path: persona.path },
            ]),
          ],
        }}
      />
    </MarketingLayout>
  )
}
