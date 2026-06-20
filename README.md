# 🌊 Tidewater — Blue Bonds for New England Coastal Resilience

Outcome-linked blue bonds where the **coupon is driven by marine-technology
verification**, and the **revenue that repays the bond is minted by the verified
outcomes themselves**. The proof and the payment come from the same sensor reading.

> A salt marsh, oyster reef, or living shoreline is instrumented with tide
> gauges, satellites, drones, eDNA samplers and carbon-flux towers. When a
> project hits its target, the verified outcome mints a tradable credit
> (blue-carbon / water-quality / resilience payment). That credit revenue flows
> to the ring-fenced vehicle holding investor capital, which releases the
> outcome-linked coupon. Miss a target and that tranche is **held, not lost** —
> it rolls into the next remediation cycle.

This is a **full, launchable reference implementation**: real account
registration, a bond marketplace, live sensor-driven verification, an investment
flow, and a portfolio whose yield literally tracks coast performance.

📄 See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full mechanism.

---

## Quick start

```bash
npm install        # install dependencies (SQLite — no external services needed)
npm run seed       # create projects, bonds, sensors, covenant metrics
npm run simulate   # feed sensor readings + run the verification/coupon engine
npm start          # launch on http://localhost:3000
```

Open <http://localhost:3000>, click **Register**, create an account, browse a
bond, and invest. Your portfolio yield will reflect which covenants are
currently verified.

**Demo verifier account** (can submit readings & run settlement):
`verifier@woodshole.demo` / `verifier123`

```bash
npm run reset      # wipe the database
npm run dev        # run with auto-reload
```

---

## What's inside

```
server/
  index.js            Express app + static hosting
  lib/
    db.js             SQLite schema (users, projects, bonds, sensors,
                      readings, metrics, investments, credits, coupon_events)
    engine.js         ⭐ verification + coupon engine (the core mechanism)
    auth.js           JWT + bcrypt helpers
  routes/
    auth.js           register / login / me
    bonds.js          list / detail / live readings
    invest.js         invest / portfolio (live yield rollup)
    verify.js         ingest readings / run settlement (verifier role)
public/
  index.html          SPA shell
  css/app.css         Tidewater design system (teal / marsh / storm-ochre)
  js/app.js           single-page app: home, marketplace, bond detail,
                      auth, invest, portfolio
scripts/
  seed.js             realistic NE projects, bonds, sensors, covenants
  simulate.js         feeds readings (one bond deliberately misses a guardrail)
  reset.js            drop the database
docs/
  ARCHITECTURE.md     how the money + tech + verification loops connect
```

## How the self-sustaining loop works (one paragraph)

`marine sensor reading → covenant threshold check → if met, mint a sellable
credit → credit revenue flows to the SPV → SPV releases the outcome-linked
coupon`. Because a met outcome both *proves* resilience and *generates* the cash
that pays for it, the instrument is self-sustaining. The engine reports a
**self-funding coverage ratio** (credit revenue ÷ coupon paid); above 1.0x the
bond pays for itself.

## API

| Method | Route                     | Auth        | Purpose                              |
|--------|---------------------------|-------------|--------------------------------------|
| POST   | `/api/auth/register`      | —           | create account                       |
| POST   | `/api/auth/login`         | —           | sign in (returns JWT)                |
| GET    | `/api/auth/me`            | investor    | current user                         |
| GET    | `/api/bonds`              | —           | list bonds + funding + verification  |
| GET    | `/api/bonds/:id`          | —           | detail: covenants, sensors, credits  |
| GET    | `/api/bonds/:id/readings` | —           | recent sensor readings               |
| POST   | `/api/invest`             | investor    | commit capital to a bond             |
| GET    | `/api/invest/portfolio`   | investor    | positions + live blended yield       |
| POST   | `/api/verify/readings`    | verifier    | ingest a sensor reading              |
| POST   | `/api/verify/run`         | verifier    | run settlement for a bond/period     |

## Tech

Node 20+ · Express · better-sqlite3 · JWT · bcrypt · zod · vanilla SPA frontend.
Zero external services — clone, install, run.

## ⚠️ Disclaimer

This is a technical reference implementation, **not** a regulated securities
offering. Yields, credit rates, and partners are illustrative. Nothing here is
an offer to sell or solicitation to buy any security. A real launch requires
securities counsel, KYC/AML, a custody/settlement partner, and credit-registry
integration. See the end of `docs/ARCHITECTURE.md`.

## License

MIT
