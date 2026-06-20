import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'server', 'data');
for (const f of ['tidewater.db', 'tidewater.db-wal', 'tidewater.db-shm']) {
  const p = path.join(dataDir, f);
  if (fs.existsSync(p)) { fs.unlinkSync(p); console.log('removed', f); }
}
console.log('Database reset. Run `npm run seed` to recreate.');
