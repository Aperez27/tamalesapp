import { Router } from 'express';
import { db } from '../db.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

const toSupplier = (r: any) => ({
  id: r.id, name: r.name, category: r.category,
  contact: r.contact, phone: r.phone, email: r.email,
  address: r.address, nit: r.nit, notes: r.notes,
  createdAt: r.created_at, totalPurchases: r.total_purchases,
});

router.get('/', (_req, res) => {
  res.json(db.prepare('SELECT * FROM suppliers ORDER BY name').all().map(toSupplier));
});

router.post('/', requireAdmin, (req, res) => {
  const s = req.body;
  db.prepare(
    `INSERT INTO suppliers (id,name,category,contact,phone,email,address,nit,notes,created_at,total_purchases)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`
  ).run(s.id, s.name, s.category, s.contact ?? '', s.phone ?? '',
        s.email ?? '', s.address ?? '', s.nit ?? '', s.notes ?? '',
        s.createdAt, s.totalPurchases ?? 0);
  res.status(201).json(s);
});

router.put('/:id', requireAdmin, (req, res) => {
  const s = req.body;
  db.prepare(
    `UPDATE suppliers SET name=?,category=?,contact=?,phone=?,email=?,address=?,nit=?,notes=?,total_purchases=? WHERE id=?`
  ).run(s.name, s.category, s.contact ?? '', s.phone ?? '',
        s.email ?? '', s.address ?? '', s.nit ?? '', s.notes ?? '',
        s.totalPurchases ?? 0, req.params.id);
  res.json(s);
});

router.delete('/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM suppliers WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
