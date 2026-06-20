# API Reference

All endpoints are served by the Express app in `server/index.js` under the
`/api` prefix. Requests and responses are JSON. Authentication is a bearer JWT.

- **Base URL (local):** `http://localhost:3000`
- **Auth header:** `Authorization: Bearer <token>` where `<token>` comes from
  `/api/auth/register` or `/api/auth/login`.
- **Token lifetime:** 7 days (`expiresIn: '7d'` in `server/lib/auth.js`).
- **Rate limiting:** the `/api/auth` routes are limited to 50 requests per
  15-minute window per IP (`express-rate-limit` in `server/index.js`). Other
  routes are not rate-limited in the reference build.

## Roles

The `role` claim on the JWT gates the verification endpoints.

| Role       | Can do                                                        |
|------------|---------------------------------------------------------------|
| `investor` | Default for new registrations. Invest, view portfolio.        |
| `verifier` | Submit readings, run settlement. The demo account is this.    |
| `issuer`   | Same verification powers as verifier in this build.           |
| `admin`    | Same verification powers; intended as superset.               |

Readings and settlement accept `verifier`, `issuer`, or `admin`.

## Endpoint summary

| Method | Route                     | Auth     | Purpose                                |
|--------|---------------------------|----------|----------------------------------------|
| GET    | `/api/health`             | —        | Liveness check                         |
| POST   | `/api/auth/register`      | —        | Create account, returns token + user   |
| POST   | `/api/auth/login`         | —        | Sign in, returns token + user          |
| GET    | `/api/auth/me`            | any user | Current user                           |
| GET    | `/api/bonds`              | —        | List bonds with funding + verification |
| GET    | `/api/bonds/:id`          | —        | Bond detail: covenants, sensors, credits, coupons |
| GET    | `/api/bonds/:id/readings` | —        | Recent sensor readings for the project |
| POST   | `/api/invest`             | investor | Commit capital to a bond               |
| GET    | `/api/invest/portfolio`   | investor | Positions + live blended yield         |
| POST   | `/api/verify/readings`    | verifier | Ingest a sensor reading                |
| POST   | `/api/verify/run`         | verifier | Run settlement for a bond + period     |

---

## Health

### `GET /api/health`

No auth. Returns service liveness.

```json
{ "ok": true, "service": "tidewater", "time": "2026-06-20T17:44:00.000Z" }
```

---

## Auth

### `POST /api/auth/register`

Create an account. Body validated by zod.

| Field        | Type    | Required | Notes                                   |
|--------------|---------|----------|-----------------------------------------|
| `email`      | string  | yes      | Must be a valid email; must be unique   |
| `password`   | string  | yes      | Minimum 8 characters                    |
| `full_name`  | string  | yes      | Minimum 2 characters                    |
| `state`      | string  | no       | One of `ME NH MA RI CT VT`              |
| `accredited` | boolean | no       | Defaults to false                       |

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"sam@example.com","password":"reefsreefs","full_name":"Sam Tide","state":"ME"}'
```

**201**

```json
{
  "token": "eyJhbGci...",
  "user": { "id": 2, "email": "sam@example.com", "full_name": "Sam Tide",
            "state": "ME", "accredited": 0, "role": "investor" }
}
```

**Errors:** `400` validation message (e.g. "Use at least 8 characters."),
`409` "That email is already registered."

### `POST /api/auth/login`

| Field      | Type   | Required |
|------------|--------|----------|
| `email`    | string | yes      |
| `password` | string | yes      |

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"verifier@woodshole.demo","password":"verifier123"}'
```

**200** returns the same `{ token, user }` shape. **Errors:** `400` invalid
input, `401` "Email or password is incorrect."

### `GET /api/auth/me`

Requires a bearer token. Returns the current user record (no password hash).

```bash
curl http://localhost:3000/api/auth/me -H "Authorization: Bearer $TOKEN"
```

---

## Bonds

### `GET /api/bonds`

No auth. Lists every bond joined to its project, with computed funding and
live verification counts.

Each item includes the bond columns plus:

| Field            | Meaning                                              |
|------------------|------------------------------------------------------|
| `project_name`, `town`, `state`, `type`, `lat`, `lng`, `project_slug` | from the joined project |
| `pct_funded`     | `min(100, round(raised / target_raise * 100))`       |
| `total_coupon_bps` | `base_coupon_bps + outcome_coupon_bps`             |
| `metrics_met`    | count of covenants currently verified as met         |
| `metrics_total`  | total covenants on the bond                          |

```json
{
  "bonds": [
    {
      "id": 1, "series": "TWBB-2034-PLUM", "name": "Plum Island Resilience Bond",
      "tier": "resilience", "target_raise": 31500000, "raised": 19530000,
      "base_coupon_bps": 220, "outcome_coupon_bps": 190, "term_years": 10,
      "min_investment": 1000, "status": "open", "maturity": "2034-06-01",
      "project_name": "Plum Island Estuary Restoration", "town": "Newbury",
      "state": "MA", "type": "marsh", "pct_funded": 62, "total_coupon_bps": 410,
      "metrics_met": 2, "metrics_total": 3
    }
  ]
}
```

### `GET /api/bonds/:id`

No auth. Full detail for one bond.

Returns:

- `bond` — bond columns + project fields + `total_coupon_bps` + `pct_funded`.
- `sensors` — the project's sensors (`id, kind, vendor, unit, last_reading, last_seen`).
- `verification` — live covenant snapshot (no writes): for each metric its
  `label, sensor_kind, value, threshold, comparator, met, credit_type,
  status` where status is `pending` (no reading), `met`, or `held`.
- `credits` — up to 50 most recent minted credits.
- `coupons` — up to 20 most recent coupon events.
- `revenue_total` — sum of all credit revenue for the bond.

**Errors:** `404` "Bond not found."

### `GET /api/bonds/:id/readings`

No auth. The 40 most recent sensor readings for the bond's project, newest
first: `kind, vendor, unit, value, recorded_at`.

---

## Invest

### `POST /api/invest`

Requires an investor (any signed-in user) token.

| Field     | Type   | Required | Notes                          |
|-----------|--------|----------|--------------------------------|
| `bond_id` | int    | yes      | Positive integer               |
| `amount`  | number | yes      | Positive; must be ≥ the bond's `min_investment` |

```bash
curl -X POST http://localhost:3000/api/invest \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"bond_id":1,"amount":5000}'
```

On success the investment is recorded and the bond's `raised` increases; if
`raised` reaches `target_raise` the bond flips to `funded`.

**201**

```json
{ "ok": true, "message": "Committed $5,000 to TWBB-2034-PLUM." }
```

**Errors:** `400` invalid input / below minimum / series closed, `404` bond
not found.

> Note: the senior-tier accreditation check is present but intentionally a
> soft no-op in this build (see the comment in `server/routes/invest.js`).
> Suitability gating is a production concern — see [`LIMITATIONS.md`](LIMITATIONS.md).

### `GET /api/invest/portfolio`

Requires a signed-in user. Returns the caller's positions plus a live rollup.

For each position the response adds:

| Field                 | Meaning                                                       |
|-----------------------|---------------------------------------------------------------|
| `base_annual`         | `amount × base_coupon_bps / 10000` (always paid)              |
| `outcome_annual`      | `amount × outcome_coupon_bps / 10000 × outcomeFactor`         |
| `outcome_release_pct` | `round(outcomeFactor × 100)`                                  |

`outcomeFactor` is the share of the outcome coupon actually released in the
bond's most recent coupon event: `outcome_paid / (outcome_paid + outcome_held)`.
If there is no coupon event yet, it defaults to 1 (full projected release).

The `summary` block:

```json
{
  "summary": {
    "total_invested": 5000,
    "projected_annual_income": 186.55,
    "blended_yield_pct": 3.73,
    "position_count": 1
  }
}
```

This is why a held covenant lowers your realized yield: the held outcome
tranche reduces `outcomeFactor`, which reduces `outcome_annual` and the
blended yield.

---

## Verify (verifier / issuer / admin only)

### `POST /api/verify/readings`

Ingest one sensor reading. In production this would be a cryptographically
signed device payload; here it is a plain value.

| Field       | Type   | Required |
|-------------|--------|----------|
| `sensor_id` | int    | yes      |
| `value`     | number | yes      |

```bash
curl -X POST http://localhost:3000/api/verify/readings \
  -H "Authorization: Bearer $VERIFIER_TOKEN" -H 'Content-Type: application/json' \
  -d '{"sensor_id":3,"value":4}'
```

Stores the reading (readings are append-only) and updates the sensor's
`last_reading` / `last_seen`. **Errors:** `403` if the role isn't a
verification role, `400` invalid input, `404` sensor not found.

### `POST /api/verify/run`

Run the verification + coupon engine for a bond and a settlement period.

| Field     | Type   | Required | Notes                       |
|-----------|--------|----------|-----------------------------|
| `bond_id` | int    | yes      | Positive integer            |
| `period`  | string | yes      | Free-form label, e.g. `2026-H1` |

```bash
curl -X POST http://localhost:3000/api/verify/run \
  -H "Authorization: Bearer $VERIFIER_TOKEN" -H 'Content-Type: application/json' \
  -d '{"bond_id":1,"period":"2026-H1"}'
```

Returns the structured settlement result: per-metric `met`/coupon share,
`base_paid`, `outcome_paid`, `outcome_held`, `revenue_minted`, and
`self_funding_coverage`. See [`ENGINE.md`](ENGINE.md) for exactly how each
figure is computed. **Errors:** `403` wrong role, `400` invalid input or
engine error (e.g. "bond not found").

## Conventions and gotchas

- **Money is illustrative.** Investments record commitments and adjust
  `raised`; no funds move.
- **Coupon accrual is half-year.** The engine divides annual coupon by 2 per
  settlement (see [`ENGINE.md`](ENGINE.md)), while the portfolio endpoint
  reports an annualized projection. Don't expect the two to be identical.
- **Catch-all route.** Any non-`/api` path serves the SPA `index.html`, so a
  mistyped API path returns HTML, not a JSON 404.
