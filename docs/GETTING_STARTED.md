# Getting Started

This guide takes you from a fresh clone to a running app with seeded data and
a settled coupon period.

## Prerequisites

- **Node.js 20 or newer.** The `engines` field in `package.json` enforces
  `>=20`. Check with `node -v`.
- A C/C++ toolchain for `better-sqlite3`'s native build. On most systems npm
  installs a prebuilt binary and you need nothing extra; if the install step
  tries to compile, you'll need build tools (`build-essential` on Debian/Ubuntu,
  Xcode Command Line Tools on macOS).
- No database server, message queue, or cloud account. Storage is a local
  SQLite file.

## Install

```bash
npm install
```

This pulls Express, better-sqlite3, JWT/bcrypt, zod, and the rate limiter.
There are no external services to configure to get running.

## Configure (optional)

Copy the example environment file and edit if you want a non-default port or a
real signing secret:

```bash
cp .env.example .env
```

```
PORT=3000
JWT_SECRET=change-me-to-a-long-random-string
```

If you skip this, the app listens on port 3000 and uses a built-in development
JWT secret. **Set a real `JWT_SECRET` for anything beyond local play** — see
[`DEPLOYMENT.md`](DEPLOYMENT.md).

## Seed the database

```bash
npm run seed
```

This wipes the data tables and inserts three New England projects, one bond
per project, eight sensors, and their covenant metrics. It also creates the
demo verifier account. Expected output ends with:

```
Seeded: 3 projects, 3 bonds, 8 sensors.
Demo verifier login → verifier@woodshole.demo / verifier123
```

## Feed sensor data and settle a period

```bash
npm run simulate
```

This ingests one realistic reading per sensor (Plum Island is deliberately
pushed over its flood-day guardrail so you can see a **hold**), then runs the
verification + coupon engine for period `2026-H1` on all three bonds and prints
the settlement. You'll see something like a 1.13x self-funding coverage ratio
on the Plum Island bond and a held flood-day covenant.

## Run the app

```bash
npm start
```

Open <http://localhost:3000>. Click **Register**, create an investor account,
open a bond, and invest. Your portfolio's blended yield reflects which
covenants are currently verified — a held covenant pulls the realized yield
below the headline coupon.

To submit your own readings or run settlement from the UI/API, log in with the
demo verifier:

```
verifier@woodshole.demo / verifier123
```

## Everyday commands

| Command           | What it does                                        |
|-------------------|-----------------------------------------------------|
| `npm start`       | Run the server on `PORT` (default 3000)             |
| `npm run dev`     | Same, with `--watch` auto-reload                    |
| `npm run seed`    | Reset data tables and insert demo projects/bonds    |
| `npm run simulate`| Feed readings and settle period `2026-H1`           |
| `npm run reset`   | Delete the SQLite database files entirely           |

## Reset to a clean slate

```bash
npm run reset   # deletes the .db, .db-wal, .db-shm files
npm run seed    # recreate schema + demo data
```

`reset` removes the database files; the schema is recreated automatically the
next time any script or the server opens the database (the schema lives in
`server/lib/db.js` and runs on import).

## Troubleshooting

- **`better-sqlite3` fails to install / load.** You're likely on an unsupported
  Node version or missing build tools. Confirm `node -v` is 20+, then
  `rm -rf node_modules package-lock.json && npm install`.
- **Port already in use.** Set `PORT` in `.env` or `PORT=4000 npm start`.
- **Coupon amounts are all zero after settlement.** Settlement multiplies by
  the capital a bond has `raised`. `npm run simulate` injects raised capital
  before settling; if you settle a freshly seeded bond with no investments and
  no simulated raise, the math is correctly zero. Invest in the bond or run the
  simulation first.
- **Readings submitted but covenant still shows pending.** A covenant is
  evaluated against the latest reading of its `sensor_kind` on that bond's
  project. Make sure the reading went to a sensor whose `kind` matches the
  covenant's `sensor_kind`.
