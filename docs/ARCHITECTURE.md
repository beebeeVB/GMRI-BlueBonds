# Tidewater — How the Blue Bond Works

This document explains the mechanism: how investor capital reaches coastal
projects, how marine technology verifies outcomes, and how those verified
outcomes generate the revenue that repays the bond. The goal is a
**self-sustaining instrument** where the coast's performance pays the investor.

---

## 1. The core idea

Most "green" and "blue" bonds are *use-of-proceeds* bonds: raise money, spend it
on something environmental, pay a fixed coupon, and report on it later. Nobody
checks whether the environment actually improved. That is the trust gap.

Tidewater bonds are **outcome-linked**. A portion of every coupon is tied to
measured resilience outcomes, verified by marine sensors in the field. The same
sensor reading that *proves* the outcome also *mints a tradable credit*, and the
revenue from selling that credit is what funds the coupon.

```
   marine sensor reading
          │
          ▼
   covenant threshold check  ──►  MET ──►  mint credit (carbon / water-quality / resilience)
          │                                      │
          ▼                                      ▼
        MISSED                            credit sold → revenue → SPV
          │                                      │
          ▼                                      ▼
   coupon tranche HELD                   outcome coupon RELEASED
   (rolls to remediation)               (paid to investors)
```

The loop closes on itself: **tech → verified outcome → minted credit → revenue → coupon.**

---

## 2. The three loops

### Capital loop — where money flows
1. Investors register and commit capital across three tiers (Community Note,
   Resilience Bond, Institutional Senior).
2. Capital is held by a **ring-fenced SPV** (in production: a municipal conduit
   or state green-bank entity), not by the platform.
3. The SPV disburses to project contractors **against milestones** — site prep,
   construction, year-1 establishment — never as a single lump sum.

### Project loop — what gets funded and why it is bankable
A salt marsh does not bill anyone, so what services the debt? **Revenue
stacking.** Each project layers several real cash flows:

| Revenue source        | Mechanism                                                | In the demo as     |
|-----------------------|----------------------------------------------------------|--------------------|
| Blue carbon credits   | Restored marsh/seagrass sequesters carbon (measured tCO₂)| `blue_carbon`      |
| Water-quality credits | Oyster reefs remove nitrogen (measured kg N)             | `water_quality`    |
| Resilience payments   | Municipalities / insurers pay for measured flood-day and acreage gains | `resilience_payment` |

These credits are the **self-sustaining revenue**. They are only minted when a
covenant is verified as met, so revenue and outcomes move together.

### Verification loop — the marine tech (the oracle)
Each project is instrumented. The sensor type is what makes a given covenant
checkable:

| Sensor (`kind`)        | Example vendor   | Measures                  | Verifies                         |
|------------------------|------------------|---------------------------|----------------------------------|
| `tide_gauge`           | Sofar, Hohonu    | water level / flood-days  | flood-day guardrails             |
| `multispectral_sat`    | Planet Labs      | marsh acreage, NDVI       | acreage restored                 |
| `drone_lidar`          | Wingtra          | shoreline elevation/area  | buffer width, dune volume        |
| `edna`                 | Smith-Root       | species presence          | oyster/reef survival             |
| `carbon_flux`          | EddyPro tower    | CO₂ flux                  | blue-carbon sequestration        |
| `wq_nitrogen`          | YSI EXO sonde    | dissolved nitrogen        | nutrient removal                 |

Readings stream into the **verification engine** (`server/lib/engine.js`), which
compares each reading to the bond's covenant thresholds and decides release vs.
hold per tranche.

---

## 3. The coupon math

For each settlement period (e.g. a half-year):

```
base_coupon      = principal × base_bps/10000      (paid regardless — the floor)
outcome_coupon   = principal × outcome_bps/10000    (split across covenant metrics by weight)

for each metric:
    if reading meets threshold:
        release  outcome_coupon × metric.weight
        if metric has a credit_type:
            mint credit = achieved_quantity × credit_rate   → revenue to SPV
    else:
        hold     outcome_coupon × metric.weight             → rolls to remediation
```

A **held** tranche is not lost. It rolls into the next remediation cycle, so
capital keeps working on the outcome instead of paying out for a miss.

The engine also reports a **self-funding coverage ratio** = minted credit
revenue ÷ total coupon paid. Above 1.0x means the verified outcomes generated
more revenue than the coupon cost — the bond is paying for itself.

---

## 4. Why an investor can trust it

- They watch the **same public sensor feed** the coupon mechanism watches.
- The at-risk portion of their yield literally tracks coast performance — in the
  demo, a held flood-day covenant drops a 4.10% bond to a 3.72% realized yield.
- Verification is run by **independent partners** (the `verifier` role), not the
  issuer. Readings are append-only.
- A **guaranteed base coupon** protects downside while the outcome portion
  rewards real resilience.

---

## 5. Where this demo simplifies (for a real launch)

This is a working reference implementation, not a regulated offering. For a real
launch you would add:

- **Custody & settlement**: real SPV, KYC/AML, broker-dealer or Reg A+/muni
  conduit, suitability gating, and actual fund movement (the demo records
  commitments only).
- **Signed device data**: cryptographically signed sensor payloads + an
  independent oracle/attestation layer so readings cannot be forged.
- **Credit registries**: integration with carbon (e.g. Verra) and
  state nutrient/water-quality registries for real credit issuance and sale.
- **Legal disclosures**: official statements per series, audited impact reports
  (TCFD-aligned), and securities counsel. *Nothing here is an offer to sell
  securities.*
