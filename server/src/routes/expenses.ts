import { Router } from 'express';
import { db } from '../db.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

const toExpense = (r: any) => ({
  id: r.id, date: r.date, amount: r.amount, category: r.category,
  description: r.description, provider: r.provider, method: r.method, notes: r.notes,
});

router.get('/', (_req, res) => {
  res.json(db.prepare('SELECT * FROM expenses ORDER BY date DESC').all().map(toExpense));
});

router.post('/', (req, res) => {
  const e = req.body;
  db.prepare(
    `INSERT INTO expenses (id,date,amount,category,description,provider,method,notes)
     VALUES (?,?,?,?,?,?,?,?)`
  ).run(e.id, e.date, e.amount, e.category, e.description, e.provider ?? '', e.method, e.notes ?? '');
  res.status(201).json(e);
});

router.put('/:id', (req, res) => {
  const e = req.body;
  db.prepare(
    `UPDATE expenses SET date=?,amount=?,category=?,description=?,provider=?,method=?,notes=? WHERE id=?`
  ).run(e.date, e.amount, e.category, e.description, e.provider ?? '', e.method, e.notes ?? '', req.params.id);
  res.json(e);
});

router.delete('/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM expenses WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
