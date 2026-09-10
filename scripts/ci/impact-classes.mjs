// Only reviewed cosmetic utilities may disappear from the syntax comparison.
// Arbitrary values/selectors, custom classes and interaction/layout controls
// stay in the shape, so changing one requires the complete suite.
const COLOURS =
  "(?:black|white|transparent|current|inherit|(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|[1-9]00|950)|background|foreground|primary|secondary|muted|muted-foreground|accent|destructive|border|paper|ink|leaf)"
const COLOUR_CLASS = new RegExp(
  `^(?:text|bg|border|decoration)-${COLOURS}(?:/(?:0|[1-9]0|100))?$`
)
const COSMETIC = [
  /^(?:p[trblxy]?|m[trblxy]?|gap(?:-[xy])?|space-[xy])-(?:0|px|0\.5|1\.5|2\.5|3\.5|[1-9]|1[0-2]|14|16|20|24)$/,
  /^text-(?:xs|sm|base|lg|xl|[2-6]xl|left|center|right|justify|start|end|balance|pretty)$/,
  /^font-(?:sans|serif|mono|thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/,
  /^(?:italic|not-italic|uppercase|lowercase|capitalize|normal-case|underline|overline|line-through|no-underline)$/,
  /^leading-(?:none|tight|snug|normal|relaxed|loose|[3-9]|10)$/,
  /^tracking-(?:tighter|tight|normal|wide|wider|widest)$/,
  /^rounded(?:-(?:none|xs|sm|md|lg|xl|[2-4]xl|full))?$/,
  /^border(?:-(?:0|2|4|8|solid|dashed|dotted|double|hidden|none))?$/,
  /^shadow(?:-(?:none|sm|md|lg|xl|2xl|inner))?$/,
  /^underline-offset-(?:0|1|2|4|8)$/,
  COLOUR_CLASS,
]
export function isCosmeticClass(token) {
  // The selected checks do not exercise every interaction state, breakpoint
  // or colour scheme. Keep all variants until those states have explicit proof.
  return COSMETIC.some((pattern) => pattern.test(token))
}

export function presentationClassShape(value) {
  return JSON.stringify(
    value
      .split(/\s+/)
      .filter((token) => token && !isCosmeticClass(token))
      .join(" ")
  )
}
