The primary Wet Ink surface — every card (stamp card, merchant panels, forms) is a receipt with a perforated bottom edge.

```jsx
<ReceiptCard shaking={justStamped}>
  <MonoLine>The Old Crown · Bristol</MonoLine>
  <h2>Free hot drink after 3 visits</h2>
  <ReceiptRule />
  <StampRow current={2} total={3} />
</ReceiptCard>
```

Use `ReceiptRule` (dashed) to divide sections — never solid hairlines. `shaking` plays the 300ms paper-shake when a stamp lands. Don't nest receipt cards.
