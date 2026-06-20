import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'tidewater.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name     TEXT NOT NULL,
  state         TEXT,                         -- ME, NH, MA, RI, CT, VT
  accredited    INTEGER DEFAULT 0,
  role          TEXT DEFAULT 'investor',      -- investor | issuer | verifier | admin
  created_at    TEXT DEFAULT (datetime('now'))
);

-- A coastal resilience project. Funded by a bond; produces verified outcomes.
CREATE TABLE IF NOT EXISTS projects (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  slug          TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  town          TEXT NOT NULL,
  state         TEXT NOT NULL,
  lat           REAL,
  lng           REAL,
  type          TEXT NOT NULL,                -- marsh | reef | living_shoreline | hybrid | seagrass
  description   TEXT,
  created_at    TEXT DEFAULT (datetime('now'))
);

-- The tradable bond instrument. Tied 1:1 to a project (or a project pool).
CREATE TABLE IF NOT EXISTS bonds (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id      INTEGER NOT NULL REFERENCES projects(id),
  series          TEXT UNIQUE NOT NULL,       -- e.g. "TWBB-2034-PLUM"
  name            TEXT NOT NULL,
  tier            TEXT NOT NULL,              -- community | resilience | senior
  target_raise    REAL NOT NULL,              -- USD
  raised          REAL DEFAULT 0,
  base_coupon_bps INTEGER NOT NULL,           -- guaranteed floor, in basis points
  outcome_coupon_bps INTEGER NOT NULL,        -- at-risk portion tied to verification
  term_years      INTEGER NOT NULL,
  min_investment  REAL NOT NULL,
  status          TEXT DEFAULT 'open',        -- open | funded | closed
  maturity        TEXT,
  created_at      TEXT DEFAULT (datetime('now'))
);

-- Marine-tech devices attached to a project. These are the verification "oracles".
CREATE TABLE IF NOT EXISTS sensors (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id  INTEGER NOT NULL REFERENCES projects(id),
  kind        TEXT NOT NULL,                  -- tide_gauge | multispectral_sat | drone_lidar | edna | carbon_flux | wq_nitrogen
  vendor      TEXT,                           -- e.g. Sofar Ocean, Planet Labs, Hohonu
  unit        TEXT NOT NULL,                  -- e.g. flood_days, acres, pct_survival, tCO2, kg_N
  last_reading REAL,
  last_seen   TEXT
);

-- Time-series readings from sensors (the raw evidence).
CREATE TABLE IF NOT EXISTS readings (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  sensor_id   INTEGER NOT NULL REFERENCES sensors(id),
  value       REAL NOT NULL,
  recorded_at TEXT DEFAULT (datetime('now'))
);

-- The covenant: what a bond's outcome-coupon is tied to, with thresholds.
CREATE TABLE IF NOT EXISTS metrics (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  bond_id       INTEGER NOT NULL REFERENCES bonds(id),
  sensor_kind   TEXT NOT NULL,                -- which sensor type verifies this
  label         TEXT NOT NULL,                -- e.g. "Marsh acreage >= 38ac"
  comparator    TEXT NOT NULL,                -- gte | lte
  threshold     REAL NOT NULL,
  weight        REAL NOT NULL,                -- share of outcome-coupon (sums to 1.0 per bond)
  -- revenue link: meeting this outcome mints a sellable credit
  credit_type   TEXT,                         -- blue_carbon | water_quality | resilience_payment | none
  credit_rate   REAL DEFAULT 0,               -- USD per unit of the credit
  status        TEXT DEFAULT 'pending'        -- met | held | pending
);

-- Investor positions in a bond.
CREATE TABLE IF NOT EXISTS investments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  bond_id     INTEGER NOT NULL REFERENCES bonds(id),
  amount      REAL NOT NULL,
  created_at  TEXT DEFAULT (datetime('now'))
);

-- Credits minted when a verified outcome is met (the self-sustaining revenue).
CREATE TABLE IF NOT EXISTS credits (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  bond_id     INTEGER NOT NULL REFERENCES bonds(id),
  metric_id   INTEGER NOT NULL REFERENCES metrics(id),
  credit_type TEXT NOT NULL,
  quantity    REAL NOT NULL,
  unit_price  REAL NOT NULL,
  revenue     REAL NOT NULL,                  -- quantity * unit_price -> SPV
  minted_at   TEXT DEFAULT (datetime('now'))
);

-- Coupon release / hold events (the ledger investors watch).
CREATE TABLE IF NOT EXISTS coupon_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  bond_id     INTEGER NOT NULL REFERENCES bonds(id),
  period      TEXT NOT NULL,                  -- e.g. "2026-H1"
  base_paid   REAL DEFAULT 0,
  outcome_paid REAL DEFAULT 0,
  outcome_held REAL DEFAULT 0,
  revenue_in  REAL DEFAULT 0,                 -- credit revenue that funded the coupon
  note        TEXT,
  created_at  TEXT DEFAULT (datetime('now'))
);
`);

export default db;
