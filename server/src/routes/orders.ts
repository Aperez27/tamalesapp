import { Router } from 'express';
import { db } from '../db.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

const toOrder = (r: any) => ({
  id: r.id, customerId: r.customer_id, customerName: r.customer_name,
  items: JSON.parse(r.items), total: r.total, discount: r.discount,
  finalTotal: r.final_total, status: r.status, paymentStatus: r.payment_status,
  paymentMethod: r.payment_method, amountPaid: r.amount_paid, balance: r.balance,
  createdAt: r.created_at, updatedAt: r.updated_at,
  isDelivery: r.is_delivery === 1, deliveryAddress: r.delivery_address,
  deliveryDate: r.delivery_date, notes: r.notes,
});

router.get('/', (_req, res) => {
  const rows = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
  res.json(rows.map(toOrder));
});

router.post('/', (req, res) => {
  const o = req.body;
  db.prepare(
    `INSERT INTO orders (id,customer_id,customer_name,items,total,discount,final_total,
     status,payment_status,payment_method,amount_paid,balance,created_at,updated_at,
     is_delivery,delivery_address,delivery_date,notes)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    o.id, o.customerId, o.customerName, JSON.stringify(o.items),
    o.total, o.discount ?? 0, o.finalTotal, o.status, o.paymentStatus,
    o.paymentMethod, o.amountPaid ?? 0, o.balance ?? 0,
    o.createdAt, o.updatedAt, o.isDelivery ? 1 : 0,
    o.deliveryAddress ?? '', o.deliveryDate ?? '', o.notes ?? ''
  );

  // Actualizar totales del cliente
  if (o.customerId && o.customerId !== 'walk-in') {
    db.prepare(
      `UPDATE customers SET
         total_purchases = total_purchases + ?,
         balance = balance - ?
       WHERE id = ?`
    ).run(o.finalTotal, o.finalTotal - (o.amountPaid ?? 0), o.customerId);
  }

  res.status(201).json(o);
});

router.put('/:id', (req, res) => {
  const o = req.body;
  db.prepare(
    `UPDATE orders SET
       status=?, payment_status=?, payment_method=?,
       amount_paid=?, balance=?, discount=?, total=?, final_total=?,
       items=?, customer_name=?,
       created_at=?, updated_at=?,
       is_delivery=?, delivery_address=?, delivery_date=?,
       notes=?
     WHERE id=?`
  ).run(
    o.status, o.paymentStatus, o.paymentMethod,
    o.amountPaid, o.balance, o.discount ?? 0, o.total, o.finalTotal,
    JSON.stringify(o.items), o.customerName,
    o.createdAt, o.updatedAt,
    o.isDelivery ? 1 : 0, o.deliveryAddress ?? '', o.deliveryDate ?? '',
    o.notes ?? '',
    req.params.id
  );
  res.json(o);
});

router.delete('/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM orders WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
