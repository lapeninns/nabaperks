Bottom sheet for in-context moments — above all, the staff PIN pad sliding over the customer's card.

```jsx
<Sheet open={pinOpen} onClose={() => setPinOpen(false)}>
  <PinPad label="Staff: stamp this card" onDone={doStamp} />
</Sheet>
```

Paper panel, ink border, 320ms slide-up. Tap the scrim to dismiss. Keep content to one task — never a scrolling form.
