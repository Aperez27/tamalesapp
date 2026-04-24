import { Router } from 'express';
import { db } from '../db.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

const toDelivery = (r: any) => ({
  id: r.id, orderId: r.order_id, customerName: r.customer_name,
  address: r.address, neighborhood: r.neighborhood,
  items: JSON.parse(r.items), status: r.status,
  scheduledDate: r.scheduled_date, deliveredAt: r.delivered_at || undefined,
  notes: r.notes, phone: r.phone,
});

router.get('/', (_req, res) => {
  res.json(db.prepare('SELECT * FROM deliveries ORDER BY scheduled_date DESC').all().map(toDelivery));
});

router.post('/', (req, res) => {
  const d = req.body;
  db.prepare(
    `INSERT INTO deliveries (id,order_id,customer_name,address,neighborhood,items,status,scheduled_date,delivered_at,notes,phone)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`
  ).run(d.id, d.orderId, d.customerName, d.address, d.neighborhood ?? '',
        JSON.stringify(d.items), d.status, d.scheduledDate,
        d.deliveredAt ?? '', d.notes ?? '', d.phone ?? '');
  res.status(201).json(d);
});

router.put('/:id', (req, res) => {
  const d = req.body;
  db.prepare(
    `UPDATE deliveries SET status=?,delivered_at=?,notes=? WHERE id=?`
  ).run(d.status, d.deliveredAt ?? '', d.notes ?? '', req.params.id);

  // Si se marcó entregado, actualizar también el pedido
  if (d.status === 'entregado' && d.orderId) {
    db.prepare(`UPDATE orders SET status='entregado', updated_at=? WHERE id=?`)
      .run(new Date().toISOString(), d.orderId);
  }
  res.json(d);
});

router.delete('/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM deliveries WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
