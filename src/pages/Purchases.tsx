import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { fmt, genId } from '../utils/helpers';
import type { Purchase, PurchaseItem, PurchaseStatus, PaymentMethod } from '../types';
import {
  Plus, X, Trash2, Eye, CreditCard, Search,
  ShoppingCart, AlertCircle, CheckCircle2, Clock,
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const STATUS_CFG: Record<PurchaseStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pagado:   { label: 'Pagado',   color: 'bg-green-100 text-green-700 border-green-200',   icon: <CheckCircle2 size={12} /> },
  parcial:  { label: 'Parcial',  color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: <Clock size={12} /> },
  pendiente:{ label: 'Pendiente',color: 'bg-red-100 text-red-700 border-red-200',          icon: <AlertCircle size={12} /> },
};

const METHODS: PaymentMethod[] = ['efectivo','transferencia','nequi','daviplata','tarjeta'];

function emptyItem(): PurchaseItem { return { description: '', quantity: 1, unitPrice: 0, subtotal: 0 }; }

export default function Purchases() {
  const { state, dispatch } = useApp();
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<PurchaseStatus | 'todas'>('todas');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [monthFilter, setMonthFilter] = useState(format(new Date(), 'yyyy-MM'));
  const [showModal, setShowModal] = useState(false);
  const [detailPurchase, setDetailPurchase] = useState<Purchase | null>(null);
  const [payModal, setPayModal] = useState<Purchase | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('efectivo');
  const [saving, setSaving] = useState(false);

  // Form state
  const [supplierId, setSupplierId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dueDate, setDueDate] = useState('');
  const [items, setItems] = useState<PurchaseItem[]>([emptyItem()]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('efectivo');
  const [amountPaid, setAmountPaid] = useState('');
  const [notes, setNotes] = useState('');

  const monthStart = startOfMonth(parseISO(monthFilter + '-01'));
  const monthEnd   = endOfMonth(monthStart);

  const filtered = useMemo(() => {
    let list = state.purchases.filter(p =>
      isWithinInterval(parseISO(p.date), { start: monthStart, end: monthEnd })
    );
    if (filterStatus !== 'todas') list = list.filter(p => p.status === filterStatus);
    if (filterSupplier) list = list.filter(p => p.supplierId === filterSupplier);
    if (search) list = list.filter(p =>
      p.supplierName.toLowerCase().includes(search.toLowerCase()) ||
      (p.invoiceNumber ?? '').toLowerCase().includes(search.toLowerCase())
    );
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [state.purchases, filterStatus, filterSupplier, search, monthFilter]);

  const totalMes = filtered.reduce((s, p) => s + p.total, 0);
  const pagadoMes = filtered.reduce((s, p) => s + p.amountPaid, 0);
  const pendienteMes = filtered.reduce((s, p) => s + p.balance, 0);

  const subtotal = items.reduce((s, it) => s + it.subtotal, 0);
  const paid = parseFloat(amountPaid) || 0;

  function updateItem(idx: number, field: keyof PurchaseItem, val: string | number) {
    setItems(prev => {
      const next = [...prev];
      const it = { ...next[idx], [field]: val };
      if (field === 'quantity' || field === 'unitPrice') {
        it.subtotal = (field === 'quantity' ? Number(val) : it.quantity) *
                      (field === 'unitPrice' ? Number(val) : it.unitPrice);
      }
      next[idx] = it;
      return next;
    });
  }

  async function handleSave() {
    const supplier = state.suppliers.find(s => s.id === supplierId);
    if (!supplier || items.some(it => !it.description.trim())) return;
    setSaving(true);
    try {
      const balance = subtotal - paid;
      const status: PurchaseStatus = paid >= subtotal ? 'pagado' : paid > 0 ? 'parcial' : 'pendiente';
      const p: Purchase = {
        id: genId('pur'), supplierId, supplierName: supplier.name,
        invoiceNumber: invoiceNumber || undefined, items, subtotal, total: subtotal,
        amountPaid: paid, balance, status, paymentMethod,
        date, dueDate: dueDate || undefined, notes: notes || undefined,
      };
      await api.createPurchase(p);
      dispatch({ type: 'ADD_PURCHASE', payload: p });
      resetForm();
      setShowModal(false);
    } catch (e) {
      alert('Error: ' + (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleRegisterPayment() {
    if (!payModal) return;
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) return;
    const newPaid = Math.min(payModal.amountPaid + amount, payModal.total);
    const newBalance = payModal.total - newPaid;
    const newStatus: PurchaseStatus = newBalance <= 0 ? 'pagado' : 'parcial';
    const updated: Purchase = { ...payModal, amountPaid: newPaid, balance: newBalance, status: newStatus, paymentMethod: payMethod };
    try {
      await api.updatePurchase(updated);
      dispatch({ type: 'UPDATE_PURCHASE', payload: updated });
      setPayModal(null);
      setPayAmount('');
    } catch (e) {
      alert('Error: ' + (e as Error).message);
    }
  }

  async function handleDelete(p: Purchase) {
    if (!confirm(`¿Eliminar compra de ${p.supplierName} por ${fmt(p.total)}?`)) return;
    try {
      await api.deletePurchase(p.id);
      dispatch({ type: 'DELETE_PURCHASE', payload: p.id });
    } catch (e) {
      alert('Error: ' + (e as Error).message);
    }
  }

  function resetForm() {
    setSupplierId(''); setInvoiceNumber(''); setDate(format(new Date(), 'yyyy-MM-dd'));
    setDueDate(''); setItems([emptyItem()]); setPaymentMethod('efectivo');
    setAmountPaid(''); setNotes('');
  }

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="card">
          <p className="text-xs text-gray-500 mb-1">Total compras del mes</p>
          <p className="text-2xl font-bold text-gray-800">{fmt(totalMes)}</p>
          <p className="text-xs text-gray-400 mt-1">{filtered.length} compra{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500 mb-1">Pagado</p>
          <p className="text-2xl font-bold text-green-600">{fmt(pagadoMes)}</p>
          <p className="text-xs text-gray-400 mt-1">{totalMes > 0 ? Math.round(pagadoMes / totalMes * 100) : 0}% del total</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500 mb-1">Pendiente de pago</p>
          <p className="text-2xl font-bold text-red-600">{fmt(pendienteMes)}</p>
          <p className="text-xs text-gray-400 mt-1">{filtered.filter(p => p.balance > 0).length} compra{filtered.filter(p => p.balance > 0).length !== 1 ? 's' : ''} con saldo</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <input type="month" className="input-field w-auto text-sm" value={monthFilter}
          onChange={e => setMonthFilter(e.target.value)} />
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-2.5 text-gray-400" />
          <input className="input-field pl-9" placeholder="Buscar proveedor o factura..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input-field w-auto text-sm" value={filterSupplier} onChange={e => setFilterSupplier(e.target.value)}>
          <option value="">Todos los proveedores</option>
          {state.suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select className="input-field w-auto text-sm" value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}>
          <option value="todas">Todos los estados</option>
          <option value="pagado">Pagado</option>
          <option value="parcial">Parcial</option>
          <option value="pendiente">Pendiente</option>
        </select>
        <button onClick={() => { resetForm(); setShowModal(true); }} className="btn-primary flex items-center gap-1.5 text-sm whitespace-nowrap">
          <Plus size={16} /> Nueva Compra
        </button>
      </div>

      {/* Tabla */}
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {['Fecha','Proveedor','Factura','Descripción','Total','Pagado','Saldo','Estado',''].map(h => (
                <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-12 text-gray-400">
                <ShoppingCart size={32} className="mx-auto mb-2 opacity-20" />
                No hay compras en este período
              </td></tr>
            ) : filtered.map(p => {
              const cfg = STATUS_CFG[p.status];
              return (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{format(parseISO(p.date), 'dd MMM yyyy', { locale: es })}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{p.supplierName}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{p.invoiceNumber || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs max-w-[180px] truncate">
                    {p.items.map(it => `${it.quantity}× ${it.description}`).join(', ')}
                  </td>
                  <td className="px-4 py-3 font-semibold text-gray-800 whitespace-nowrap">{fmt(p.total)}</td>
                  <td className="px-4 py-3 text-green-600 font-medium whitespace-nowrap">{fmt(p.amountPaid)}</td>
                  <td className="px-4 py-3 text-red-600 font-medium whitespace-nowrap">{p.balance > 0 ? fmt(p.balance) : '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border w-fit ${cfg.color}`}>
                      {cfg.icon}{cfg.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => setDetailPurchase(p)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600">
                        <Eye size={14} />
                      </button>
                      {p.balance > 0 && (
                        <button onClick={() => { setPayModal(p); setPayAmount(''); setPayMethod('efectivo'); }}
                          className="p-1.5 hover:bg-green-50 rounded-lg text-gray-400 hover:text-green-600">
                          <CreditCard size={14} />
                        </button>
                      )}
                      {isAdmin && (
                        <button onClick={() => handleDelete(p)} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal nueva compra */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b shrink-0">
              <h3 className="font-bold text-gray-800">Nueva Compra</h3>
              <button onClick={() => setShowModal(false)}><X size={20} className="text-gray-400" /></button>
            </div>
            <div className="overflow-y-auto p-4 space-y-4">
              {/* Supplier + Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Proveedor *</label>
                  <select className="input-field text-sm" value={supplierId} onChange={e => setSupplierId(e.target.value)}>
                    <option value="">Seleccionar...</option>
                    {state.suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Fecha *</label>
                  <input type="date" className="input-field text-sm" value={date} onChange={e => setDate(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Número de factura</label>
                  <input className="input-field text-sm" placeholder="FAC-001" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Fecha vencimiento</label>
                  <input type="date" className="input-field text-sm" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                </div>
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-gray-600">Artículos *</label>
                  <button onClick={() => setItems(p => [...p, emptyItem()])}
                    className="text-xs text-orange-600 hover:text-orange-700 font-medium flex items-center gap-1">
                    <Plus size={12} /> Agregar ítem
                  </button>
                </div>
                <div className="space-y-2">
                  <div className="grid grid-cols-12 gap-1 text-[10px] font-semibold text-gray-400 px-1">
                    <span className="col-span-5">Descripción</span><span className="col-span-2">Cant.</span>
                    <span className="col-span-2">Precio</span><span className="col-span-2">Subtotal</span>
                  </div>
                  {items.map((it, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-1 items-center">
                      <input className="input-field text-xs col-span-5 py-1.5" placeholder="Descripción" value={it.description}
                        onChange={e => updateItem(idx, 'description', e.target.value)} />
                      <input type="number" className="input-field text-xs col-span-2 py-1.5 text-right" min={1} value={it.quantity}
                        onChange={e => updateItem(idx, 'quantity', parseFloat(e.target.value) || 1)} />
                      <input type="number" className="input-field text-xs col-span-2 py-1.5 text-right" min={0} value={it.unitPrice || ''}
                        placeholder="0" onChange={e => updateItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)} />
                      <span className="col-span-2 text-xs font-semibold text-gray-700 text-right px-1">{fmt(it.subtotal)}</span>
                      {items.length > 1 && (
                        <button onClick={() => setItems(p => p.filter((_, i) => i !== idx))} className="text-gray-300 hover:text-red-400 col-span-1">
                          <X size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex justify-end mt-2 pt-2 border-t border-gray-100">
                  <p className="text-sm font-bold text-gray-800">Total: {fmt(subtotal)}</p>
                </div>
              </div>

              {/* Payment */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Método de pago</label>
                  <select className="input-field text-sm" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}>
                    {METHODS.map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Abono / Pago inicial</label>
                  <input type="number" className="input-field text-sm" placeholder="0" value={amountPaid}
                    onChange={e => setAmountPaid(e.target.value)} />
                </div>
              </div>
              {paid > 0 && paid < subtotal && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <AlertCircle size={12} /> Saldo pendiente: {fmt(subtotal - paid)}
                </p>
              )}
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Notas</label>
                <textarea className="input-field text-sm resize-none h-12" placeholder="Observaciones..." value={notes} onChange={e => setNotes(e.target.value)} />
              </div>
            </div>
            <div className="p-4 border-t flex gap-2 shrink-0">
              <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handleSave} disabled={saving || !supplierId || items.some(it => !it.description.trim())}
                className="btn-primary flex-1">
                {saving ? 'Guardando…' : 'Registrar Compra'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal detalle */}
      {detailPurchase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-bold text-gray-800">Detalle de Compra</h3>
              <button onClick={() => setDetailPurchase(null)}><X size={20} className="text-gray-400" /></button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><p className="text-xs text-gray-400">Proveedor</p><p className="font-semibold">{detailPurchase.supplierName}</p></div>
                <div><p className="text-xs text-gray-400">Fecha</p><p className="font-semibold">{format(parseISO(detailPurchase.date), 'dd MMM yyyy', { locale: es })}</p></div>
                {detailPurchase.invoiceNumber && <div><p className="text-xs text-gray-400">Factura</p><p className="font-semibold">{detailPurchase.invoiceNumber}</p></div>}
                <div><p className="text-xs text-gray-400">Estado</p>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_CFG[detailPurchase.status].color}`}>
                    {STATUS_CFG[detailPurchase.status].label}
                  </span>
                </div>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 space-y-1">
                <p className="text-xs font-semibold text-gray-600 mb-2">Artículos</p>
                {detailPurchase.items.map((it, i) => (
                  <div key={i} className="flex justify-between text-xs text-gray-600">
                    <span>{it.quantity}× {it.description}</span>
                    <span className="font-medium">{fmt(it.subtotal)}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Total</span><span className="font-bold">{fmt(detailPurchase.total)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Pagado</span><span className="font-bold text-green-600">{fmt(detailPurchase.amountPaid)}</span></div>
                {detailPurchase.balance > 0 && <div className="flex justify-between"><span className="text-gray-500">Saldo</span><span className="font-bold text-red-600">{fmt(detailPurchase.balance)}</span></div>}
              </div>
              {detailPurchase.notes && <p className="text-xs text-gray-500 italic">{detailPurchase.notes}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Modal registrar pago */}
      {payModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-bold text-gray-800">Registrar Pago</h3>
              <button onClick={() => setPayModal(null)}><X size={20} className="text-gray-400" /></button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-sm text-gray-600">
                Proveedor: <strong>{payModal.supplierName}</strong><br />
                Saldo pendiente: <strong className="text-red-600">{fmt(payModal.balance)}</strong>
              </p>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Monto a pagar</label>
                <input type="number" className="input-field" placeholder="0" max={payModal.balance}
                  value={payAmount} onChange={e => setPayAmount(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Método</label>
                <select className="input-field" value={payMethod} onChange={e => setPayMethod(e.target.value as PaymentMethod)}>
                  {METHODS.map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setPayModal(null)} className="btn-secondary flex-1">Cancelar</button>
                <button onClick={handleRegisterPayment} className="btn-primary flex-1">Registrar Pago</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
