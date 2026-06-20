# Limitations & Legal Boundary

Read this before you quote a yield, show this to an investor, or treat any
number here as real. Tidewater is a **technical reference implementation**. It
demonstrates a mechanism; it does not implement a regulated financial product.

## This is not a securities offering

Nothing in this repository is an offer to sell, or a solicitation of an offer
to buy, any security. Yields, coupon splits, credit rates, tiers, and named
vendors are **illustrative**. A real launch requires, at minimum, securities
counsel, a registration or exemption strategy, KYC/AML, suitability gating, a
custody and settlement partner, and integration with real credit registries.
See the closing section of [`ARCHITECTURE.md`](ARCHITECTURE.md).

## Where the demo simplifies

### Money doesn't move
`POST /api/invest` records a commitment and increases the bond's `raised`
field. No funds are custodied, transferred, or held in escrow. There is no
SPV, no conduit, no bank account. The "capital loop" is a database row.

### Readings are unsigned and trusted
`POST /api/verify/readings` accepts a plain number from any token with a
verification role. There is no device signature, no attestation, no
tamper-evidence. In a real system the integrity of the entire instrument rests
on the readings being authentic — this is the most important gap to close, and
it is not closed here.

### Credit rates and coverage are illustrative
The `credit_rate` values in the seed (\$42/tCO₂, \$55/kg N, \$9,000–\$12,000
per resilience unit) are chosen to make the arithmetic legible, not to reflect
any market price. Consequently the **self-funding coverage ratio is an
illustrative figure, not a DSCR.** It is minted-credit-revenue ÷ coupon-paid
for one period under made-up prices. Do not present it as a debt-service
coverage ratio or as evidence that a real bond would pay for itself.

### The `lte` credit-quantity formula is a placeholder
For "stay under" covenants the engine scores quantity as
`2 × threshold − value`. That is a deliberate, illustrative shape, not a market
convention. A real structurer would replace it with a contracted formula. In
the seed data, every `lte` covenant is a non-revenue guardrail, so this branch
never actually mints — it exists for completeness. See [`ENGINE.md`](ENGINE.md).

### No credit-registry integration
Minted credits are rows in a `credits` table. They are not issued, serialized,
or retired in any real carbon (e.g. Verra) or state nutrient/water-quality
registry, and they cannot be sold to anyone.

### Suitability gating is a no-op
The senior-tier accreditation check in `server/routes/invest.js` is present but
intentionally does nothing. Real suitability and accreditation enforcement is a
compliance requirement, not a code comment.

### Coupon model is simplified
Coupon accrues as a flat half-year slice of `raised × bps`. There is no day-count
convention, no amortization schedule, no accrual calendar, no reinvestment, no
default modeling, and no secondary-market pricing. "Held" tranches are tracked
as a number with a note; the actual remediation-rollover accounting a real
instrument needs is not implemented.

### Operational simplifications
Single-process synchronous SQLite; permissive CORS; rate limiting only on auth
routes; a dev JWT-secret fallback; no migrations; no test suite. These are
covered in [`DEPLOYMENT.md`](DEPLOYMENT.md).

## What the demo *does* honestly demonstrate

- An **outcome-linked** coupon: the at-risk portion of yield genuinely tracks
  whether covenants are verified met, and a missed covenant verifiably lowers
  an investor's realized yield.
- A **shared evidence feed**: the same readings the coupon engine uses are the
  ones the UI and API expose, so the proof and the payment are wired to the
  same source.
- **Hold-not-lose** mechanics: a missed covenant withholds its coupon slice
  rather than destroying it.
- A **revenue-stacking** structure: different covenants map to different
  credit types, modeling how a non-revenue-generating habitat could be made
  bankable.

Those are real architectural claims the code backs up. The financial magnitudes
around them are not.

## How to talk about this honestly

Good: "A reference implementation of an outcome-linked blue bond, where verified
sensor outcomes drive the at-risk coupon and mint illustrative credits."

Not good: "A blue bond yielding 4.1% with 1.13x self-funding coverage." Those
numbers are demo parameters, not findings.
