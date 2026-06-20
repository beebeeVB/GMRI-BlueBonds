# Deployment & Hardening

This reference build runs happily on a laptop. Running it anywhere others can
reach it requires the steps below. None of this turns it into a regulated
offering — see [`LIMITATIONS.md`](LIMITATIONS.md) for that boundary.

## Runtime requirements

- Node.js 20+ on the host.
- A writable directory for the SQLite database. The app creates
  `server/data/tidewater.db` (plus `-wal` and `-shm`) relative to
  `server/lib/db.js`. Ensure the process can write there, and that the path
  persists across restarts (don't put it on ephemeral container storage you
  expect to lose).
- `better-sqlite3` is a native module; build it on the same platform/arch you
  deploy to, or use a base image with the prebuilt binary.

## Configuration

Set these as real environment variables (not a committed `.env`):

| Variable     | Purpose                       | Notes                                   |
|--------------|-------------------------------|-----------------------------------------|
| `PORT`       | listen port                   | defaults to 3000                        |
| `JWT_SECRET` | token signing secret          | **must** be a long random string        |

If `JWT_SECRET` is unset the code falls back to a hardcoded development secret
(`server/lib/auth.js`). That fallback is fine locally and unacceptable
anywhere else: anyone who knows it can forge tokens for any role, including
`verifier` and `admin`. Generate one, e.g. `openssl rand -hex 32`, and set it
in the environment.

## Process and reverse proxy

- Run under a process manager (systemd, pm2) so it restarts on crash.
- Put it behind a TLS-terminating reverse proxy (nginx, Caddy). The app speaks
  plain HTTP; never expose it without TLS, because bearer tokens travel in the
  `Authorization` header.
- The app sets permissive CORS (`app.use(cors())` with no options) — it accepts
  any origin. Lock this down to your known frontend origin(s) before exposing
  the API publicly.

## What is already in place

- **Password hashing:** bcrypt at cost 10 (`server/routes/auth.js`).
- **Auth:** JWT bearer tokens, 7-day expiry.
- **Input validation:** zod schemas on register, login, invest, readings, and
  run.
- **Rate limiting:** 50 requests / 15 min on `/api/auth` only.
- **SQL safety:** all queries use parameterized statements via better-sqlite3
  prepared statements.
- **Atomic settlement:** the engine runs inside a single DB transaction.

## What you must add before exposing it

- **Rate-limit the rest of the API,** especially `/api/verify/*` and
  `/api/invest`. Only the auth routes are throttled today.
- **Tighten CORS** to specific origins.
- **Security headers.** Add `helmet` (HSTS, X-Content-Type-Options, etc.).
- **Backups.** The whole state is one SQLite file. Snapshot it on a schedule;
  with WAL enabled, copy the `.db`, `-wal`, and `-shm` together or use
  `sqlite3 .backup`.
- **Concurrency.** better-sqlite3 is synchronous and single-process. For more
  than light load, run a single instance (not a multi-process cluster against
  the same file) or migrate to a client/server database.
- **Reading authenticity.** Readings are currently unsigned numbers any
  verifier-role token can post. A real system needs cryptographically signed
  device payloads and an independent attestation/oracle layer so readings
  can't be forged. This is the single biggest gap between the demo and a
  trustworthy instrument.
- **Observability.** Add structured request logging and error tracking; the
  reference build logs almost nothing.

## CI

`.github/workflows/ci.yml` runs on push to `main` and on pull requests: it
installs, seeds, simulates, starts the server, and curls `/api/health` and
`/api/bonds` as a smoke test. Treat a green CI run as "it boots and the core
loop runs," not as a test of correctness — there is no unit-test suite yet.
Adding one is the highest-value contribution (see [`CONTRIBUTING.md`](CONTRIBUTING.md)).

## Upgrading the database

The schema is created with `CREATE TABLE IF NOT EXISTS` on module import; there
are no migrations. If you change a table's shape, you must write your own
migration (or `npm run reset` and re-seed in development, which destroys data).
Plan a real migration strategy before storing anything you care about.
