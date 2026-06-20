import db from './db.js';

/**
 * The verification engine is the heart of the system.
 *
 * Loop:  marine sensor reading  ->  evaluate covenant metric  ->
 *        if met: mint a sellable credit (blue carbon / water quality /
 *        resilience payment)  ->  credit revenue flows to the SPV  ->
 *        SPV releases the outcome-linked portion of the coupon.
 *
 * The same reading that PROVES the outcome also GENERATES the cash that
 * pays for it. That is what makes the bond self-sustaining.
 */

const cmp = {
  gte: (v, t) => v >= t,
  lte: (v, t) => v <= t,
};

// Latest reading for a given sensor kind on the project behind a bond.
function latestReading(bondId, sensorKind) {
  return db.prepare(`
    SELECT r.value
    FROM readings r
    JOIN sensors s ON s.id = r.sensor_id
    JOIN bonds b   ON b.project_id = s.project_id
    WHERE b.id = ? AND s.kind = ?
    ORDER BY r.recorded_at DESC, r.id DESC
    LIMIT 1
  `).get(bondId, sensorKind);
}

/**
 * Evaluate every metric on a bond, update statuses, mint credits for newly
 * met outcomes, and write a coupon event. Returns a structured result.
 */
export function evaluateBond(bondId, period) {
  const bond = db.prepare('SELECT * FROM bonds WHERE id = ?').get(bondId);
  if (!bond) throw new Error('bond not found');

  const metrics = db.prepare('SELECT * FROM metrics WHERE bond_id = ?').all(bondId);
  if (metrics.length === 0) return { bondId, metrics: [], message: 'no covenant metrics' };

  const principal = bond.raised || 0;
  // half-year accrual on the OUTCOME portion only; base is paid regardless.
  const outcomeCouponHalfYear = (principal * (bond.outcome_coupon_bps / 10000)) / 2;
  const baseCouponHalfYear = (principal * (bond.base_coupon_bps / 10000)) / 2;

  let outcomePaid = 0;
  let outcomeHeld = 0;
  let revenueIn = 0;
  const results = [];

  const updateMetric = db.prepare('UPDATE metrics SET status = ? WHERE id = ?');
  const insertCredit = db.prepare(`
    INSERT INTO credits (bond_id, metric_id, credit_type, quantity, unit_price, revenue)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const txn = db.transaction(() => {
    for (const m of metrics) {
      const reading = latestReading(bondId, m.sensor_kind);
      const value = reading ? reading.value : null;
      const met = value !== null && cmp[m.comparator](value, m.threshold);
      const share = outcomeCouponHalfYear * m.weight;

      if (met) {
        updateMetric.run('met', m.id);
        outcomePaid += share;

        // ---- Self-sustaining revenue: mint a credit from the verified outcome ----
        if (m.credit_type && m.credit_type !== 'none' && m.credit_rate > 0) {
          // Quantity earned scales with how far the outcome beat its threshold,
          // floored at the threshold itself (you always earn on the achieved level).
          const quantity = m.comparator === 'gte'
            ? value                                   // e.g. acres restored, tCO2 sequestered
            : Math.max(0, m.threshold - value + m.threshold); // lte metrics: reward staying under
          const revenue = quantity * m.credit_rate;
          insertCredit.run(bondId, m.id, m.credit_type, quantity, m.credit_rate, revenue);
          revenueIn += revenue;
        }
      } else {
        updateMetric.run('held', m.id);
        outcomeHeld += share;
      }

      results.push({
        metric: m.label,
        sensor_kind: m.sensor_kind,
        value,
        threshold: m.threshold,
        comparator: m.comparator,
        met,
        coupon_share: Number(share.toFixed(2)),
        credit_type: m.credit_type,
      });
    }

    db.prepare(`
      INSERT INTO coupon_events (bond_id, period, base_paid, outcome_paid, outcome_held, revenue_in, note)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      bondId, period,
      Number(baseCouponHalfYear.toFixed(2)),
      Number(outcomePaid.toFixed(2)),
      Number(outcomeHeld.toFixed(2)),
      Number(revenueIn.toFixed(2)),
      outcomeHeld > 0
        ? 'Partial hold: held tranche rolls to remediation cycle'
        : 'All covenants met: full outcome coupon released'
    );
  });
  txn();

  // Coverage ratio: did the minted credit revenue cover what we paid out?
  const totalPaid = baseCouponHalfYear + outcomePaid;
  const coverage = totalPaid > 0 ? revenueIn / totalPaid : 0;

  return {
    bondId,
    series: bond.series,
    period,
    base_paid: Number(baseCouponHalfYear.toFixed(2)),
    outcome_paid: Number(outcomePaid.toFixed(2)),
    outcome_held: Number(outcomeHeld.toFixed(2)),
    revenue_minted: Number(revenueIn.toFixed(2)),
    self_funding_coverage: Number(coverage.toFixed(2)),
    metrics: results,
  };
}

// Live verification snapshot for a bond (no writes) — used by the UI feed.
export function snapshotBond(bondId) {
  const metrics = db.prepare('SELECT * FROM metrics WHERE bond_id = ?').all(bondId);
  return metrics.map((m) => {
    const reading = latestReading(bondId, m.sensor_kind);
    const value = reading ? reading.value : null;
    const met = value !== null && cmp[m.comparator](value, m.threshold);
    return {
      label: m.label,
      sensor_kind: m.sensor_kind,
      value,
      threshold: m.threshold,
      comparator: m.comparator,
      met,
      credit_type: m.credit_type,
      status: value === null ? 'pending' : met ? 'met' : 'held',
    };
  });
}
