# The Verification + Coupon Engine

`server/lib/engine.js` is the core of Tidewater. It turns sensor readings into
coupon decisions and minted revenue. This document explains exactly what it
computes, line by line, so the numbers in a settlement are reproducible and
defensible.

## The loop in one line

```
marine reading → covenant check → if met: release outcome coupon + mint credit
                                  if missed: hold outcome coupon (rolls forward)
```

The same reading that *proves* the outcome also *generates* the credit revenue
that funds the released coupon. That coupling is the entire thesis.

## Two entry points

| Function              | Writes? | Used by                                   |
|-----------------------|---------|-------------------------------------------|
| `snapshotBond(id)`    | No      | `GET /api/bonds/:id` live verification feed |
| `evaluateBond(id, p)` | Yes     | `POST /api/verify/run` settlement          |

`snapshotBond` is a read-only preview: for each covenant it pulls the latest
reading, compares it to the threshold, and returns `met` and a `status` of
`pending` / `met` / `held`. It changes nothing.

`evaluateBond` is the real settlement. It updates covenant statuses, mints
credits, writes a `coupon_event`, and returns a structured result. Everything
below describes `evaluateBond`.

## Resolving the reading for a covenant

```sql
SELECT r.value
FROM readings r
JOIN sensors s ON s.id = r.sensor_id
JOIN bonds   b ON b.project_id = s.project_id
WHERE b.id = ? AND s.kind = ?
ORDER BY r.recorded_at DESC, r.id DESC
LIMIT 1
```

A covenant names a **sensor kind**, not a specific sensor. The engine takes the
single most recent reading of that kind on the bond's project. If two sensors
share a kind, the newest reading across both wins. If there is no reading at
all, `value` is `null` and the covenant cannot be met.

## Comparator

```js
const cmp = {
  gte: (v, t) => v >= t,   // "at least" — acreage, carbon, survival, nitrogen removed
  lte: (v, t) => v <= t,   // "at most"  — flood-days
};
const met = value !== null && cmp[m.comparator](value, m.threshold);
```

A `null` reading is never "met."

## Coupon accrual (half-year)

```js
const principal              = bond.raised || 0;
const baseCouponHalfYear     = (principal * (bond.base_coupon_bps   / 10000)) / 2;
const outcomeCouponHalfYear  = (principal * (bond.outcome_coupon_bps/ 10000)) / 2;
```

Two things to internalize:

1. **Principal is `raised`, not `target_raise`.** Coupon scales with capital
   actually committed. A bond with zero investments settles to zero coupon —
   which is why `simulate.js` injects `raised` before settling.
2. **Each settlement is a half-year accrual** (the `/ 2`). A "year" is two
   settlement periods. The portfolio endpoint, by contrast, reports an
   *annualized* projection, so the two figures intentionally differ by ~2×.

## Per-covenant decision

For each covenant `m`, the slice of outcome coupon at stake is
`share = outcomeCouponHalfYear × m.weight`. Weights across a bond's covenants
are intended to sum to 1.0, so the whole outcome coupon is allocated.

```js
if (met) {
  status = 'met';
  outcomePaid += share;
  // mint a credit if this covenant is revenue-linked
} else {
  status = 'held';
  outcomeHeld += share;     // rolls into the next remediation cycle
}
```

A **held** slice is not forfeited by the project — it is withheld from
investors this period and rolls forward. In the ledger it appears as
`outcome_held`.

## Minting credit revenue

Only covenants with a real `credit_type` and a positive `credit_rate` mint
revenue:

```js
if (m.credit_type && m.credit_type !== 'none' && m.credit_rate > 0) {
  const quantity = m.comparator === 'gte'
    ? value                                          // gte: earn on the achieved level
    : Math.max(0, m.threshold - value + m.threshold);// lte: reward staying under
  const revenue = quantity * m.credit_rate;
  // INSERT INTO credits (...); revenueIn += revenue;
}
```

- **`gte` covenants** (acreage, carbon, survival, nitrogen removed): quantity is
  the measured value itself. Restore 41 acres, earn on 41.
- **`lte` covenants** (flood-days): quantity is `2 × threshold − value`, floored
  at 0. This is a deliberate "reward staying under" shape — the further below
  the cap you are, the more you earn — but note it is an **illustrative
  scoring choice, not a market convention.** It is the kind of parameter a real
  structurer would replace with a contracted formula. It also only fires when
  the `lte` covenant is *met*, so a missed guardrail mints nothing regardless.
  In the seed data every `lte` covenant is `credit_type = 'none'`, so this
  branch never actually mints in the demo — it exists for completeness.

`revenue` flows to the SPV (recorded in the `credits` table; summed into
`revenueIn`).

## The coupon event

After looping all covenants, one ledger row is written:

```js
INSERT INTO coupon_events
  (bond_id, period, base_paid, outcome_paid, outcome_held, revenue_in, note)
```

`note` is "All covenants met: full outcome coupon released" when nothing is
held, otherwise "Partial hold: held tranche rolls to remediation cycle." The
whole loop runs inside a `db.transaction`, so a settlement is atomic: either
all status updates, credits, and the event commit together, or none do.

## Self-funding coverage ratio

```js
const totalPaid = baseCouponHalfYear + outcomePaid;
const coverage  = totalPaid > 0 ? revenueIn / totalPaid : 0;
```

This is the headline metric: **minted credit revenue ÷ total coupon paid this
period.** Above `1.0x` means the verified outcomes generated more revenue than
the coupon cost — the bond paid for itself that period. Below `1.0x` means the
credits offset part, but not all, of the coupon.

This ratio is honest about what it is: a per-period, illustrative coverage
figure driven by the demo's `credit_rate` assumptions. It is **not** a debt
service coverage ratio (DSCR) in the project-finance sense, and it should not
be read as one. See [`LIMITATIONS.md`](LIMITATIONS.md).

## Worked example (from `npm run simulate`, period 2026-H1)

**Plum Island — `TWBB-2034-PLUM`.** Seeded 220/190 bps, `raised` set to 62% of
the \$31.5M target ≈ \$19.53M. Covenants and readings:

| Covenant                         | cmp | thr | weight | read | met | credit |
|----------------------------------|-----|-----|--------|------|-----|--------|
| Marsh acreage restored           | gte | 38  | 0.40   | 41   | ✓   | resilience_payment @ \$9,000/ac |
| Blue carbon sequestered          | gte | 900 | 0.40   | 1020 | ✓   | blue_carbon @ \$42/tCO₂ |
| Neighborhood flood-days          | lte | 6   | 0.20   | 9    | ✗   | none (guardrail) |

A nor'easter pushes flood-days to 9, missing the ≤ 6 guardrail. Result:

- `outcome_paid` ≈ **\$148,428** (the 0.40 + 0.40 acreage and carbon slices)
- `outcome_held` ≈ **\$37,107** (the 0.20 flood-day slice, rolled forward)
- `revenue_minted` ≈ **\$411,840** (41 × 9,000 + 1020 × 42)
- `self_funding_coverage` ≈ **1.13x**

So even with a held guardrail, the two met outcomes minted enough credit
revenue to more than cover the period's coupon. That is the mechanism working
as designed: the miss correctly costs investors part of their at-risk yield,
while the genuine resilience gains still fund the bond.

**Narragansett — `TWBB-2033-NARR`.** All three covenants met; `outcome_held`
\$0; coverage ≈ 0.25x because its credit rates (water-quality @ \$55) mint less
relative to its larger raised base. A fully-performing bond can still have
coverage below 1.0x — coverage depends on the credit pricing, not just on
whether covenants were met.

The contrast between the two bonds is the useful lesson: **meeting covenants
controls the coupon; credit pricing controls the coverage ratio.** They are
separate levers.
