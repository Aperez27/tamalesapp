import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { fmt, fmtDate } from '../utils/helpers';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO, isWithinInterval } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Download, Printer } from 'lucide-react';

type Period = 'hoy' | 'semana' | 'mes' | 'personalizado';

export default function Reports() {
  const { state } = useApp();
  const [period, setPeriod] = useState<Period>('mes');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-01'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const range = useMemo(() => {
    const now = new Date();
    switch (period) {
      case 'hoy':    return { start: startOfDay(now), end: endOfDay(now) };
      case 'semana': return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
      case 'mes':    return { start: startOfMonth(now), end: endOfMonth(now) };
      default:       return { start: startOfDay(parseISO(startDate)), end: endOfDay(parseISO(endDate)) };
    }
  }, [period, startDate, endDate]);

  const filteredOrders = useMemo(() =>
    state.orders.filter(o => isWithinInterval(parseISO(o.createdAt), range)),
    [state.orders, range]
  );

  const stats = useMemo(() => {
    const totalRevenue = filteredOrders.reduce((s, o) => s + o.finalTotal, 0);
    const totalCollected = filteredOrders.reduce((s, o) => s + o.amountPaid, 0);
    const totalPending = filteredOrders.reduce((s, o) => s + o.balance, 0);
    const totalOrders = filteredOrders.length;
    const avgTicket = totalOrders ? totalRevenue / totalOrders : 0;
    const deliveredOrders = filteredOrders.filter(o => o.status === 'entregado').length;
    const cancelledOrders = filteredOrders.filter(o => o.status === 'cancelado').length;

    const productSales: Record<string, { qty: number; revenue: number }> = {};
    filteredOrders.forEach(o => {
      o.items.forEach(it => {
        if (!productSales[it.productName]) productSales[it.productName] = { qty: 0, revenue: 0 };
        productSales[it.productName].qty += it.quantity;
        productSales[it.productName].revenue += it.subtotal;
      });
    });

    const topProducts = Object.entries(productSales)
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .map(([name, s]) => ({ name: name.replace('Tamal de ', '').replace('Tamal ', ''), ...s }));

    const methodRevenue: Record<string, number> = {};
    filteredOrders.forEach(o => {
      methodRevenue[o.paymentMethod] = (methodRevenue[o.paymentMethod] || 0) + o.finalTotal;
    });

    const totalUnits = Object.values(productSales).reduce((s, p) => s + p.qty, 0);

    return { totalRevenue, totalCollected, totalPending, totalOrders, avgTicket, deliveredOrders, cancelledOrders, topProducts, methodRevenue, totalUnits };
  }, [filteredOrders]);

  function printReport() { window.print(); }

  function exportCSV() {
    const rows = [
      ['ID', 'Fecha', 'Cliente', 'Productos', 'Total', 'Pagado', 'Saldo', 'Estado', 'Pago'],
      ...filteredOrders.map(o => [
        o.id, fmtDate(o.createdAt), o.customerName,
        o.items.map(i => `${i.quantity}x ${i.productName}`).join(' | '),
        o.finalTotal, o.amountPaid, o.balance, o.status, o.paymentStatus
      ])
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `reporte_tamales_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4" id="print-area">
      {/* Controls */}
      <div className="card no-print">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex gap-2 flex-wrap">
            {(['hoy', 'semana', 'mes', 'personalizado'] as Period[]).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors capitalize ${period === p ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                {p === 'hoy' ? 'Hoy' : p === 'semana' ? 'Esta Semana' : p === 'mes' ? 'Este Mes' : 'Personalizado'}
              </button>
            ))}
          </div>
          {period === 'personalizado' && (
            <div className="flex items-center gap-2">
              <input type="date" className="input-field h-8 text-xs" value={startDate} onChange={e => setStartDate(e.target.value)} />
              <span className="text-gray-400 text-xs">a</span>
              <input type="date" className="input-field h-8 text-xs" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          )}
          <div className="ml-auto flex gap-2">
            <button onClick={exportCSV} className="btn-secondary text-xs flex items-center gap-1">
              <Download size={14} /> CSV
            </button>
            <button onClick={printReport} className="btn-secondary text-xs flex items-center gap-1">
              <Printer size={14} /> Imprimir
            </button>
          </div>
        </div>
      </div>

      {/* Print header */}
      <div className="hidden print:block text-center mb-4">
        <h1 className="text-2xl font-bold">🌽 TamalesApp — Reporte de Ventas</h1>
        <p className="text-gray-500">Período: {fmtDate(range.start.toISOString())} — {fmtDate(range.end.toISOString())}</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Ventas Totales', value: fmt(stats.totalRevenue), sub: `${stats.totalOrders} pedidos`, color: 'text-orange-600' },
          { label: 'Recaudado', value: fmt(stats.totalCollected), sub: 'cobrado efectivo', color: 'text-green-600' },
          { label: 'Pendiente Cobro', value: fmt(stats.totalPending), sub: 'por recuperar', color: 'text-red-600' },
          { label: 'Ticket Promedio', value: fmt(stats.avgTicket), sub: `${stats.totalUnits} unidades vendidas`, color: 'text-blue-600' },
        ].map(s => (
          <div key={s.label} className="card">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-400">{s.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Product breakdown */}
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-3">Ventas por Producto</h3>
          {stats.topProducts.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={stats.topProducts.slice(0, 6)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={65} />
                  <Tooltip formatter={(v: unknown) => [fmt(Number(v)), 'Ingresos']} />
                  <Bar dataKey="revenue" fill="#ea580c" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-3 space-y-1">
                {stats.topProducts.slice(0, 8).map(p => (
                  <div key={p.name} className="flex items-center gap-2 text-xs">
                    <span className="text-gray-600 w-32 truncate">{p.name}</span>
                    <div className="flex-1 bg-gray-100 rounded h-1.5">
                      <div className="bg-orange-400 h-1.5 rounded" style={{ width: `${(p.revenue / stats.totalRevenue) * 100}%` }} />
                    </div>
                    <span className="font-medium text-gray-700 w-10 text-right">{p.qty}</span>
                    <span className="text-gray-500 w-16 text-right">{fmt(p.revenue)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-gray-400 text-sm text-center py-8">Sin datos para este período</p>
          )}
        </div>

        {/* Payment methods */}
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-3">Métodos de Pago</h3>
          {Object.keys(stats.methodRevenue).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(stats.methodRevenue)
                .sort((a, b) => b[1] - a[1])
                .map(([method, amount]) => (
                  <div key={method} className="flex items-center gap-3">
                    <span className="text-lg">{method === 'efectivo' ? '💵' : method === 'nequi' ? '📱' : method === 'daviplata' ? '📱' : method === 'fiado' ? '📝' : '🏦'}</span>
                    <div className="flex-1">
                      <div className="flex justify-between text-sm mb-0.5">
                        <span className="capitalize text-gray-700">{method}</span>
                        <span className="font-medium">{fmt(amount)}</span>
                      </div>
                      <div className="bg-gray-100 rounded-full h-1.5">
                        <div className="bg-orange-500 h-1.5 rounded-full" style={{ width: `${(amount / stats.totalRevenue) * 100}%` }} />
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 w-10 text-right">{((amount / stats.totalRevenue) * 100).toFixed(0)}%</span>
                  </div>
                ))
              }
            </div>
          ) : (
            <p className="text-gray-400 text-sm text-center py-8">Sin datos</p>
          )}

          <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-3 text-center">
            <div>
              <p className="text-2xl font-bold text-green-600">{stats.deliveredOrders}</p>
              <p className="text-xs text-gray-500">Entregados</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{stats.cancelledOrders}</p>
              <p className="text-xs text-gray-500">Cancelados</p>
            </div>
          </div>
        </div>
      </div>

      {/* Orders detail table */}
      <div className="card overflow-x-auto p-0">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">Detalle de Pedidos</h3>
          <p className="text-xs text-gray-400">{filteredOrders.length} registros</p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-2.5 text-xs text-gray-500">Fecha</th>
              <th className="text-left px-4 py-2.5 text-xs text-gray-500">Cliente</th>
              <th className="text-left px-4 py-2.5 text-xs text-gray-500 hidden md:table-cell">Productos</th>
              <th className="text-right px-4 py-2.5 text-xs text-gray-500">Total</th>
              <th className="text-right px-4 py-2.5 text-xs text-gray-500 hidden sm:table-cell">Cobrado</th>
              <th className="text-center px-4 py-2.5 text-xs text-gray-500">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filteredOrders.slice(0, 50).map(o => (
              <tr key={o.id} className="hover:bg-gray-50">
                <td className="px-4 py-2 text-xs text-gray-500">{fmtDate(o.createdAt)}</td>
                <td className="px-4 py-2 text-sm font-medium text-gray-700">{o.customerName}</td>
                <td className="px-4 py-2 text-xs text-gray-500 hidden md:table-cell max-w-xs truncate">
                  {o.items.map(i => `${i.quantity}x ${i.productName.replace('Tamal de ', '')}`).join(', ')}
                </td>
                <td className="px-4 py-2 text-right font-semibold">{fmt(o.finalTotal)}</td>
                <td className="px-4 py-2 text-right text-green-600 hidden sm:table-cell">{fmt(o.amountPaid)}</td>
                <td className="px-4 py-2 text-center">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    o.paymentStatus === 'pagado' ? 'bg-green-100 text-green-700' :
                    o.paymentStatus === 'fiado' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>{o.paymentStatus}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredOrders.length > 50 && (
          <p className="text-xs text-gray-400 text-center py-3">Mostrando 50 de {filteredOrders.length}. Exporta CSV para ver todos.</p>
        )}
        {filteredOrders.length === 0 && (
          <p className="text-gray-400 text-center py-12">No hay pedidos en este período</p>
        )}
      </div>
    </div>
  );
}
