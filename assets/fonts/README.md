# Wet Ink local fonts

The browser uses these six static binaries. The emailed poster PDFs use the
four Regular/Bold faces only — `lib/qr/*-content-types.ts` pins those filenames
as exact string literals, so the two added weights are browser-only.

- `BricolageGrotesque-Regular.ttf` — SHA-256 `dcfe24ee4e7aa40aa13a91837acca9b170befd4dbbbcf9e084a0db1c1676e06f`
- `BricolageGrotesque-Medium.ttf` — SHA-256 `1dd2a3b41e0ce8eff2d9000ce8e79e8a5d9d2f0b22f4e27dc8c59e94894fe50a`
- `BricolageGrotesque-Bold.ttf` — SHA-256 `f83cb3f1ddb91bdb02868eeddb4f817b326aef993f96fe6f8a3b40b0f31c689b`
- `BricolageGrotesque-ExtraBold.ttf` — SHA-256 `20ca28c496aef07993031176c1a02da6959682abbc4cbf73776f83e63ef80c00`
- `SpaceMono-Regular.ttf` — SHA-256 `95837e182baeeada83368f7748db28357f0a1b75c6b84ff7065b5edf933c8e18`
- `SpaceMono-Bold.ttf` — SHA-256 `405e73d41afb7e5906efce206a326af5c956f38e255f35421c260e861e599c59`

Bricolage comes from `ateliertriay/bricolage` at commit
`84745e5b96261ae5f8c6c856e262fe78d1d6efdd`, path `fonts/ttf/`. Space Mono comes
from `google/fonts` at commit `389b770410cc0b7c21c85673bfa2077420fe7f65`.
Both families are licensed under the SIL Open Font Licence; their licence
texts are stored beside the binaries.

Medium (500) and ExtraBold (800) were added from the same pinned Bricolage
commit to satisfy the DESIGN.md typography contract — body/small are weight
500, every heading is 800. Provenance was confirmed by re-downloading
Regular and Bold from that commit and reproducing the two SHA-256 values
already recorded above before the new files were taken from the same tree.
Both new faces carry the correct `usWeightClass` (500 and 800) in their OS/2
table, so no synthesis is involved.
