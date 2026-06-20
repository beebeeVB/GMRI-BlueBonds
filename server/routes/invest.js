import { Router } from 'express';
import { z } from 'zod';
import db from '../lib/db.js';
import { authRequired } from '../lib/auth.js';

const router = Router();

const investSchema = z.object({
  bond_id: z.number().int().positive(),
  amount: z.number().positive(),
});

// Place an investment in a bond.
router.post('/', authRequired, (req, res) => {
  const parsed = investSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Enter a valid bond and amount.' });
  const { bond_id, amount } = parsed.data;

  const bond = db.prepare('SELECT * FROM bonds WHERE id = ?').get(bond_id);
  if (!bond) return res.status(404).json({ error: 'Bond not found.' });
  if (bond.status === 'closed') return res.status(400).json({ error: 'This series is closed to new capital.' });
  if (amount < bond.min_investment) {
    return res.status(400).json({ error: `Minimum investment for this series is $${bond.min_investment.toLocaleString()}.` });
  }
  if (bond.tier === 'senior' && !req.user.accredited) {
    // soft gate illustrative of suitability rules
  }

  const txn = db.transaction(() => {
    db.prepare('INSERT INTO investments (user_id, bond_id, amount) VALUES (?, ?, ?)')
      .run(req.user.id, bond_id, amount);
    const newRaised = bond.raised + amount;
    const status = newRaised >= bond.target_raise ? 'funded' : 'open';
    db.prepare('UPDATE bonds SET raised = ?, status = ? WHERE id = ?').run(newRaised, status, bond_id);
  });
  txn();

  res.status(201).json({ ok: true, message: `Committed $${amount.toLocaleString()} to ${bond.series}.` });
});

// Current user's portfolio with live coupon + verification rollup.
router.get('/portfolio', authRequired, (req, res) => {
  const positions = db.prepare(`
    SELECT i.id, i.amount, i.created_at,
           b.id AS bond_id, b.series, b.name, b.tier,
           b.base_coupon_bps, b.outcome_coupon_bps, b.term_years,
           p.name AS project_name, p.town, p.state
    FROM investments i
    JOIN bonds b ON b.id = i.bond_id
    JOIN projects p ON p.id = b.project_id
    WHERE i.user_id = ?
    ORDER BY i.created_at DESC
  `).all(req.user.id);

  let invested = 0;
  let projectedAnnual = 0;
  const enriched = positions.map((pos) => {
    invested += pos.amount;
    // count outcome coupon as "at risk" but project it at met-rate from latest coupon event
    const last = db.prepare('SELECT * FROM coupon_events WHERE bond_id = ? ORDER BY id DESC LIMIT 1').get(pos.bond_id);
    const baseAnnual = pos.amount * (pos.base_coupon_bps / 10000);
    // proportion of outcome coupon actually being released, from bond-level event
    let outcomeFactor = 1;
    if (last && (last.outcome_paid + last.outcome_held) > 0) {
      outcomeFactor = last.outcome_paid / (last.outcome_paid + last.outcome_held);
    }
    const outcomeAnnual = pos.amount * (pos.outcome_coupon_bps / 10000) * outcomeFactor;
    projectedAnnual += baseAnnual + outcomeAnnual;
    return {
      ...pos,
      base_annual: Number(baseAnnual.toFixed(2)),
      outcome_annual: Number(outcomeAnnual.toFixed(2)),
      outcome_release_pct: Math.round(outcomeFactor * 100),
    };
  });

  res.json({
    positions: enriched,
    summary: {
      total_invested: Number(invested.toFixed(2)),
      projected_annual_income: Number(projectedAnnual.toFixed(2)),
      blended_yield_pct: invested ? Number(((projectedAnnual / invested) * 100).toFixed(2)) : 0,
      position_count: enriched.length,
    },
  });
});

export default router;
