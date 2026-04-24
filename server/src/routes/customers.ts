import { Router } from 'express';
import { db } from '../db.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

const toCustomer = (r: any) => ({
  id: r.id, name: r.name, phone: r.phone, address: r.address,
  neighborhood: r.neighborhood, email: r.email, balance: r.balance,
  totalPurchases: r.total_purchases, createdAt: r.created_at, notes: r.notes,
});

router.get('/', (_req, res) => {
  res.json(db.prepare('SELECT * FROM customers ORDER BY name').all().map(toCustomer));
});

router.post('/', (req, res) => {
  const c = req.body;
  db.prepare(
    `INSERT INTO customers (id,name,phone,address,neighborhood,email,balance,total_purchases,created_at,notes)
     VALUES (?,?,?,?,?,?,?,?,?,?)`
  ).run(c.id, c.name, c.phone, c.address ?? '', c.neighborhood ?? '', c.email ?? '',
        c.balance ?? 0, c.totalPurchases ?? 0, c.createdAt, c.notes ?? '');
  res.status(201).json(c);
});

router.put('/:id', (req, res) => {
  const c = req.body;
  db.prepare(
    `UPDATE customers SET name=?,phone=?,address=?,neighborhood=?,email=?,
     balance=?,total_purchases=?,notes=? WHERE id=?`
  ).run(c.name, c.phone, c.address ?? '', c.neighborhood ?? '', c.email ?? '',
        c.balance, c.totalPurchases, c.notes ?? '', req.params.id);
  res.json(c);
});

router.delete('/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM customers WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
