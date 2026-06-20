import { Router } from 'express';
import db from '../lib/db.js';
import { snapshotBond } from '../lib/engine.js';

const router = Router();

// List all bonds with project + funding progress + live verification status.
router.get('/', (_req, res) => {
  const bonds = db.prepare(`
    SELECT b.*, p.name AS project_name, p.town, p.state, p.type, p.lat, p.lng, p.slug AS project_slug
    FROM bonds b JOIN projects p ON p.id = b.project_id
    ORDER BY b.id
  `).all();

  const enriched = bonds.map((b) => {
    const snap = snapshotBond(b.id);
    const met = snap.filter((m) => m.met).length;
    return {
      ...b,
      pct_funded: b.target_raise ? Math.min(100, Math.round((b.raised / b.target_raise) * 100)) : 0,
      total_coupon_bps: b.base_coupon_bps + b.outcome_coupon_bps,
      metrics_met: met,
      metrics_total: snap.length,
    };
  });
  res.json({ bonds: enriched });
});

// Single bond detail: covenant metrics, sensors, credits, coupon history.
router.get('/:id', (req, res) => {
  const bond = db.prepare(`
    SELECT b.*, p.name AS project_name, p.town, p.state, p.type, p.description, p.lat, p.lng
    FROM bonds b JOIN projects p ON p.id = b.project_id
    WHERE b.id = ?
  `).get(req.params.id);
  if (!bond) return res.status(404).json({ error: 'Bond not found.' });

  const sensors = db.prepare('SELECT id, kind, vendor, unit, last_reading, last_seen FROM sensors WHERE project_id = ?')
    .all(bond.project_id);
  const verification = snapshotBond(bond.id);
  const credits = db.prepare('SELECT * FROM credits WHERE bond_id = ? ORDER BY minted_at DESC LIMIT 50').all(bond.id);
  const coupons = db.prepare('SELECT * FROM coupon_events WHERE bond_id = ? ORDER BY id DESC LIMIT 20').all(bond.id);
  const revenueTotal = db.prepare('SELECT COALESCE(SUM(revenue),0) AS r FROM credits WHERE bond_id = ?').get(bond.id).r;

  res.json({
    bond: { ...bond, total_coupon_bps: bond.base_coupon_bps + bond.outcome_coupon_bps,
            pct_funded: bond.target_raise ? Math.min(100, Math.round((bond.raised / bond.target_raise) * 100)) : 0 },
    sensors,
    verification,
    credits,
    coupons,
    revenue_total: Number(revenueTotal.toFixed(2)),
  });
});

// Recent sensor readings for a project (the live feed).
router.get('/:id/readings', (req, res) => {
  const bond = db.prepare('SELECT project_id FROM bonds WHERE id = ?').get(req.params.id);
  if (!bond) return res.status(404).json({ error: 'Bond not found.' });
  const rows = db.prepare(`
    SELECT s.kind, s.vendor, s.unit, r.value, r.recorded_at
    FROM readings r JOIN sensors s ON s.id = r.sensor_id
    WHERE s.project_id = ?
    ORDER BY r.recorded_at DESC, r.id DESC
    LIMIT 40
  `).all(bond.project_id);
  res.json({ readings: rows });
});

export default router;
