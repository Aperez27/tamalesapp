import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { fmt, fmtDateTime, genId } from '../utils/helpers';
import { api } from '../api/client';
import type { PaymentMethod } from '../types';
import { CheckCircle, CreditCard, X, TrendingDown, DollarSign } from 'lucide-react';

export default function Accounts() {
  const { state, dispatch } = useApp();
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('efectivo');
  const [tab, setTab] = useState<'deben' | 'historial'>('deben');

  const debtors = useMemo(() =>
    state.customers
      .filter(c => c.balance < 0)
      .sort((a, b) => a.balance - b.balance),
    [state.customers]
  );

  const totalDebt = debtors.reduce((s, c) => s + Math.abs(c.balance), 0);

  const selectedCustomer = selectedCustomerId ? state.customers.find(c => c.id === selectedCustomerId) : null;

  const customerPendingOrders = useMemo(() => {
    if (!selectedCustomerId) return [];
    return state.orders.filter(o => o.customerId === selectedCustomerId && o.balance > 0);
  }, [selectedCustomerId, state.orders]);

  const recentPayments = useMemo(() =>
    state.payments.slice(0, 50),
    [state.payments]
  );

  async function registerPayment(orderId?: string) {
    if (!selectedCustomerId || !payAmount) return;
    const amount = parseFloat(payAmount);
    const customer = state.customers.find(c => c.id === selectedCustomerId)!;
    const payment = {
      id: genId('pay'), customerId: selectedCustomerId, customerName: customer.name,
      orderId, amount, method: payMethod, date: new Date().toISOString(), notes: 'Abono de cartera',
    };
    await api.createPayment(payment);
    dispatch({ type: 'ADD_PAYMENT', payload: payment });
    setPayAmount('');
    setSelectedCustomerId(null);
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card sm:col-span-2">
          <div className="flex items-center gap-3 mb-1">
            <div className="bg-red-100 p-2 rounded-lg"><TrendingDown className="text-red-600" size={22} /></div>
            <div>
              <p className="text-2xl font-bold text-red-600">{fmt(totalDebt)}</p>
              <p className="text-xs text-gray-500">Total cartera por cobrar</p>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">{debtors.length} clientes con saldo pendiente</p>
        </div>
        <div className="card">
          <div className="flex items-center gap-3 mb-1">
            <div className="bg-green-100 p-2 rounded-lg"><DollarSign className="text-green-600" size={22} /></div>
            <div>
              <p className="text-2xl font-bold text-green-600">
                {fmt(state.payments.reduce((s, p) => s + p.amount, 0))}
              </p>
              <p className="text-xs text-gray-500">Total recaudado (histórico)</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[
          { key: 'deben', label: `💸 Deben (${debtors.length})` },
          { key: 'historial', label: '📋 Historial Pagos' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as typeof tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? 'bg-orange-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'deben' && (
        <div className="space-y-3">
          {debtors.length === 0 ? (
            <div className="card text-center py-12">
              <CheckCircle size={40} className="text-green-400 mx-auto mb-2" />
              <p className="text-gray-500 font-medium">¡Todos los clientes están al día!</p>
            </div>
          ) : debtors.map(c => (
            <div key={c.id} className="card">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center font-bold text-red-600">
                    {c.name[0]}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">{c.name}</p>
                    <p className="text-xs text-gray-500">{c.phone} · {c.neighborhood}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Debe</p>
                    <p className="font-bold text-red-600 text-lg">{fmt(Math.abs(c.balance))}</p>
                  </div>
                  <button onClick={() => { setSelectedCustomerId(c.id); setPayAmount(String(Math.abs(c.balance))); }}
                    className="btn-primary text-sm flex items-center gap-1">
                    <CreditCard size={14} /> Cobrar
                  </button>
                </div>
              </div>

              {/* Pending orders for this customer */}
              {state.orders.filter(o => o.customerId === c.id && o.balance > 0).slice(0, 3).map(o => (
                <div key={o.id} className="mt-2 pl-13 ml-13 border-t border-gray-50 pt-2 flex items-center justify-between text-xs">
                  <div className="ml-13 pl-13">
                    <p className="text-gray-500">Pedido #{o.id.slice(-6)} · {new Date(o.createdAt).toLocaleDateString('es-CO')}</p>
                    <p className="text-gray-600">{o.items.map(i => `${i.quantity}x ${i.productName.replace('Tamal ', '')}`).join(', ')}</p>
                  </div>
                  <p className="text-red-500 font-medium">Debe: {fmt(o.balance)}</p>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {tab === 'historial' && (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-xs text-gray-500">Fecha</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500">Cliente</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 hidden sm:table-cell">Método</th>
                <th className="text-right px-4 py-3 text-xs text-gray-500">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recentPayments.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-xs text-gray-500">{fmtDateTime(p.date)}</td>
                  <td className="px-4 py-2 text-sm font-medium text-gray-700">{p.customerName}</td>
                  <td className="px-4 py-2 text-xs text-gray-500 hidden sm:table-cell capitalize">{p.method}</td>
                  <td className="px-4 py-2 text-right font-semibold text-green-600">{fmt(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Payment modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-bold text-gray-800">Registrar Cobro</h3>
              <button onClick={() => setSelectedCustomerId(null)}><X size={20} className="text-gray-400" /></button>
            </div>
            <div className="p-4 space-y-4">
              <div className="bg-red-50 rounded-xl p-3 text-sm">
                <p className="font-semibold text-gray-800">{selectedCustomer.name}</p>
                <p className="text-red-600 font-bold text-lg">{fmt(Math.abs(selectedCustomer.balance))} por cobrar</p>
              </div>

              {customerPendingOrders.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-2">Pedidos con saldo:</p>
                  {customerPendingOrders.map(o => (
                    <div key={o.id} className="flex items-center justify-between text-xs py-1.5 border-b border-gray-50">
                      <span className="text-gray-600">Pedido #{o.id.slice(-6)} — {new Date(o.createdAt).toLocaleDateString('es-CO')}</span>
                      <span className="font-medium text-red-500">{fmt(o.balance)}</span>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Monto a cobrar</label>
                <input type="number" className="input-field" value={payAmount} onChange={e => setPayAmount(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Método de pago</label>
                <select className="input-field" value={payMethod} onChange={e => setPayMethod(e.target.value as PaymentMethod)}>
                  <option value="efectivo">💵 Efectivo</option>
                  <option value="nequi">📱 Nequi</option>
                  <option value="daviplata">📱 Daviplata</option>
                  <option value="transferencia">🏦 Transferencia</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setSelectedCustomerId(null)} className="btn-secondary flex-1">Cancelar</button>
                <button onClick={() => registerPayment(customerPendingOrders[0]?.id)} className="btn-success flex-1">
                  Registrar Cobro
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
