# Source connectors

One module per rankings source. Each exports:

```js
export function parse(raw, { format, capturedAt }) {
  return {
    players: [{ name, team, position, rank_position, rank_overall?, bye? }],
    rejections: [{ name?, reason }],
  };
}
```

Rules every connector follows:

1. **Parse a capture, never fetch.** Fetching is the capture step's job, and
   it writes an immutable timestamped artifact first (Principle 2). A
   connector that reaches the network cannot be re-run against history.
2. **Rankings, not projections** (ADR-0002). Where the source publishes only
   projected points, sort, assign `rank_position`, and **discard the
   projected value** — it must not appear in the returned object.
3. **Format is required.** It is passed in; never infer it from the page.
4. **Rejections are returned, not thrown.** A row you cannot parse is a
   rejection with a reason (Principle 5).
