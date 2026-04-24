import { Router } from 'express';
import { db } from '../db.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

const toWorker = (r: any) => ({
  id: r.id, name: r.name, role: r.role, phone: r.phone,
  salary: r.salary, salaryType: r.salary_type,
  startDate: r.start_date, active: r.active === 1, notes: r.notes,
});

router.get('/', (_req, res) => {
  res.json(db.prepare('SELECT * FROM workers ORDER BY name').all().map(toWorker));
});

router.post('/', requireAdmin, (req, res) => {
  const w = req.body;
  db.prepare(
    `INSERT INTO workers (id,name,role,phone,salary,salary_type,start_date,active,notes)
     VALUES (?,?,?,?,?,?,?,?,?)`
  ).run(w.id, w.name, w.role, w.phone ?? '', w.salary ?? 0,
        w.salaryType ?? 'mensual', w.startDate, w.active ? 1 : 0, w.notes ?? '');
  res.status(201).json(w);
});

router.put('/:id', requireAdmin, (req, res) => {
  const w = req.body;
  db.prepare(
    `UPDATE workers SET name=?,role=?,phone=?,salary=?,salary_type=?,start_date=?,active=?,notes=? WHERE id=?`
  ).run(w.name, w.role, w.phone ?? '', w.salary ?? 0,
        w.salaryType ?? 'mensual', w.startDate, w.active ? 1 : 0,
        w.notes ?? '', req.params.id);
  res.json(w);
});

router.delete('/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM workers WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
