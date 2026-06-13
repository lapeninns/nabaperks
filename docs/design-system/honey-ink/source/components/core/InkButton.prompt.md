Primary Wet Ink action control — use for every button; never hand-roll buttons.

```jsx
<InkButton onClick={go}>Collect my first stamp</InkButton>
<InkButton variant="dark" full>I'm at the counter — stamp it</InkButton>
<InkButton variant="outline" size="sm">Reprint poster</InkButton>
```

Variants: `primary` (accent ink — one per screen), `dark` (solid ink — secondary emphasis), `outline` (quiet). Sizes `lg`/`md`/`sm`. `full` stretches to the column. Disabled drops to 45% opacity.
