import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { fmt, genId } from '../utils/helpers';
import { api } from '../api/client';
import type { Expense, ExpenseCategory, PaymentMethod } from '../types';
import { Plus, Search, Pencil, Trash2, X, TrendingDown, TrendingUp, DollarSign } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfYear, isWithinInterval, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const categoryLabels: Record<ExpenseCategory, { label: string; emoji: string; color: string }> = {
  insumos:    { label: 'Insumos',         emoji: '🌽', color: 'bg-orange-100 text-orange-700' },
  empaques:   { label: 'Empaques',        emoji: '📦', color: 'bg-blue-100 text-blue-700' },
  servicios:  { label: 'Servicios',       emoji: '💡', color: 'bg-yellow-100 text-yellow-700' },
  transporte: { label: 'Transporte',      emoji: '🚚', color: 'bg-purple-100 text-purple-700' },
  nomina:     { label: 'Nómina',          emoji: '👥', color: 'bg-green-100 text-green-700' },
  otros:      { label: 'Otros',           emoji: '📋', color: 'bg-gray-100 text-gray-700' },
};

const methodLabel: Record<PaymentMethod, string> = {
  efectivo: 'Efectivo', nequi: 'Nequi', daviplata: 'Daviplata',
  transferencia: 'Transferencia', tarjeta: 'Tarjeta', fiado: 'Fiado',
};

const emptyForm = (): Partial<Expense> => ({
  date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
  amount: 0,
  category: 'insumos',
  description: '',
  provider: '',
  method: 'efectivo',
  notes: '',
});

export default function Expenses() {
  const { state, dispatch } = useApp();
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState<Partial<Expense>>(emptyForm());
  const [saving, setSaving] = useState(false);

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const yearStart = startOfYear(now);

  const totalMonth = useMemo(() =>
    state.expenses.filter(e => isWithinInterval(parseISO(e.date), { start: monthStart, end: monthEnd }))
      .reduce((s, e) => s + e.amount, 0),
    [state.expenses]
  );

  const totalYear = useMemo(() =>
    state.expenses.filter(e => isWithinInterval(parseISO(e.date), { start: yearStart, end: now }))
      .reduce((s, e) => s + e.amount, 0),
    [state.expenses]
  );

  const salesMonth = useMemo(() =>
    state.orders.filter(o => isWithinInterval(parseISO(o.createdAt), { start: monthStart, end: monthEnd }))
      .reduce((s, o) => s + o.amountPaid, 0),
    [state.orders]
  );

  const byCategory = useMemo(() => {
    const map: Record<string, number> = {};
    state.expenses.filter(e => isWithinInterval(parseISO(e.date), { start: monthStart, end: monthEnd }))
      .forEach(e => { map[e.category] = (map[e.category] ?? 0) + e.amount; });
    return map;
  }, [state.expenses]);

  const filtered = useMemo(() => {
    return state.expenses.filter(e => {
      const matchSearch = !search || e.description.toLowerCase().includes(search.toLowerCase()) || e.provider.toLowerCase().includes(search.toLowerCase());
      const matchCat = !catFilter || e.category === catFilter;
      const matchFrom = !dateFrom || e.date >= dateFrom;
      const matchTo = !dateTo || e.date <= dateTo + 'T23:59:59';
      return matchSearch && matchCat && matchFrom && matchTo;
    });
  }, [state.expenses, search, catFilter, dateFrom, dateTo]);

  function openNew() {
    setEditing(null);
    setForm(emptyForm());
    setShowModal(true);
  }

  function openEdit(expense: Expense) {
    setEditing(expense);
    setForm({ ...expense, date: expense.date.slice(0, 16) });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.description?.trim() || !form.amount || !form.date) return;
    setSaving(true);
    try {
      const expense: Expense = {
        id: editing?.id ?? genId('exp'),
        date: format(new Date(form.date!), "yyyy-MM-dd'T'HH:mm:ss"),
        amount: Number(form.amount),
        category: (form.category as ExpenseCategory) ?? 'otros',
        description: form.description!,
        provider: form.provider ?? '',
        method: (form.method as PaymentMethod) ?? 'efectivo',
        notes: form.notes ?? '',
      };

      if (editing) {
        await api.updateExpense(expense);
        dispatch({ type: 'UPDATE_EXPENSE', payload: expense });
      } else {
        await api.createExpense(expense);
        dispatch({ type: 'ADD_EXPENSE', payload: expense });
      }
      setShowModal(false);
    } catch (e) {
      alert('Error: ' + (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(expense: Expense) {
    if (!confirm(`¿Eliminar "${expense.description}"? Esta acción no se puede deshacer.`)) return;
    try {
      await api.deleteExpense(expense.id);
      dispatch({ type: 'DELETE_EXPENSE', payload: expense.id });
    } catch (e) {
      alert('Error: ' + (e as Error).message);
    }
  }

  const profit = salesMonth - totalMonth;

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-xs text-gray-500 mb-1">Gastos este mes</p>
          <p className="text-2xl font-bold text-red-600">{fmt(totalMonth)}</p>
          <p className="text-xs text-gray-400 mt-1">{format(now, 'MMMM yyyy', { locale: es })}</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500 mb-1">Ingresos este mes</p>
          <p className="text-2xl font-bold text-green-600">{fmt(salesMonth)}</p>
          <p className="text-xs text-gray-400 mt-1">Solo cobros registrados</p>
        </div>
        <div className="card">
          <div className="flex items-center gap-1.5 mb-1">
            {profit >= 0 ? <TrendingUp size={14} className="text-green-500" /> : <TrendingDown size={14} className="text-red-500" />}
            <p className="text-xs text-gray-500">Resultado del mes</p>
          </div>
          <p className={`text-2xl font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(Math.abs(profit))}</p>
          <p className={`text-xs mt-1 font-medium ${profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>{profit >= 0 ? 'Ganancia' : 'Pérdida'}</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500 mb-1">Total gastos año</p>
          <p className="text-2xl font-bold text-gray-700">{fmt(totalYear)}</p>
          <p className="text-xs text-gray-400 mt-1">{new Date().getFullYear()}</p>
        </div>
      </div>

      {/* Category breakdown */}
      {Object.keys(byCategory).length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Gastos del mes por categoría</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {(Object.entries(byCategory) as [ExpenseCategory, number][])
              .sort((a, b) => b[1] - a[1])
              .map(([cat, amount]) => {
                const { label, emoji, color } = categoryLabels[cat];
                return (
                  <div key={cat} className="text-center p-2.5 rounded-xl bg-gray-50">
                    <div className="text-xl mb-1">{emoji}</div>
                    <p className="text-xs text-gray-500 truncate">{label}</p>
                    <p className="text-sm font-bold text-gray-800">{fmt(amount)}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${color}`}>
                      {totalMonth > 0 ? Math.round(amount / totalMonth * 100) : 0}%
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Filters + add button */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
            <input className="input-field pl-9" placeholder="Buscar descripción o proveedor..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="input-field sm:w-40" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
            <option value="">Todas las categorías</option>
            {(Object.entries(categoryLabels) as [ExpenseCategory, typeof categoryLabels[ExpenseCategory]][]).map(([k, v]) => (
              <option key={k} value={k}>{v.emoji} {v.label}</option>
            ))}
          </select>
          <input type="date" className="input-field sm:w-36" value={dateFrom} onChange={e => setDateFrom(e.target.value)} placeholder="Desde" />
          <input type="date" className="input-field sm:w-36" value={dateTo} onChange={e => setDateTo(e.target.value)} placeholder="Hasta" />
          <button onClick={openNew} className="btn-primary flex items-center gap-2 whitespace-nowrap">
            <Plus size={16} /> Registrar Gasto
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">{filtered.length} registros · Total: {fmt(filtered.reduce((s, e) => s + e.amount, 0))}</p>
      </div>

      {/* Table */}
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Fecha</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Descripción</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium hidden sm:table-cell">Categoría</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium hidden md:table-cell">Proveedor</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium hidden lg:table-cell">Método</th>
              <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium">Monto</th>
              <th className="text-center px-4 py-3 text-xs text-gray-500 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map(expense => {
              const cat = categoryLabels[expense.category];
              return (
                <tr key={expense.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                    {format(parseISO(expense.date), 'dd/MM/yyyy HH:mm')}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800 text-sm">{expense.description}</p>
                    {expense.notes && <p className="text-xs text-gray-400 truncate max-w-xs">{expense.notes}</p>}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${cat.color}`}>
                      {cat.emoji} {cat.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-xs text-gray-600">{expense.provider || '—'}</td>
                  <td className="px-4 py-3 hidden lg:table-cell text-xs text-gray-600">{methodLabel[expense.method]}</td>
                  <td className="px-4 py-3 text-right font-bold text-red-600">{fmt(expense.amount)}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => openEdit(expense)} className="p-1.5 hover:bg-blue-50 rounded text-blue-500" title="Editar">
                        <Pencil size={14} />
                      </button>
                      {isAdmin && (
                        <button onClick={() => handleDelete(expense)} className="p-1.5 hover:bg-red-50 rounded text-red-400" title="Eliminar">
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
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <DollarSign size={32} className="mx-auto mb-2 opacity-30" />
            <p>No hay gastos registrados</p>
            <button onClick={openNew} className="mt-3 text-orange-500 text-sm underline">Registrar primer gasto</button>
          </div>
        )}
      </div>

      {/* Add/Edit modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-bold text-gray-800">{editing ? 'Editar Gasto' : 'Registrar Gasto'}</h3>
              <button onClick={() => setShowModal(false)}><X size={20} className="text-gray-400" /></button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Fecha y hora</label>
                <input
                  type="datetime-local"
                  className="input-field"
                  value={typeof form.date === 'string' ? form.date.slice(0, 16) : ''}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Descripción *</label>
                <input
                  className="input-field"
                  placeholder="Ej: Compra de hojas de plátano..."
                  value={form.description ?? ''}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Categoría</label>
                  <select className="input-field" value={form.category ?? 'insumos'} onChange={e => setForm(f => ({ ...f, category: e.target.value as ExpenseCategory }))}>
                    {(Object.entries(categoryLabels) as [ExpenseCategory, typeof categoryLabels[ExpenseCategory]][]).map(([k, v]) => (
                      <option key={k} value={k}>{v.emoji} {v.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Monto *</label>
                  <input
                    type="number"
                    className="input-field"
                    placeholder="0"
                    value={form.amount || ''}
                    onChange={e => setForm(f => ({ ...f, amount: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Proveedor</label>
                  <input
                    className="input-field"
                    placeholder="Opcional..."
                    value={form.provider ?? ''}
                    onChange={e => setForm(f => ({ ...f, provider: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Método de pago</label>
                  <select className="input-field" value={form.method ?? 'efectivo'} onChange={e => setForm(f => ({ ...f, method: e.target.value as PaymentMethod }))}>
                    <option value="efectivo">Efectivo</option>
                    <option value="nequi">Nequi</option>
                    <option value="daviplata">Daviplata</option>
                    <option value="transferencia">Transferencia</option>
                    <option value="tarjeta">Tarjeta</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Notas</label>
                <textarea
                  className="input-field text-xs resize-none h-16"
                  placeholder="Notas adicionales..."
                  value={form.notes ?? ''}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowModal(false)} className="btn-secondary flex-1 text-sm">Cancelar</button>
                <button
                  onClick={handleSave}
                  disabled={saving || !form.description?.trim() || !form.amount}
                  className="btn-primary flex-1 text-sm disabled:opacity-50"
                >
                  {saving ? 'Guardando...' : editing ? 'Guardar Cambios' : 'Registrar Gasto'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
