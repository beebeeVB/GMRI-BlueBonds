import { Router } from 'express';
import { z } from 'zod';
import db from '../lib/db.js';
import { evaluateBond } from '../lib/engine.js';
import { authRequired } from '../lib/auth.js';

const router = Router();

// Ingest a sensor reading (in production: signed device payload from the field).
const readingSchema = z.object({
  sensor_id: z.number().int().positive(),
  value: z.number(),
});

router.post('/readings', authRequired, (req, res) => {
  // verifier or admin only
  if (!['verifier', 'admin', 'issuer'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Only verification partners can submit readings.' });
  }
  const parsed = readingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Provide a sensor_id and numeric value.' });
  const { sensor_id, value } = parsed.data;

  const sensor = db.prepare('SELECT * FROM sensors WHERE id = ?').get(sensor_id);
  if (!sensor) return res.status(404).json({ error: 'Sensor not found.' });

  db.prepare('INSERT INTO readings (sensor_id, value) VALUES (?, ?)').run(sensor_id, value);
  db.prepare("UPDATE sensors SET last_reading = ?, last_seen = datetime('now') WHERE id = ?").run(value, sensor_id);
  res.status(201).json({ ok: true });
});

// Run the verification + coupon engine for a bond and a period.
const runSchema = z.object({
  bond_id: z.number().int().positive(),
  period: z.string().min(2),
});

router.post('/run', authRequired, (req, res) => {
  if (!['verifier', 'admin', 'issuer'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Only verification partners can run settlement.' });
  }
  const parsed = runSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Provide bond_id and period.' });
  try {
    const result = evaluateBond(parsed.data.bond_id, parsed.data.period);
    res.json({ result });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
