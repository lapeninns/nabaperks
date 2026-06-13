One-shot particle layer for celebration moments (a stamp landing, a reward unsealing).

```jsx
<div style={{ position: "relative" }}>
  <StampDisc filled index={0} slammed />
  {justStamped && <CelebrationBits type="Slam" seed={3} />}
</div>
```

Types: `Slam` (ink splats — default), `Ripple` (calm rings), `Burst` (splats + confetti — reserve for the reward reveal). Mount it fresh (keyed) at the moment of celebration; it plays once. `mo` scales all durations.
