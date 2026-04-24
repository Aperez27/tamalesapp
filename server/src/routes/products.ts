import { Router } from 'express';
import { db } from '../db.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

const toProduct = (r: any) => ({ ...r, active: r.active === 1 });

router.get('/', (_req, res) => {
  const rows = db.prepare('SELECT * FROM products ORDER BY category, name').all();
  res.json(rows.map(toProduct));
});

router.post('/', (req, res) => {
  const p = req.body;
  db.prepare(
    `INSERT INTO products (id,name,category,price,cost,description,active,emoji)
     VALUES (?,?,?,?,?,?,?,?)`
  ).run(p.id, p.name, p.category, p.price, p.cost, p.description ?? '', p.active ? 1 : 0, p.emoji ?? '🌽');
  res.status(201).json(p);
});

router.put('/:id', (req, res) => {
  const p = req.body;
  db.prepare(
    `UPDATE products SET name=?,category=?,price=?,cost=?,description=?,active=?,emoji=? WHERE id=?`
  ).run(p.name, p.category, p.price, p.cost, p.description ?? '', p.active ? 1 : 0, p.emoji ?? '🌽', req.params.id);
  res.json(p);
});

router.delete('/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM products WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
