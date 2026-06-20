import db from '../server/lib/db.js';
import bcrypt from 'bcryptjs';

console.log('Seeding Tidewater database...');

const wipe = db.transaction(() => {
  for (const t of ['coupon_events','credits','investments','readings','metrics','sensors','bonds','projects']) {
    db.prepare(`DELETE FROM ${t}`).run();
  }
});
wipe();

// --- demo verifier account (submits readings / runs settlement) ---
const vpass = bcrypt.hashSync('verifier123', 10);
db.prepare(`INSERT OR IGNORE INTO users (email, password_hash, full_name, role, accredited)
            VALUES (?, ?, ?, 'verifier', 1)`)
  .run('verifier@woodshole.demo', vpass, 'Woods Hole Coastal Lab');

// --- projects ---
const projects = [
  { slug:'plum-island', name:'Plum Island Estuary Restoration', town:'Newbury', state:'MA', lat:42.742, lng:-70.818,
    type:'marsh', description:'Reconnecting tidal flow to 41 acres of degraded salt marsh by replacing undersized culverts, restoring drainage and sequestering blue carbon.' },
  { slug:'narragansett-reef', name:'Narragansett Oyster Reef Belt', town:'Wickford', state:'RI', lat:41.571, lng:-71.445,
    type:'reef', description:'Seeding a 12-acre oyster reef belt that buffers wave energy and filters nitrogen from the bay, generating tradable water-quality credits.' },
  { slug:'casco-bay', name:'Casco Bay Living Shoreline', town:'Portland', state:'ME', lat:43.657, lng:-70.255,
    type:'living_shoreline', description:'A marsh-and-dune living shoreline replacing a failing bulkhead, reducing flood-days for the adjacent neighborhood.' },
];
const insProject = db.prepare(`INSERT INTO projects (slug,name,town,state,lat,lng,type,description) VALUES (@slug,@name,@town,@state,@lat,@lng,@type,@description)`);
const projectIds = {};
for (const p of projects) projectIds[p.slug] = insProject.run(p).lastInsertRowid;

// --- bonds (one flagship resilience bond per project) ---
const insBond = db.prepare(`INSERT INTO bonds
  (project_id,series,name,tier,target_raise,base_coupon_bps,outcome_coupon_bps,term_years,min_investment,maturity)
  VALUES (@project_id,@series,@name,@tier,@target_raise,@base_coupon_bps,@outcome_coupon_bps,@term_years,@min_investment,@maturity)`);

const bonds = [
  { project_id:projectIds['plum-island'], series:'TWBB-2034-PLUM', name:'Plum Island Resilience Bond', tier:'resilience',
    target_raise:31_500_000, base_coupon_bps:220, outcome_coupon_bps:190, term_years:10, min_investment:1000, maturity:'2034-06-01' },
  { project_id:projectIds['narragansett-reef'], series:'TWBB-2033-NARR', name:'Narragansett Reef Resilience Bond', tier:'resilience',
    target_raise:19_200_000, base_coupon_bps:230, outcome_coupon_bps:180, term_years:9, min_investment:1000, maturity:'2033-06-01' },
  { project_id:projectIds['casco-bay'], series:'TWBB-2031-CASCO', name:'Casco Bay Community Note', tier:'community',
    target_raise:24_000_000, base_coupon_bps:200, outcome_coupon_bps:120, term_years:5, min_investment:1000, maturity:'2031-06-01' },
];
const bondIds = {};
for (const b of bonds) bondIds[b.series] = insBond.run(b).lastInsertRowid;

// --- sensors (the marine-tech oracles) ---
const insSensor = db.prepare(`INSERT INTO sensors (project_id,kind,vendor,unit) VALUES (?,?,?,?)`);
const sensorMap = {}; // key: `${slug}:${kind}` -> id
function addSensor(slug, kind, vendor, unit) {
  sensorMap[`${slug}:${kind}`] = insSensor.run(projectIds[slug], kind, vendor, unit).lastInsertRowid;
}
addSensor('plum-island','multispectral_sat','Planet Labs','acres');
addSensor('plum-island','carbon_flux','EddyPro Tower','tCO2');
addSensor('plum-island','tide_gauge','Hohonu','flood_days');
addSensor('narragansett-reef','edna','Smith-Root eDNA','pct_survival');
addSensor('narragansett-reef','wq_nitrogen','YSI EXO Sonde','kg_N');
addSensor('narragansett-reef','tide_gauge','Sofar Ocean','flood_days');
addSensor('casco-bay','tide_gauge','Sofar Ocean','flood_days');
addSensor('casco-bay','drone_lidar','Wingtra','acres');

// --- covenant metrics with credit linkages (self-sustaining revenue config) ---
// credit_rate is illustrative USD per unit; weights per bond sum to 1.0
const insMetric = db.prepare(`INSERT INTO metrics
  (bond_id,sensor_kind,label,comparator,threshold,weight,credit_type,credit_rate)
  VALUES (?,?,?,?,?,?,?,?)`);

// Plum Island: carbon + acreage mint revenue; flood-days is a guardrail (no credit)
insMetric.run(bondIds['TWBB-2034-PLUM'],'multispectral_sat','Marsh acreage restored ≥ 38 ac','gte',38,0.4,'resilience_payment',9000);
insMetric.run(bondIds['TWBB-2034-PLUM'],'carbon_flux','Blue carbon sequestered ≥ 900 tCO₂','gte',900,0.4,'blue_carbon',42);
insMetric.run(bondIds['TWBB-2034-PLUM'],'tide_gauge','Neighborhood flood-days ≤ 6','lte',6,0.2,'none',0);

// Narragansett: water-quality + reef survival mint revenue
insMetric.run(bondIds['TWBB-2033-NARR'],'edna','Oyster reef survival ≥ 70%','gte',70,0.4,'water_quality',55);
insMetric.run(bondIds['TWBB-2033-NARR'],'wq_nitrogen','Nitrogen removed ≥ 1200 kg','gte',1200,0.4,'water_quality',55);
insMetric.run(bondIds['TWBB-2033-NARR'],'tide_gauge','Shoreline flood-days ≤ 8','lte',8,0.2,'none',0);

// Casco Bay community note: simpler, flood-day driven + acreage credit
insMetric.run(bondIds['TWBB-2031-CASCO'],'tide_gauge','Flood-days ≤ 5','lte',5,0.6,'resilience_payment',12000);
insMetric.run(bondIds['TWBB-2031-CASCO'],'drone_lidar','Shoreline buffer ≥ 9 ac','gte',9,0.4,'blue_carbon',42);

console.log('Seeded:', Object.keys(projectIds).length, 'projects,', Object.keys(bondIds).length, 'bonds,', Object.keys(sensorMap).length, 'sensors.');
console.log('Demo verifier login → verifier@woodshole.demo / verifier123');
console.log('Run `npm run simulate` to feed sensor data and settle coupons.');
