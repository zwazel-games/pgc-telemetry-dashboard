# HogQL: filter events whose array property contains a specific value

When a PostHog event has an array-of-objects property (e.g.
`properties.offered = [{id, rarity}, ...]`) and you want to filter to
events where some target ID appears in that array, use:

```sql
WHERE has(
    arrayMap(o -> JSONExtractString(o, 'id'), JSONExtractArrayRaw(ifNull(toString(properties.offered), '[]'))),
    {target_id}
)
```

Three things to know:

1. **`properties.offered` is Nullable.** `JSONExtractArrayRaw` errors with
   `Nested type Array(String) cannot be inside Nullable type` if you
   pass it the property directly. The standard workaround in this repo
   is `ifNull(toString(properties.offered), '[]')` — same pattern as the
   `/powerup-pickrate` endpoint.

2. **`JSONExtractArrayRaw` returns `Array(String)`** (each element is a
   raw JSON string of the object). To get to the actual `id` field you
   need a second `JSONExtractString(elem, 'id')`. `arrayMap` lifts that
   over the array.

3. **`has()` is the membership check.** Faster and clearer than
   `arrayExists` for a simple equality test against a placeholder value.

Used in `proxy/src/endpoints/powerup.ts` (CO_OFFERS_SQL and PLAYERS_SQL)
to find events where the offered set contained the target powerup. The
same shape works for any "array-of-tagged-objects" property.

**Related query pattern**: when you also want to *unnest* the array
(one row per element) instead of just filtering, use `arrayJoin` on
the same array expression and then `JSONExtractString(arrayJoin(...),
'id')` per row. The `/powerup-pickrate` STATS_SQL combines both
techniques.
