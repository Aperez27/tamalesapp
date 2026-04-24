import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db.js';
import { JWT_SECRET, requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

type DbUser = { id: number; username: string; password_hash: string; role: string };

function makeToken(user: DbUser) {
  return jwt.sign({ userId: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '12h' });
}

// ─── Login ────────────────────────────────────────────────────────────────────
router.post('/login', (req, res) => {
  const { username, password } = req.body as { username: string; password: string };
  if (!username || !password) { res.status(400).json({ error: 'Campos requeridos' }); return; }

  const user = db.prepare('SELECT * FROM users WHERE LOWER(username) = LOWER(?)').get(username) as DbUser | undefined;
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    return;
  }

  res.json({ token: makeToken(user), username: user.username, role: user.role });
});

// ─── Change own password ───────────────────────────────────────────────────────
router.post('/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };
  const userId = (req as any).user.userId as number;

  if (!currentPassword || !newPassword || newPassword.length < 6) {
    res.status(400).json({ error: 'Datos inválidos' }); return;
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as DbUser | undefined;
  if (!user || !bcrypt.compareSync(currentPassword, user.password_hash)) {
    res.status(401).json({ error: 'Contraseña actual incorrecta' }); return;
  }

  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(newPassword, 10), userId);
  res.json({ ok: true });
});

// ─── Change own username ───────────────────────────────────────────────────────
router.post('/change-username', requireAuth, (req, res) => {
  const { newUsername } = req.body as { newUsername: string };
  const userId = (req as any).user.userId as number;
  if (!newUsername?.trim()) { res.status(400).json({ error: 'Nombre requerido' }); return; }

  const exists = db.prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?) AND id != ?').get(newUsername.trim(), userId);
  if (exists) { res.status(409).json({ error: 'Ese nombre ya está en uso' }); return; }

  db.prepare('UPDATE users SET username = ? WHERE id = ?').run(newUsername.trim(), userId);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as DbUser;
  res.json({ token: makeToken(user), username: user.username, role: user.role });
});

// ─── List users (admin) ────────────────────────────────────────────────────────
router.get('/users', requireAuth, requireAdmin, (_req, res) => {
  const users = db.prepare('SELECT id, username, role FROM users ORDER BY id').all();
  res.json(users);
});

// ─── Create user (admin) ───────────────────────────────────────────────────────
router.post('/users', requireAuth, requireAdmin, (req, res) => {
  const { username, password, role } = req.body as { username: string; password: string; role: string };
  const validRoles = ['admin', 'cajero', 'repartidor', 'contador'];

  if (!username?.trim() || !password || password.length < 6) {
    res.status(400).json({ error: 'Usuario y contraseña (mín. 6 caracteres) requeridos' }); return;
  }
  if (!validRoles.includes(role)) {
    res.status(400).json({ error: 'Rol inválido' }); return;
  }

  const exists = db.prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?)').get(username.trim());
  if (exists) { res.status(409).json({ error: 'Ese nombre de usuario ya existe' }); return; }

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run(username.trim(), hash, role) as any;
  res.status(201).json({ id: result.lastInsertRowid, username: username.trim(), role });
});

// ─── Update user (admin) ───────────────────────────────────────────────────────
router.put('/users/:id', requireAuth, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const { username, role } = req.body as { username: string; role: string };
  const validRoles = ['admin', 'cajero', 'repartidor', 'contador'];

  if (!username?.trim()) { res.status(400).json({ error: 'Nombre requerido' }); return; }
  if (!validRoles.includes(role)) { res.status(400).json({ error: 'Rol inválido' }); return; }

  const exists = db.prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?) AND id != ?').get(username.trim(), id);
  if (exists) { res.status(409).json({ error: 'Ese nombre ya está en uso' }); return; }

  db.prepare('UPDATE users SET username = ?, role = ? WHERE id = ?').run(username.trim(), role, id);
  res.json({ id, username: username.trim(), role });
});

// ─── Reset user password (admin) ──────────────────────────────────────────────
router.post('/users/:id/reset-password', requireAuth, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const { password } = req.body as { password: string };

  if (!password || password.length < 6) {
    res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' }); return;
  }

  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(password, 10), id);
  res.json({ ok: true });
});

// ─── Delete user (admin) ───────────────────────────────────────────────────────
router.delete('/users/:id', requireAuth, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const selfId = (req as any).user.userId as number;

  if (id === selfId) {
    res.status(400).json({ error: 'No puedes eliminar tu propia cuenta' }); return;
  }

  const adminCount = db.prepare("SELECT COUNT(*) as n FROM users WHERE role = 'admin'").get() as { n: number };
  const target = db.prepare('SELECT role FROM users WHERE id = ?').get(id) as { role: string } | undefined;
  if (target?.role === 'admin' && adminCount.n <= 1) {
    res.status(400).json({ error: 'Debe existir al menos un administrador' }); return;
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.json({ ok: true });
});

export default router;
