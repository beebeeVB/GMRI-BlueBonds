# Tidewater Documentation

Full documentation for the Tidewater outcome-linked blue-bond reference
implementation. Start here and follow the path that matches what you need.

| If you want to…                                            | Read |
|------------------------------------------------------------|------|
| Understand the mechanism (money + tech + verification)     | [`ARCHITECTURE.md`](ARCHITECTURE.md) |
| Stand the project up locally                               | [`GETTING_STARTED.md`](GETTING_STARTED.md) |
| Call the HTTP API                                          | [`API.md`](API.md) |
| Understand the database tables and how they relate         | [`DATA_MODEL.md`](DATA_MODEL.md) |
| Understand the coupon / credit math in detail              | [`ENGINE.md`](ENGINE.md) |
| Run, extend, or reset the seed + simulation data           | [`SIMULATION.md`](SIMULATION.md) |
| Deploy or harden for a real environment                    | [`DEPLOYMENT.md`](DEPLOYMENT.md) |
| Know what is illustrative vs. production-ready, and the law | [`LIMITATIONS.md`](LIMITATIONS.md) |
| Contribute changes                                         | [`CONTRIBUTING.md`](CONTRIBUTING.md) |

## What this project is

Tidewater is a launchable reference implementation of an **outcome-linked
blue bond**. Investor capital funds a coastal-resilience project (a salt
marsh, oyster reef, or living shoreline). Marine sensors measure whether the
project hits its resilience covenants. When a covenant is verified as met,
the verified outcome both releases the at-risk portion of the coupon **and**
mints a tradable credit whose sale revenue flows back to the financing
vehicle. Miss a covenant and that coupon tranche is **held**, not lost — it
rolls into the next remediation cycle.

The whole point is that the proof and the payment come from the same sensor
reading. See [`ARCHITECTURE.md`](ARCHITECTURE.md) for the full loop.

## What this project is not

It is **not** a regulated securities offering. Yields, credit rates, and
named vendors are illustrative. Money is recorded as commitments, not moved.
Sensor readings are not cryptographically signed. Read
[`LIMITATIONS.md`](LIMITATIONS.md) before drawing any real-world conclusion
from the numbers.

## Stack at a glance

Node 20+ · Express 4 · better-sqlite3 · JWT (jsonwebtoken) · bcryptjs · zod ·
vanilla single-page frontend. No external services — clone, install, run.
