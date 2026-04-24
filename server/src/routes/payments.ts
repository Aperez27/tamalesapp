import { Router } from 'express';
import { db } from '../db.js';

const router = Router();

const toPayment = (r: any) => ({
  id: r.id, customerId: r.customer_id, customerName: r.customer_name,
  orderId: r.order_id || undefined, amount: r.amount, method: r.method,
  date: r.date, notes: r.notes,
});

router.get('/', (_req, res) => {
  res.json(db.prepare('SELECT * FROM payments ORDER BY date DESC').all().map(toPayment));
});

router.post('/', (req, res) => {
  const p = req.body;
  db.prepare(
    `INSERT INTO payments (id,customer_id,customer_name,order_id,amount,method,date,notes)
     VALUES (?,?,?,?,?,?,?,?)`
  ).run(p.id, p.customerId, p.customerName, p.orderId ?? '', p.amount, p.method, p.date, p.notes ?? '');

  // Actualizar saldo del pedido si se especificó
  if (p.orderId) {
    db.prepare(
      `UPDATE orders SET
         amount_paid = amount_paid + ?,
         balance = balance - ?,
         payment_status = CASE
           WHEN (balance - ?) <= 0 THEN 'pagado'
           ELSE 'parcial'
         END,
         updated_at = ?
       WHERE id = ?`
    ).run(p.amount, p.amount, p.amount, p.date, p.orderId);
  }

  // Actualizar balance del cliente
  if (p.customerId && p.customerId !== 'walk-in') {
    db.prepare('UPDATE customers SET balance = balance + ? WHERE id = ?').run(p.amount, p.customerId);
  }

  res.status(201).json(p);
});

export default router;
