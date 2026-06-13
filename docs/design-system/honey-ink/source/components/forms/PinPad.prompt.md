Staff PIN pad for the shared-phone counter moment — stamping and redemption both go through it, usually inside a `Sheet`.

```jsx
<Sheet open={open} onClose={close}>
  <PinPad label="Staff: stamp this card"
          sublabel="Customer hands the phone across the counter"
          onDone={(pin) => issueStamp(pin)} />
</Sheet>
```

Auto-submits on the 4th digit. Keys are 60px (one-handed behind a counter). Use `note` for prototype caveats or rate-limit hints.
