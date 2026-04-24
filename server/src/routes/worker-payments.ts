import { Router } from 'express';
import { db } from '../db.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

const toPayment = (r: any) => ({
  id: r.id, workerId: r.worker_id, workerName: r.worker_name,
  workerRole: r.worker_role, amount: r.amount, period: r.period,
  periodStart: r.period_start || undefined, periodEnd: r.period_end || undefined,
  paymentMethod: r.payment_method, date: r.date,
  concept: r.concept, notes: r.notes,
});

router.get('/', (_req, res) => {
  res.json(db.prepare('SELECT * FROM worker_payments ORDER BY date DESC').all().map(toPayment));
});

router.post('/', requireAdmin, (req, res) => {
  const p = req.body;
  db.prepare(
    `INSERT INTO worker_payments (id,worker_id,worker_name,worker_role,amount,period,period_start,period_end,payment_method,date,concept,notes)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(p.id, p.workerId, p.workerName, p.workerRole, p.amount,
        p.period, p.periodStart ?? '', p.periodEnd ?? '',
        p.paymentMethod ?? 'efectivo', p.date, p.concept, p.notes ?? '');
  res.status(201).json(p);
});

router.delete('/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM worker_payments WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
