import db from '../server/lib/db.js';
import { evaluateBond } from '../server/lib/engine.js';

// Feeds realistic sensor readings, then runs the verification + coupon engine.
// One bond is deliberately made to MISS a flood-day guardrail so you can see a HOLD.

function addReading(sensorId, value) {
  db.prepare('INSERT INTO readings (sensor_id, value) VALUES (?, ?)').run(sensorId, value);
  db.prepare("UPDATE sensors SET last_reading = ?, last_seen = datetime('now') WHERE id = ?").run(value, sensorId);
}
function sensorId(projectSlug, kind) {
  return db.prepare(`
    SELECT s.id FROM sensors s JOIN projects p ON p.id = s.project_id
    WHERE p.slug = ? AND s.kind = ?`).get(projectSlug, kind)?.id;
}
function bondId(series) {
  return db.prepare('SELECT id FROM bonds WHERE series = ?').get(series)?.id;
}

// also give bonds some raised capital so coupon math is non-zero
db.prepare("UPDATE bonds SET raised = target_raise * 0.62, status='open' WHERE series='TWBB-2034-PLUM'").run();
db.prepare("UPDATE bonds SET raised = target_raise * 0.78, status='open' WHERE series='TWBB-2033-NARR'").run();
db.prepare("UPDATE bonds SET raised = target_raise * 0.45, status='open' WHERE series='TWBB-2031-CASCO'").run();

// --- Plum Island: all good EXCEPT a nor'easter pushes flood-days over guardrail ---
addReading(sensorId('plum-island','multispectral_sat'), 41);   // >= 38  ✓
addReading(sensorId('plum-island','carbon_flux'), 1020);       // >= 900 ✓
addReading(sensorId('plum-island','tide_gauge'), 9);           // <= 6   ✗  (storm) -> HOLD

// --- Narragansett: everything meets target ---
addReading(sensorId('narragansett-reef','edna'), 78);          // >= 70  ✓
addReading(sensorId('narragansett-reef','wq_nitrogen'), 1340); // >= 1200 ✓
addReading(sensorId('narragansett-reef','tide_gauge'), 5);     // <= 8   ✓

// --- Casco Bay: meets both ---
addReading(sensorId('casco-bay','tide_gauge'), 4);             // <= 5   ✓
addReading(sensorId('casco-bay','drone_lidar'), 11);           // >= 9   ✓

console.log('\nReadings ingested. Running settlement for period 2026-H1...\n');

for (const series of ['TWBB-2034-PLUM','TWBB-2033-NARR','TWBB-2031-CASCO']) {
  const r = evaluateBond(bondId(series), '2026-H1');
  console.log(`── ${series} ──`);
  console.log(`   base paid:        $${r.base_paid.toLocaleString()}`);
  console.log(`   outcome released: $${r.outcome_paid.toLocaleString()}`);
  console.log(`   outcome held:     $${r.outcome_held.toLocaleString()}`);
  console.log(`   credit revenue:   $${r.revenue_minted.toLocaleString()}  (self-funding coverage ${r.self_funding_coverage}x)`);
  for (const m of r.metrics) {
    console.log(`     ${m.met ? '✓' : '⊘'} ${m.metric}  [read ${m.value}]`);
  }
  console.log('');
}
console.log('Done. Start the app with `npm start` and open the bond pages.');
