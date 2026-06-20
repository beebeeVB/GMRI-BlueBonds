import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

import authRoutes from './routes/auth.js';
import bondRoutes from './routes/bonds.js';
import investRoutes from './routes/invest.js';
import verifyRoutes from './routes/verify.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 50 });
app.use('/api/auth', authLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/bonds', bondRoutes);
app.use('/api/invest', investRoutes);
app.use('/api/verify', verifyRoutes);

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'tidewater', time: new Date().toISOString() }));

// Serve the static frontend.
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));

app.listen(PORT, () => {
  console.log(`\n  Tidewater running → http://localhost:${PORT}\n`);
});
