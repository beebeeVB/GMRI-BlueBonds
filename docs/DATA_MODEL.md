# Data Model

The schema is defined and created on import in `server/lib/db.js` using
`better-sqlite3`. The database is a single file at `server/data/tidewater.db`
with WAL journaling and foreign keys enabled. `CREATE TABLE IF NOT EXISTS`
means importing the module is enough to materialize the schema.

## Entity overview

```
users                                     (accounts; role gates verification)

projects ──1:N── sensors ──1:N── readings (the physical coast + its evidence)
   │
   └──1:N── bonds ──1:N── metrics         (the instrument + its covenants)
                │   │
                │   └────1:N── credits     (revenue minted from met outcomes)
                │
                ├──1:N── investments        (investor positions)
                └──1:N── coupon_events       (settlement ledger)
```

A **project** is a physical restoration site. It carries **sensors**, and each
sensor accumulates **readings**. A project is financed by one or more
**bonds**. Each bond defines **metrics** (covenants) that are checked against
the latest reading of a matching sensor kind. Meeting a covenant can mint a
**credit**; every settlement writes a **coupon_event**. Investors hold
**investments** in a bond.

## Tables

### `users`

| Column          | Type    | Notes                                          |
|-----------------|---------|------------------------------------------------|
| `id`            | INTEGER | PK, autoincrement                              |
| `email`         | TEXT    | unique, not null                               |
| `password_hash` | TEXT    | bcrypt hash (cost 10)                          |
| `full_name`     | TEXT    | not null                                       |
| `state`         | TEXT    | `ME NH MA RI CT VT` (validated at the route)   |
| `accredited`    | INTEGER | 0/1, default 0                                 |
| `role`          | TEXT    | `investor` (default) `issuer` `verifier` `admin` |
| `created_at`    | TEXT    | `datetime('now')`                              |

### `projects`

| Column        | Type    | Notes                                              |
|---------------|---------|----------------------------------------------------|
| `id`          | INTEGER | PK                                                 |
| `slug`        | TEXT    | unique human key, e.g. `plum-island`               |
| `name`        | TEXT    | not null                                           |
| `town`,`state`| TEXT    | location                                           |
| `lat`,`lng`   | REAL    | map coordinates                                    |
| `type`        | TEXT    | `marsh` `reef` `living_shoreline` `hybrid` `seagrass` |
| `description` | TEXT    | prose                                              |
| `created_at`  | TEXT    | `datetime('now')`                                  |

### `bonds`

The tradable instrument, tied to a project.

| Column               | Type    | Notes                                          |
|----------------------|---------|------------------------------------------------|
| `id`                 | INTEGER | PK                                             |
| `project_id`         | INTEGER | FK → `projects.id`, not null                   |
| `series`             | TEXT    | unique, e.g. `TWBB-2034-PLUM`                  |
| `name`               | TEXT    | not null                                       |
| `tier`               | TEXT    | `community` `resilience` `senior`              |
| `target_raise`       | REAL    | USD goal                                       |
| `raised`             | REAL    | USD committed so far (default 0)               |
| `base_coupon_bps`    | INTEGER | guaranteed floor coupon, in basis points       |
| `outcome_coupon_bps` | INTEGER | at-risk coupon tied to verification, in bps    |
| `term_years`         | INTEGER | tenor                                          |
| `min_investment`     | REAL    | minimum ticket                                 |
| `status`             | TEXT    | `open` (default) `funded` `closed`             |
| `maturity`           | TEXT    | date string                                    |
| `created_at`         | TEXT    | `datetime('now')`                              |

Total headline coupon is `base_coupon_bps + outcome_coupon_bps`. Basis points:
100 bps = 1%. A 220/190 split is a 2.20% guaranteed floor plus 1.90% at-risk,
4.10% headline.

### `sensors`

The marine-tech "oracles" attached to a project.

| Column         | Type    | Notes                                                       |
|----------------|---------|-------------------------------------------------------------|
| `id`           | INTEGER | PK                                                          |
| `project_id`   | INTEGER | FK → `projects.id`                                          |
| `kind`         | TEXT    | `tide_gauge` `multispectral_sat` `drone_lidar` `edna` `carbon_flux` `wq_nitrogen` |
| `vendor`       | TEXT    | illustrative, e.g. Planet Labs, Sofar Ocean, Hohonu        |
| `unit`         | TEXT    | `flood_days` `acres` `pct_survival` `tCO2` `kg_N`           |
| `last_reading` | REAL    | cached latest value                                        |
| `last_seen`    | TEXT    | timestamp of latest reading                                |

A covenant references a sensor by **`kind`**, not by id. The engine evaluates
against the latest reading of that kind on the bond's project, so multiple
sensors of the same kind would resolve to whichever has the newest reading.

### `readings`

Append-only time series — the raw evidence.

| Column        | Type    | Notes                          |
|---------------|---------|--------------------------------|
| `id`          | INTEGER | PK                             |
| `sensor_id`   | INTEGER | FK → `sensors.id`              |
| `value`       | REAL    | the measurement                |
| `recorded_at` | TEXT    | `datetime('now')`              |

### `metrics`

A bond covenant: what the outcome coupon is tied to, and whether meeting it
mints revenue.

| Column        | Type    | Notes                                                       |
|---------------|---------|-------------------------------------------------------------|
| `id`          | INTEGER | PK                                                          |
| `bond_id`     | INTEGER | FK → `bonds.id`                                             |
| `sensor_kind` | TEXT    | which sensor kind verifies this                            |
| `label`       | TEXT    | human description, e.g. "Marsh acreage restored ≥ 38 ac"   |
| `comparator`  | TEXT    | `gte` (value ≥ threshold) or `lte` (value ≤ threshold)     |
| `threshold`   | REAL    | the covenant bar                                           |
| `weight`      | REAL    | share of the outcome coupon; weights per bond should sum to 1.0 |
| `credit_type` | TEXT    | `blue_carbon` `water_quality` `resilience_payment` `none`  |
| `credit_rate` | REAL    | USD per unit of credit (default 0)                         |
| `status`      | TEXT    | `pending` (default) `met` `held` — updated by settlement   |

A covenant with `credit_type = 'none'` or `credit_rate = 0` is a pure
**guardrail**: it can release or hold coupon but mints no revenue. In the seed
data the flood-day covenants are guardrails.

### `investments`

| Column       | Type    | Notes                |
|--------------|---------|----------------------|
| `id`         | INTEGER | PK                   |
| `user_id`    | INTEGER | FK → `users.id`      |
| `bond_id`    | INTEGER | FK → `bonds.id`      |
| `amount`     | REAL    | USD committed        |
| `created_at` | TEXT    | `datetime('now')`    |

### `credits`

Minted when a verified outcome is met — the self-sustaining revenue.

| Column        | Type    | Notes                                       |
|---------------|---------|---------------------------------------------|
| `id`          | INTEGER | PK                                          |
| `bond_id`     | INTEGER | FK → `bonds.id`                             |
| `metric_id`   | INTEGER | FK → `metrics.id`                          |
| `credit_type` | TEXT    | copied from the metric                      |
| `quantity`    | REAL    | units earned (see [`ENGINE.md`](ENGINE.md)) |
| `unit_price`  | REAL    | the metric's `credit_rate`                  |
| `revenue`     | REAL    | `quantity × unit_price`, flows to the SPV   |
| `minted_at`   | TEXT    | `datetime('now')`                           |

### `coupon_events`

The settlement ledger investors watch. One row per `evaluateBond` call.

| Column         | Type    | Notes                                            |
|----------------|---------|--------------------------------------------------|
| `id`           | INTEGER | PK                                               |
| `bond_id`      | INTEGER | FK → `bonds.id`                                  |
| `period`       | TEXT    | settlement label, e.g. `2026-H1`                 |
| `base_paid`    | REAL    | half-year base coupon (paid regardless)          |
| `outcome_paid` | REAL    | half-year outcome coupon released                |
| `outcome_held` | REAL    | half-year outcome coupon held (rolls to remediation) |
| `revenue_in`   | REAL    | credit revenue minted this settlement            |
| `note`         | TEXT    | human summary of the outcome                     |
| `created_at`   | TEXT    | `datetime('now')`                                |

The most recent `coupon_event` for a bond drives the portfolio yield rollup:
`outcome_paid / (outcome_paid + outcome_held)` is the fraction of the at-risk
coupon an investor is currently earning.

## Referential integrity and lifecycle

- Foreign keys are enforced (`PRAGMA foreign_keys = ON`). There are no cascade
  deletes; `npm run seed` clears child tables in dependency order before
  re-inserting (`coupon_events, credits, investments, readings, metrics,
  sensors, bonds, projects`).
- `readings` and `coupon_events` are designed to be append-only history.
- `metrics.status` is mutated in place by settlement to reflect the latest
  evaluation; the durable history of releases/holds lives in `coupon_events`.
