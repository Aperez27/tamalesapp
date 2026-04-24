import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { fmt, genId } from '../utils/helpers';
import type { Worker, WorkerPayment, WorkerRole, SalaryType, PaymentPeriod, PaymentMethod } from '../types';
import {
  Plus, X, Edit2, Trash2, DollarSign, Users,
  ChevronDown, ChevronUp, CheckCircle2, Banknote,
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const ROLES: { value: WorkerRole; label: string; icon: string }[] = [
  { value: 'cocinero',             label: 'Cocinero/a',           icon: '👨‍🍳' },
  { value: 'auxiliar_cocina',      label: 'Auxiliar de Cocina',   icon: '🍽️' },
  { value: 'auxiliar_preparacion', label: 'Auxiliar de Preparación', icon: '🌽' },
  { value: 'repartidor',           label: 'Repartidor',           icon: '🛵' },
  { value: 'otro',                 label: 'Otro',                 icon: '👤' },
];

const SALARY_TYPES: { value: SalaryType; label: string }[] = [
  { value: 'mensual',    label: 'Mensual' },
  { value: 'quincenal',  label: 'Quincenal' },
  { value: 'semanal',    label: 'Semanal' },
  { value: 'diario',     label: 'Diario' },
  { value: 'destajo',    label: 'Por destajo' },
];

const PERIODS: { value: PaymentPeriod; label: string }[] = [
  { value: 'quincena_1',   label: 'Quincena 1 (1-15)' },
  { value: 'quincena_2',   label: 'Quincena 2 (16-fin)' },
  { value: 'mensual',      label: 'Pago mensual' },
  { value: 'semanal',      label: 'Pago semanal' },
  { value: 'bonificacion', label: 'Bonificación / Extra' },
  { value: 'pago_unico',   label: 'Pago único' },
];

const METHODS: PaymentMethod[] = ['efectivo','nequi','daviplata','transferencia'];

const roleMap = Object.fromEntries(ROLES.map(r => [r.value, r]));

function emptyWorker(): Omit<Worker, 'id'> {
  return { name: '', role: 'cocinero', phone: '', salary: 0, salaryType: 'quincenal', startDate: format(new Date(), 'yyyy-MM-dd'), active: true, notes: '' };
}

export default function Payroll() {
  const { state, dispatch } = useApp();
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState<'trabajadores' | 'pagos'>('trabajadores');
  const [monthFilter, setMonthFilter] = useState(format(new Date(), 'yyyy-MM'));
  const [filterWorker, setFilterWorker] = useState('');

  // Worker modal
  const [workerModal, setWorkerModal] = useState(false);
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [wForm, setWForm] = useState(emptyWorker());

  // Payment modal
  const [payModal, setPayModal] = useState(false);
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payPeriod, setPayPeriod] = useState<PaymentPeriod>('quincena_1');
  const [payConcept, setPayConcept] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('efectivo');
  const [payDate, setPayDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [payPeriodStart, setPayPeriodStart] = useState('');
  const [payPeriodEnd, setPayPeriodEnd] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const [expandedWorker, setExpandedWorker] = useState<string | null>(null);

  const monthStart = startOfMonth(parseISO(monthFilter + '-01'));
  const monthEnd   = endOfMonth(monthStart);

  const activeWorkers = state.workers.filter(w => w.active);

  const monthPayments = useMemo(() =>
    state.workerPayments.filter(p =>
      isWithinInterval(parseISO(p.date), { start: monthStart, end: monthEnd }) &&
      (filterWorker ? p.workerId === filterWorker : true)
    ).sort((a, b) => b.date.localeCompare(a.date)),
    [state.workerPayments, monthFilter, filterWorker]
  );

  const totalPaidMonth = monthPayments.reduce((s, p) => s + p.amount, 0);
  const estimatedMonthly = activeWorkers.reduce((s, w) => {
    if (w.salaryType === 'mensual')   return s + w.salary;
    if (w.salaryType === 'quincenal') return s + w.salary * 2;
    if (w.salaryType === 'semanal')   return s + w.salary * 4;
    return s + w.salary;
  }, 0);

  // Worker CRUD
  function openCreateWorker() {
    setEditingWorker(null);
    setWForm(emptyWorker());
    setWorkerModal(true);
  }

  function openEditWorker(w: Worker) {
    setEditingWorker(w);
    setWForm({ name: w.name, role: w.role, phone: w.phone, salary: w.salary, salaryType: w.salaryType, startDate: w.startDate, active: w.active, notes: w.notes ?? '' });
    setWorkerModal(true);
  }

  async function saveWorker() {
    if (!wForm.name.trim()) return;
    setSaving(true);
    try {
      if (editingWorker) {
        const updated = { ...editingWorker, ...wForm };
        await api.updateWorker(updated);
        dispatch({ type: 'UPDATE_WORKER', payload: updated });
      } else {
        const w: Worker = { id: genId('wrk'), ...wForm };
        await api.createWorker(w);
        dispatch({ type: 'ADD_WORKER', payload: w });
      }
      setWorkerModal(false);
    } catch (e) { alert('Error: ' + (e as Error).message); }
    finally { setSaving(false); }
  }

  async function deleteWorker(w: Worker) {
    if (!confirm(`¿Eliminar a ${w.name}? Se eliminará del sistema.`)) return;
    try {
      await api.deleteWorker(w.id);
      dispatch({ type: 'DELETE_WORKER', payload: w.id });
    } catch (e) { alert('Error: ' + (e as Error).message); }
  }

  async function toggleActive(w: Worker) {
    const updated = { ...w, active: !w.active };
    await api.updateWorker(updated);
    dispatch({ type: 'UPDATE_WORKER', payload: updated });
  }

  // Payment CRUD
  function openPayModal(workerId?: string) {
    setSelectedWorkerId(workerId ?? '');
    setPayAmount('');
    setPayPeriod('quincena_1');
    setPayConcept('');
    setPayMethod('efectivo');
    setPayDate(format(new Date(), 'yyyy-MM-dd'));
    setPayPeriodStart('');
    setPayPeriodEnd('');
    setPayNotes('');
    setPayModal(true);
  }

  async function savePayment() {
    const worker = state.workers.find(w => w.id === selectedWorkerId);
    const amount = parseFloat(payAmount);
    if (!worker || !amount || !payConcept.trim()) return;
    setSaving(true);
    try {
      const payment: WorkerPayment = {
        id: genId('wp'), workerId: worker.id, workerName: worker.name,
        workerRole: worker.role, amount, period: payPeriod,
        periodStart: payPeriodStart || undefined, periodEnd: payPeriodEnd || undefined,
        paymentMethod: payMethod, date: payDate, concept: payConcept, notes: payNotes || undefined,
      };
      await api.createWorkerPayment(payment);
      dispatch({ type: 'ADD_WORKER_PAYMENT', payload: payment });
      setPayModal(false);
    } catch (e) { alert('Error: ' + (e as Error).message); }
    finally { setSaving(false); }
  }

  async function deletePayment(p: WorkerPayment) {
    if (!confirm('¿Eliminar este pago?')) return;
    try {
      await api.deleteWorkerPayment(p.id);
      dispatch({ type: 'DELETE_WORKER_PAYMENT', payload: p.id });
    } catch (e) { alert('Error: ' + (e as Error).message); }
  }

  const setW = (k: keyof typeof wForm, v: any) => setWForm(p => ({ ...p, [k]: v }));

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card">
          <p className="text-xs text-gray-400">Trabajadores activos</p>
          <p className="text-2xl font-bold text-gray-800">{activeWorkers.length}</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-400">Nómina estimada/mes</p>
          <p className="text-2xl font-bold text-orange-600">{fmt(estimatedMonthly)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-400">Pagado este mes</p>
          <p className="text-2xl font-bold text-green-600">{fmt(totalPaidMonth)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-400">Pagos registrados</p>
          <p className="text-2xl font-bold text-gray-800">{monthPayments.length}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {(['trabajadores', 'pagos'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>
            {t === 'trabajadores' ? '👥 Trabajadores' : '💵 Pagos'}
          </button>
        ))}
      </div>

      {/* ── TAB: Trabajadores ─────────────────────────────────────── */}
      {tab === 'trabajadores' && (
        <div className="space-y-3">
          {isAdmin && (
            <div className="flex justify-end">
              <button onClick={openCreateWorker} className="btn-primary flex items-center gap-1.5 text-sm">
                <Plus size={16} /> Nuevo Trabajador
              </button>
            </div>
          )}

          {state.workers.length === 0 ? (
            <div className="card text-center py-16 text-gray-400">
              <Users size={40} className="mx-auto mb-3 opacity-20" />
              <p>No hay trabajadores registrados</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {state.workers.map(w => {
                const role = roleMap[w.role];
                const wPayments = state.workerPayments.filter(p =>
                  p.workerId === w.id &&
                  isWithinInterval(parseISO(p.date), { start: monthStart, end: monthEnd })
                );
                const paidThisMonth = wPayments.reduce((s, p) => s + p.amount, 0);
                const isExpanded = expandedWorker === w.id;

                return (
                  <div key={w.id} className={`card transition-all ${!w.active ? 'opacity-60' : ''}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-2xl ${w.active ? 'bg-orange-100' : 'bg-gray-100'}`}>
                          {role?.icon ?? '👤'}
                        </div>
                        <div>
                          <p className="font-bold text-gray-800 text-sm leading-tight">{w.name}</p>
                          <p className="text-xs text-gray-500">{role?.label}</p>
                        </div>
                      </div>
                      {isAdmin && (
                        <div className="flex gap-1">
                          <button onClick={() => openEditWorker(w)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600">
                            <Edit2 size={13} />
                          </button>
                          <button onClick={() => deleteWorker(w)} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="space-y-1 mb-3">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400">Salario {SALARY_TYPES.find(s => s.value === w.salaryType)?.label.toLowerCase()}</span>
                        <span className="font-semibold text-gray-700">{fmt(w.salary)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400">Pagado este mes</span>
                        <span className="font-semibold text-green-600">{fmt(paidThisMonth)}</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {isAdmin && w.active && (
                        <button onClick={() => openPayModal(w.id)}
                          className="flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 font-semibold transition-colors">
                          <Banknote size={12} /> Registrar Pago
                        </button>
                      )}
                      {isAdmin && (
                        <button onClick={() => toggleActive(w)}
                          className={`text-xs py-1.5 px-3 rounded-lg border font-medium transition-colors ${w.active ? 'text-gray-500 border-gray-200 hover:bg-gray-100' : 'text-green-600 border-green-200 hover:bg-green-50'}`}>
                          {w.active ? 'Desactivar' : 'Activar'}
                        </button>
                      )}
                    </div>

                    {wPayments.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-50">
                        <button onClick={() => setExpandedWorker(isExpanded ? null : w.id)}
                          className="w-full flex items-center justify-between text-xs text-gray-500 hover:text-gray-700">
                          <span>{wPayments.length} pago{wPayments.length !== 1 ? 's' : ''} este mes</span>
                          {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </button>
                        {isExpanded && (
                          <div className="mt-2 space-y-1">
                            {wPayments.map(p => (
                              <div key={p.id} className="flex justify-between items-center text-xs bg-gray-50 rounded-lg px-2 py-1.5">
                                <div>
                                  <p className="font-medium text-gray-700">{p.concept}</p>
                                  <p className="text-gray-400">{format(parseISO(p.date), 'dd MMM', { locale: es })}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-gray-800">{fmt(p.amount)}</span>
                                  {isAdmin && (
                                    <button onClick={() => deletePayment(p)} className="text-gray-300 hover:text-red-400">
                                      <X size={12} />
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Pagos ────────────────────────────────────────────── */}
      {tab === 'pagos' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            <input type="month" className="input-field w-auto text-sm" value={monthFilter}
              onChange={e => setMonthFilter(e.target.value)} />
            <select className="input-field w-auto text-sm" value={filterWorker} onChange={e => setFilterWorker(e.target.value)}>
              <option value="">Todos los trabajadores</option>
              {state.workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            {isAdmin && (
              <button onClick={() => openPayModal()} className="btn-primary flex items-center gap-1.5 text-sm ml-auto">
                <Plus size={16} /> Registrar Pago
              </button>
            )}
          </div>

          <div className="card overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {['Fecha','Trabajador','Rol','Concepto','Período','Método','Monto',''].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {monthPayments.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-12 text-gray-400">
                    <DollarSign size={32} className="mx-auto mb-2 opacity-20" />
                    No hay pagos registrados en este período
                  </td></tr>
                ) : monthPayments.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{format(parseISO(p.date), 'dd MMM yyyy', { locale: es })}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{p.workerName}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{roleMap[p.workerRole]?.icon} {roleMap[p.workerRole]?.label}</td>
                    <td className="px-4 py-3 text-gray-600">{p.concept}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{PERIODS.find(x => x.value === p.period)?.label}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs capitalize">{p.paymentMethod}</td>
                    <td className="px-4 py-3 font-bold text-green-600 whitespace-nowrap">{fmt(p.amount)}</td>
                    <td className="px-4 py-3">
                      {isAdmin && (
                        <button onClick={() => deletePayment(p)} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              {monthPayments.length > 0 && (
                <tfoot>
                  <tr className="border-t border-gray-200 bg-gray-50">
                    <td colSpan={6} className="px-4 py-3 text-sm font-semibold text-gray-600">Total del período</td>
                    <td className="px-4 py-3 text-base font-bold text-green-700">{fmt(totalPaidMonth)}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* Modal nuevo/editar trabajador */}
      {workerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-bold text-gray-800">{editingWorker ? 'Editar Trabajador' : 'Nuevo Trabajador'}</h3>
              <button onClick={() => setWorkerModal(false)}><X size={20} className="text-gray-400" /></button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Nombre completo *</label>
                <input className="input-field" value={wForm.name} onChange={e => setW('name', e.target.value)} placeholder="Nombre del trabajador" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Cargo *</label>
                <select className="input-field" value={wForm.role} onChange={e => setW('role', e.target.value)}>
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.icon} {r.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Teléfono</label>
                <input className="input-field" value={wForm.phone} onChange={e => setW('phone', e.target.value)} placeholder="300 000 0000" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Salario</label>
                  <input type="number" className="input-field" min={0} value={wForm.salary || ''} placeholder="0"
                    onChange={e => setW('salary', parseFloat(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Tipo de pago</label>
                  <select className="input-field" value={wForm.salaryType} onChange={e => setW('salaryType', e.target.value)}>
                    {SALARY_TYPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Fecha de ingreso</label>
                <input type="date" className="input-field" value={wForm.startDate} onChange={e => setW('startDate', e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Notas</label>
                <textarea className="input-field resize-none h-14 text-sm" placeholder="Observaciones..."
                  value={wForm.notes ?? ''} onChange={e => setW('notes', e.target.value)} />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setWorkerModal(false)} className="btn-secondary flex-1">Cancelar</button>
                <button onClick={saveWorker} disabled={saving || !wForm.name.trim()} className="btn-primary flex-1">
                  {saving ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal registrar pago */}
      {payModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-bold text-gray-800">Registrar Pago a Trabajador</h3>
              <button onClick={() => setPayModal(false)}><X size={20} className="text-gray-400" /></button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Trabajador *</label>
                <select className="input-field" value={selectedWorkerId} onChange={e => setSelectedWorkerId(e.target.value)}>
                  <option value="">Seleccionar...</option>
                  {state.workers.filter(w => w.active).map(w => (
                    <option key={w.id} value={w.id}>{roleMap[w.role]?.icon} {w.name} — {fmt(w.salary)}/{SALARY_TYPES.find(s => s.value === w.salaryType)?.label.toLowerCase()}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Concepto *</label>
                <input className="input-field" placeholder="Ej: Quincena 1-15 Abril" value={payConcept} onChange={e => setPayConcept(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Tipo de período</label>
                  <select className="input-field text-sm" value={payPeriod} onChange={e => setPayPeriod(e.target.value as PaymentPeriod)}>
                    {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Fecha de pago</label>
                  <input type="date" className="input-field text-sm" value={payDate} onChange={e => setPayDate(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Período inicio</label>
                  <input type="date" className="input-field text-sm" value={payPeriodStart} onChange={e => setPayPeriodStart(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Período fin</label>
                  <input type="date" className="input-field text-sm" value={payPeriodEnd} onChange={e => setPayPeriodEnd(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Monto *</label>
                  <input type="number" className="input-field" min={0} placeholder="0" value={payAmount} onChange={e => setPayAmount(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Método</label>
                  <select className="input-field" value={payMethod} onChange={e => setPayMethod(e.target.value as PaymentMethod)}>
                    {METHODS.map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
                  </select>
                </div>
              </div>
              {selectedWorkerId && payAmount && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-green-600 flex-shrink-0" />
                  <p className="text-sm text-green-700">
                    Pago de <strong>{fmt(parseFloat(payAmount) || 0)}</strong> a <strong>{state.workers.find(w => w.id === selectedWorkerId)?.name}</strong>
                  </p>
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Notas</label>
                <textarea className="input-field resize-none h-12 text-sm" placeholder="Observaciones..." value={payNotes} onChange={e => setPayNotes(e.target.value)} />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setPayModal(false)} className="btn-secondary flex-1">Cancelar</button>
                <button onClick={savePayment} disabled={saving || !selectedWorkerId || !payAmount || !payConcept.trim()}
                  className="btn-primary flex-1">
                  {saving ? 'Guardando…' : 'Registrar Pago'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
