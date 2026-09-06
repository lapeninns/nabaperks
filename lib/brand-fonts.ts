import type { CSSProperties } from "react"
import localFont from "next/font/local"

const bricolageLatin = localFont({
  src: [
    {
      path: "../assets/fonts/BricolageGrotesque-Regular-Latin.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../assets/fonts/BricolageGrotesque-Bold-Latin.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-bricolage-grotesque-latin",
  display: "swap",
  preload: true,
  adjustFontFallback: false,
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+20-7E, U+A0-A3, U+A5-AC, U+AE-FF, U+2000-200B, U+2013-2014, U+2016, U+2018-201A, U+201C-201E, U+2020-2022, U+2026, U+202F-2030, U+2032-2033, U+2039-203A, U+2044",
    },
  ],
})

const bricolageExtended = localFont({
  src: [
    {
      path: "../assets/fonts/BricolageGrotesque-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../assets/fonts/BricolageGrotesque-Bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-bricolage-grotesque-extended",
  display: "swap",
  preload: false,

  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+100-107, U+10A-113, U+116-11B, U+11E-123, U+126-12B, U+12E-133, U+136-137, U+139-13E, U+141-148, U+14A-14D, U+150-15B, U+15E-161, U+164-165, U+168-17E, U+1A0-1A1, U+1AF-1B0, U+1CD-1CE, U+218-21B, U+237, U+2C6-2C7, U+2D8-2DD, U+300-304, U+306-30C, U+312, U+31B, U+323, U+326-328, U+3C0, U+E3F, U+1E80-1E85, U+1E9E, U+1EA0-1EF9, U+2070, U+2074-2079, U+2080-2089, U+20A1, U+20A4, U+20A6, U+20A8-20A9, U+20AB-20AE, U+20B1-20B2, U+20B4-20B5, U+20B8-20BA, U+20BC-20BF, U+2113, U+2116, U+2122, U+2126, U+212E, U+2153-2154, U+215B-215E, U+2190-2193, U+2202, U+2205-2206, U+220F, U+2211-2212, U+221A, U+221E, U+222B, U+2248, U+2260, U+2264-2265, U+27E8-27E9",
    },
  ],
})

const spaceMonoLatin = localFont({
  src: [
    {
      path: "../assets/fonts/SpaceMono-Regular-Latin.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../assets/fonts/SpaceMono-Bold-Latin.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-space-mono-latin",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+20-7E, U+A0-AC, U+AE-FF, U+2013-2014, U+2018-201A, U+201C-201E, U+2020-2022, U+2026, U+2030, U+2032-2033, U+2039-203A, U+2044",
    },
  ],
})

const spaceMonoExtended = localFont({
  src: [
    {
      path: "../assets/fonts/SpaceMono-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../assets/fonts/SpaceMono-Bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-space-mono-extended",
  display: "swap",
  preload: false,

  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+100-13E, U+141-180, U+18F, U+192, U+1A0-1A1, U+1AF-1B0, U+1CD-1DC, U+1E6-1E7, U+1EA-1EB, U+218-21B, U+237, U+243, U+250-252, U+254, U+258-259, U+261, U+265, U+26F, U+279, U+287, U+28C-28E, U+29E, U+2C6-2C7, U+2C9, U+2D8-2DD, U+300-304, U+306-30C, U+312, U+31B, U+323, U+326-328, U+32E, U+331, U+3C0, U+1E0C-1E0F, U+1E20-1E21, U+1E24-1E25, U+1E2A-1E2B, U+1E36-1E3B, U+1E42-1E49, U+1E5A-1E63, U+1E6C-1E6F, U+1E80-1E85, U+1E8E-1E8F, U+1E92-1E93, U+1E97, U+1E9E, U+1EA0-1EF9, U+2070-2071, U+2074-2079, U+207D-2089, U+208D-208E, U+2094, U+20A1, U+20A4, U+20A6-20A7, U+20AB-20AC, U+20B1-20B2, U+20B5, U+20B9, U+2113, U+2120, U+2122, U+2126, U+212E, U+2153-2154, U+215B-215E, U+2190-2199, U+2202, U+2206, U+220F, U+2211-2212, U+2215, U+2219-221A, U+221E, U+222B, U+2248, U+2260, U+2264-2265, U+25CA, U+FB01-FB02",
    },
  ],
})

export const BRAND_FONT_CLASSES =
  bricolageLatin.variable +
  " " +
  bricolageExtended.variable +
  " " +
  spaceMonoLatin.variable +
  " " +
  spaceMonoExtended.variable
export const BRAND_FONT_VARIABLES = {
  "--font-bricolage-grotesque":
    "var(--font-bricolage-grotesque-latin), var(--font-bricolage-grotesque-extended)",
  "--font-space-mono":
    "var(--font-space-mono-latin), var(--font-space-mono-extended)",
} as CSSProperties
