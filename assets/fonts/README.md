# Wet Ink local fonts

These four source fonts are retained for emailed poster PDFs and web-font generation:

- `BricolageGrotesque-Regular.ttf` — SHA-256 `dcfe24ee4e7aa40aa13a91837acca9b170befd4dbbbcf9e084a0db1c1676e06f`
- `BricolageGrotesque-Bold.ttf` — SHA-256 `f83cb3f1ddb91bdb02868eeddb4f817b326aef993f96fe6f8a3b40b0f31c689b`
- `SpaceMono-Regular.ttf` — SHA-256 `95837e182baeeada83368f7748db28357f0a1b75c6b84ff7065b5edf933c8e18`
- `SpaceMono-Bold.ttf` — SHA-256 `405e73d41afb7e5906efce206a326af5c956f38e255f35421c260e861e599c59`

Bricolage comes from `ateliertriay/bricolage` at commit
`84745e5b96261ae5f8c6c856e262fe78d1d6efdd`. Space Mono comes from
`google/fonts` at commit `389b770410cc0b7c21c85673bfa2077420fe7f65`.
Both families are licensed under the SIL Open Font Licence; their licence
texts are stored beside the binaries.

## Browser delivery

The browser uses losslessly compressed WOFF2 versions of these sources. Each
weight also has a smaller Latin subset, covering supported characters through
U+00FF and supported General Punctuation characters U+2000–U+206F. The exact
Unicode ranges in `lib/brand-fonts.ts` route remaining supported characters to
the full WOFF2 font on demand. Only the Bricolage Latin faces are preloaded.
The existing CSS family aliases keep both families available throughout the app.

Regenerate all eight WOFF2 files with Python and FontTools 4.60.2:

```bash
python3 -m pip install 'fonttools[woff]==4.60.2'
python3 scripts/build-web-fonts.py
```

The script verifies character coverage, decomposed outlines, advance widths,
bearings and vertical metrics against the original TTF for every retained
character. Both original licence files continue to apply to the web fonts.
