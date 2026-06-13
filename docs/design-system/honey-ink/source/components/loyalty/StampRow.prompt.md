The stamp card row — the product's hero element. Lives inside a `ReceiptCard`.

```jsx
<StampRow current={2} total={3} dates={["3 JUN", "9 JUN"]} />
// the moment a stamp lands:
<StampRow current={2} total={3} slamIndex={1} celebration="Slam" />
```

Filled discs are accent ink rotated -6° with a ✱ and the visit date; empty slots are dashed circles numbered. Set `slamIndex` to the just-landed slot for the slam animation + particles (clear it after ~1.4s). `StampDisc` is exported for single-stamp uses (logos, empty states).
