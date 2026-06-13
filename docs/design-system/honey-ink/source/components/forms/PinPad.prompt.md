Staff session PIN pad for the paired-station counter moment — stamping and redemption approvals happen on the counter station, usually inside a `Sheet`.

```jsx
<Sheet open={open} onClose={close}>
  <PinPad label="Staff: start session"
          sublabel="Use the paired counter station"
          onDone={(pin) => startStaffSession(pin)} />
</Sheet>
```

Auto-submits on the 4th digit. Keys are 60px (one-handed behind a counter). Use `note` for prototype caveats or rate-limit hints.
