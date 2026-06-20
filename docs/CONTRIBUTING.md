# Contributing

Thanks for working on Tidewater. This is a reference implementation, so the bar
is "clear, correct, and honest about what's real" rather than "production
feature-complete."

## Setup

```bash
npm install
npm run seed
npm run simulate
npm run dev      # auto-reloads on change
```

See [`GETTING_STARTED.md`](GETTING_STARTED.md) for details and troubleshooting.

## Project layout

```
server/
  index.js          Express app, static hosting, /api/health, SPA catch-all
  lib/
    db.js           SQLite schema (created on import) + connection
    engine.js       verification + coupon engine — the core mechanism
    auth.js         JWT sign/verify, authRequired, optionalAuth
  routes/           auth.js, bonds.js, invest.js, verify.js
public/             index.html, css/app.css, js/app.js (vanilla SPA)
scripts/            seed.js, simulate.js, reset.js
docs/               this documentation set
```

When you change behavior, update the matching doc in `docs/` in the same PR.
The docs are meant to track the code exactly — an out-of-date doc is a bug.

## Conventions

- **ES modules** throughout (`"type": "module"`). Use `import`, not `require`.
- **Validate input with zod** at the route boundary, as the existing routes do.
  Never trust the body.
- **Parameterized SQL only.** Use better-sqlite3 prepared statements; never
  string-concatenate values into SQL.
- **Money and units stay explicit.** Coupons are basis points; document any new
  rate or unit in [`DATA_MODEL.md`](DATA_MODEL.md).
- **Keep illustrative numbers labeled.** If you add a rate or yield, say plainly
  in the docs that it's illustrative (see [`LIMITATIONS.md`](LIMITATIONS.md)).
  Don't let demo magnitudes masquerade as findings.
- **Engine changes need a worked example.** If you touch `engine.js`, update the
  worked example in [`ENGINE.md`](ENGINE.md) and re-run `npm run simulate` to
  confirm the printed numbers still match.

## High-value contributions

In rough priority order:

1. **A test suite.** There is none. Unit tests for `evaluateBond` (met, held,
   mixed, zero-principal, null-reading cases) would be the most useful single
   addition. Wire them into `.github/workflows/ci.yml`.
2. **Signed reading payloads.** An attestation layer so readings can't be
   forged — the biggest credibility gap (see [`LIMITATIONS.md`](LIMITATIONS.md)).
3. **Security hardening.** Rate-limit all routes, add `helmet`, lock down CORS,
   remove the dev JWT-secret fallback behavior in production.
4. **A migration strategy.** The schema is `CREATE TABLE IF NOT EXISTS` with no
   migrations; structural changes currently require a reset.
5. **Replacing placeholder math** (e.g. the `lte` credit-quantity formula) with
   contracted, documented formulas.

## Pull requests

- Keep PRs focused; one concern per PR.
- Run `npm run seed && npm run simulate` and confirm the server still boots
  (`npm start`, then `curl localhost:3000/api/health`) — this mirrors CI.
- Update the relevant `docs/` file(s) in the same PR.
- Describe what you changed and, if it touches the engine or schema, show the
  before/after settlement numbers.

## License

By contributing you agree your contributions are licensed under the repository's
MIT license.
