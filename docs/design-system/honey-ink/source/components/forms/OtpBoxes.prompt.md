One-time-code entry for the deferred "Keep your card" step (identity comes AFTER the first stamp).

```jsx
const [code, setCode] = useState("");
<OtpBoxes value={code} onChange={setCode} />
```

Controlled. The hidden input supports paste and iOS code autofill. The active box carries the hard shadow as a cursor.
