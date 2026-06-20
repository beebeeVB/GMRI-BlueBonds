# Seed Data & Simulation

Two scripts give you a populated, settled system to explore. A third tears it
down. None of them touch user accounts you create through the app, except that
`seed` recreates the demo verifier.

## `npm run seed` — `scripts/seed.js`

Idempotent reset of the demo *content* (not your registered users). It:

1. Deletes rows from `coupon_events, credits, investments, readings, metrics,
   sensors, bonds, projects` (dependency order).
2. Inserts the demo **verifier** account
   (`verifier@woodshole.demo` / `verifier123`, role `verifier`). Uses
   `INSERT OR IGNORE`, so re-seeding won't error if it already exists.
3. Inserts three projects, three bonds, eight sensors, and eight covenant
   metrics.

### Seeded projects

| Slug                 | Project                          | Town, State   | Type             |
|----------------------|----------------------------------|---------------|------------------|
| `plum-island`        | Plum Island Estuary Restoration  | Newbury, MA   | marsh            |
| `narragansett-reef`  | Narragansett Oyster Reef Belt    | Wickford, RI  | reef             |
| `casco-bay`          | Casco Bay Living Shoreline       | Portland, ME  | living_shoreline |

### Seeded bonds

| Series            | Tier       | Target raise | Base / Outcome bps | Term | Maturity   |
|-------------------|------------|--------------|--------------------|------|------------|
| `TWBB-2034-PLUM`  | resilience | \$31,500,000 | 220 / 190 (4.10%)  | 10y  | 2034-06-01 |
| `TWBB-2033-NARR`  | resilience | \$19,200,000 | 230 / 180 (4.10%)  | 9y   | 2033-06-01 |
| `TWBB-2031-CASCO` | community  | \$24,000,000 | 200 / 120 (3.20%)  | 5y   | 2031-06-01 |

Minimum investment is \$1,000 on all three.

### Seeded sensors

| Project            | Sensor kinds (vendor)                                                        |
|--------------------|------------------------------------------------------------------------------|
| Plum Island        | multispectral_sat (Planet Labs), carbon_flux (EddyPro Tower), tide_gauge (Hohonu) |
| Narragansett Reef  | edna (Smith-Root), wq_nitrogen (YSI EXO Sonde), tide_gauge (Sofar Ocean)     |
| Casco Bay          | tide_gauge (Sofar Ocean), drone_lidar (Wingtra)                              |

Vendor names are illustrative references to real product categories, not
endorsements or partnerships.

### Seeded covenants (and which mint revenue)

| Bond              | Covenant                          | cmp/thr | weight | credit_type / rate         |
|-------------------|-----------------------------------|---------|--------|----------------------------|
| `TWBB-2034-PLUM`  | Marsh acreage restored            | gte 38  | 0.40   | resilience_payment / \$9,000 |
| `TWBB-2034-PLUM`  | Blue carbon sequestered           | gte 900 | 0.40   | blue_carbon / \$42         |
| `TWBB-2034-PLUM`  | Neighborhood flood-days           | lte 6   | 0.20   | none (guardrail)           |
| `TWBB-2033-NARR`  | Oyster reef survival              | gte 70  | 0.40   | water_quality / \$55       |
| `TWBB-2033-NARR`  | Nitrogen removed                  | gte 1200| 0.40   | water_quality / \$55       |
| `TWBB-2033-NARR`  | Shoreline flood-days              | lte 8   | 0.20   | none (guardrail)           |
| `TWBB-2031-CASCO` | Flood-days                        | lte 5   | 0.60   | resilience_payment / \$12,000 |
| `TWBB-2031-CASCO` | Shoreline buffer                  | gte 9   | 0.40   | blue_carbon / \$42         |

Weights per bond sum to 1.0. **All `credit_rate` figures are illustrative** —
they make the demo's revenue arithmetic legible, not market-accurate.

## `npm run simulate` — `scripts/simulate.js`

Feeds one reading per sensor and settles period `2026-H1`. It deliberately
constructs one **hold** so the mechanism is visible:

1. Sets each bond's `raised` to a fraction of target (PLUM 62%, NARR 78%,
   CASCO 45%) so coupon math is non-zero.
2. Ingests readings — Plum Island's tide gauge reads **9 flood-days against a
   ≤ 6 guardrail**, a deliberate miss; everything else passes.
3. Calls `evaluateBond` for all three series and prints base paid, outcome
   released, outcome held, credit revenue, and the self-funding coverage ratio.

Expected highlights: Plum Island shows a held flood-day covenant with ~1.13x
coverage; Narragansett and Casco Bay meet all covenants. See the worked
example in [`ENGINE.md`](ENGINE.md) for the arithmetic.

Running `simulate` repeatedly appends more readings (readings are append-only),
and the latest one wins per sensor kind, so re-running with the same values is
safe and settles to the same decisions. Each run also writes a fresh
`coupon_event` per bond.

## `npm run reset` — `scripts/reset.js`

Deletes the SQLite files (`tidewater.db`, `-wal`, `-shm`) under
`server/data/`. The schema is recreated automatically the next time the
database module is imported (by any script or the server). Follow with
`npm run seed` to repopulate.

## Customizing the scenario

- **New project or bond:** add to the `projects` / `bonds` arrays in
  `seed.js`. Keep `series` unique.
- **New covenant:** add an `insMetric.run(...)` call. Ensure the bond's metric
  weights still sum to 1.0 and that `sensor_kind` matches a sensor on the same
  project.
- **Make a covenant mint revenue:** give it a `credit_type` other than `none`
  and a positive `credit_rate`.
- **Different readings / a different miss:** edit the `addReading(...)` calls in
  `simulate.js`. To force a hold, push a value past a covenant threshold.
- **Different period:** change the `'2026-H1'` label passed to `evaluateBond`.
