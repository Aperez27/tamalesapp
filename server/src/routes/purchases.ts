import { Router } from 'express';
import { db } from '../db.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

const toPurchase = (r: any) => ({
  id: r.id, supplierId: r.supplier_id, supplierName: r.supplier_name,
  invoiceNumber: r.invoice_number, items: JSON.parse(r.items),
  subtotal: r.subtotal, total: r.total, amountPaid: r.amount_paid,
  balance: r.balance, status: r.status, paymentMethod: r.payment_method,
  date: r.date, dueDate: r.due_date || undefined, notes: r.notes,
});

router.get('/', (_req, res) => {
  res.json(db.prepare('SELECT * FROM purchases ORDER BY date DESC').all().map(toPurchase));
});

router.post('/', (req, res) => {
  const p = req.body;
  db.prepare(
    `INSERT INTO purchases (id,supplier_id,supplier_name,invoice_number,items,subtotal,total,amount_paid,balance,status,payment_method,date,due_date,notes)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(p.id, p.supplierId, p.supplierName, p.invoiceNumber ?? '',
        JSON.stringify(p.items), p.subtotal, p.total, p.amountPaid ?? 0,
        p.balance ?? p.total, p.status ?? 'pendiente', p.paymentMethod ?? 'efectivo',
        p.date, p.dueDate ?? '', p.notes ?? '');

  // Actualizar total_purchases del proveedor
  db.prepare(`UPDATE suppliers SET total_purchases = total_purchases + ? WHERE id = ?`)
    .run(p.total, p.supplierId);

  res.status(201).json(p);
});

router.put('/:id', (req, res) => {
  const p = req.body;
  db.prepare(
    `UPDATE purchases SET amount_paid=?,balance=?,status=?,payment_method=?,notes=? WHERE id=?`
  ).run(p.amountPaid, p.balance, p.status, p.paymentMethod, p.notes ?? '', req.params.id);
  res.json(p);
});

router.delete('/:id', requireAdmin, (req, res) => {
  const purchase = db.prepare('SELECT supplier_id, total FROM purchases WHERE id=?').get(req.params.id) as any;
  if (purchase) {
    db.prepare(`UPDATE suppliers SET total_purchases = MAX(0, total_purchases - ?) WHERE id = ?`)
      .run(purchase.total, purchase.supplier_id);
  }
  db.prepare('DELETE FROM purchases WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
