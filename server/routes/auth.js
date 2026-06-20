import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import db from '../lib/db.js';
import { signToken, authRequired } from '../lib/auth.js';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Use at least 8 characters.'),
  full_name: z.string().min(2),
  state: z.enum(['ME', 'NH', 'MA', 'RI', 'CT', 'VT']).optional(),
  accredited: z.boolean().optional(),
});

router.post('/register', (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { email, password, full_name, state, accredited } = parsed.data;

  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (exists) return res.status(409).json({ error: 'That email is already registered.' });

  const password_hash = bcrypt.hashSync(password, 10);
  const info = db.prepare(`
    INSERT INTO users (email, password_hash, full_name, state, accredited)
    VALUES (?, ?, ?, ?, ?)
  `).run(email, password_hash, full_name, state || null, accredited ? 1 : 0);

  const user = db.prepare('SELECT id, email, full_name, state, accredited, role FROM users WHERE id = ?')
    .get(info.lastInsertRowid);
  res.status(201).json({ token: signToken(user), user });
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

router.post('/login', (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Enter a valid email and password.' });
  const { email, password } = parsed.data;

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Email or password is incorrect.' });
  }
  const safe = { id: user.id, email: user.email, full_name: user.full_name, state: user.state, accredited: user.accredited, role: user.role };
  res.json({ token: signToken(safe), user: safe });
});

router.get('/me', authRequired, (req, res) => {
  const user = db.prepare('SELECT id, email, full_name, state, accredited, role, created_at FROM users WHERE id = ?')
    .get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Account not found.' });
  res.json({ user });
});

export default router;
