import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { fmt, fmtDateTime } from '../utils/helpers';
import {
  TrendingUp, ShoppingCart, AlertCircle, Package,
  Clock, ArrowRight, Truck
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar
} from 'recharts';
import { format, subDays, isToday, isYesterday, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export default function Dashboard() {
  const { state } = useApp();
  const navigate = useNavigate();

  const stats = useMemo(() => {
    const today = state.orders.filter(o => isToday(parseISO(o.createdAt)));
    const yesterday = state.orders.filter(o => isYesterday(parseISO(o.createdAt)));
    const todaySales = today.reduce((s, o) => s + o.finalTotal, 0);
    const yesterdaySales = yesterday.reduce((s, o) => s + o.finalTotal, 0);
    const salesGrowth = yesterdaySales ? ((todaySales - yesterdaySales) / yesterdaySales) * 100 : 0;

    const allOwing = state.customers.filter(c => c.balance < 0);
    const totalOwed = allOwing.reduce((s, c) => s + Math.abs(c.balance), 0);

    const pendingOrders = state.orders.filter(o => o.status === 'pendiente' || o.status === 'en_preparacion');
    const pendingDeliveries = state.deliveries.filter(d => d.status === 'pendiente' || d.status === 'en_camino');

    const last7 = Array.from({ length: 7 }, (_, i) => {
      const d = subDays(new Date(), 6 - i);
      const key = format(d, 'yyyy-MM-dd');
      const dayOrders = state.orders.filter(o => o.createdAt.startsWith(key));
      return {
        day: format(d, 'EEE', { locale: es }),
        ventas: dayOrders.reduce((s, o) => s + o.finalTotal, 0),
        pedidos: dayOrders.length,
      };
    });

    const productSales: Record<string, number> = {};
    state.orders.forEach(o => {
      if (!isToday(parseISO(o.createdAt)) && subDays(new Date(), 30) > parseISO(o.createdAt)) return;
      o.items.forEach(it => {
        productSales[it.productName] = (productSales[it.productName] || 0) + it.quantity;
      });
    });
    const topProducts = Object.entries(productSales)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, qty]) => ({ name: name.replace('Tamal de ', '').replace('Tamal ', ''), qty }));

    return { todaySales, salesGrowth, allOwing, totalOwed, pendingOrders, pendingDeliveries, last7, topProducts, todayCount: today.length };
  }, [state]);

  const recentOrders = state.orders.slice(0, 6);

  return (
    <div className="space-y-5">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={<ShoppingCart className="text-orange-600" size={22} />}
          bg="bg-orange-50"
          label="Ventas Hoy"
          value={fmt(stats.todaySales)}
          sub={`${stats.todayCount} pedidos · ${stats.salesGrowth >= 0 ? '+' : ''}${stats.salesGrowth.toFixed(0)}% vs ayer`}
          color="text-orange-600"
        />
        <KpiCard
          icon={<AlertCircle className="text-red-500" size={22} />}
          bg="bg-red-50"
          label="Por Cobrar"
          value={fmt(stats.totalOwed)}
          sub={`${stats.allOwing.length} clientes deben`}
          color="text-red-600"
          onClick={() => navigate('/accounts')}
        />
        <KpiCard
          icon={<Clock className="text-amber-500" size={22} />}
          bg="bg-amber-50"
          label="Pendientes"
          value={String(stats.pendingOrders.length)}
          sub="pedidos en proceso"
          color="text-amber-600"
          onClick={() => navigate('/orders')}
        />
        <KpiCard
          icon={<Truck className="text-blue-500" size={22} />}
          bg="bg-blue-50"
          label="Entregas"
          value={String(stats.pendingDeliveries.length)}
          sub="por entregar hoy"
          color="text-blue-600"
          onClick={() => navigate('/deliveries')}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Sales trend */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">Ventas Últimos 7 Días</h3>
            <TrendingUp size={18} className="text-orange-500" />
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={stats.last7}>
              <defs>
                <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ea580c" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ea580c" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: unknown) => [fmt(Number(v)), 'Ventas']} />
              <Area type="monotone" dataKey="ventas" stroke="#ea580c" fill="url(#salesGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Top products */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">Top Productos (30d)</h3>
            <Package size={18} className="text-orange-500" />
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={stats.topProducts} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={60} />
              <Tooltip formatter={(v: unknown) => [Number(v), 'Unidades']} />
              <Bar dataKey="qty" fill="#ea580c" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent orders */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800">Pedidos Recientes</h3>
            <button onClick={() => navigate('/orders')} className="text-xs text-orange-600 hover:underline flex items-center gap-1">
              Ver todos <ArrowRight size={12} />
            </button>
          </div>
          <div className="space-y-2">
            {recentOrders.map(order => (
              <div key={order.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center text-sm">🌽</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{order.customerName}</p>
                  <p className="text-xs text-gray-500">{fmtDateTime(order.createdAt)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-gray-800">{fmt(order.finalTotal)}</p>
                  <span className={`badge-${order.status === 'entregado' ? 'gray' : order.status === 'pendiente' ? 'warning' : 'info'} text-[10px]`}>
                    {order.status === 'entregado' ? 'Entregado' : order.status === 'pendiente' ? 'Pendiente' : 'En Prep.'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Debtors */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800">Clientes que Deben</h3>
            <button onClick={() => navigate('/accounts')} className="text-xs text-orange-600 hover:underline flex items-center gap-1">
              Ver todos <ArrowRight size={12} />
            </button>
          </div>
          <div className="space-y-2">
            {stats.allOwing.slice(0, 6).map(c => (
              <div key={c.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center text-sm font-bold text-red-600">
                  {c.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{c.name}</p>
                  <p className="text-xs text-gray-500">{c.phone}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-red-600">{fmt(Math.abs(c.balance))}</p>
                  <p className="text-xs text-gray-400">debe</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="card">
        <h3 className="font-semibold text-gray-800 mb-3">Acciones Rápidas</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Nueva Venta', icon: '💰', to: '/pos', color: 'bg-orange-50 hover:bg-orange-100 text-orange-700' },
            { label: 'Ver Pedidos', icon: '📦', to: '/orders', color: 'bg-blue-50 hover:bg-blue-100 text-blue-700' },
            { label: 'Entregas', icon: '🚚', to: '/deliveries', color: 'bg-green-50 hover:bg-green-100 text-green-700' },
            { label: 'Reportes', icon: '📊', to: '/reports', color: 'bg-purple-50 hover:bg-purple-100 text-purple-700' },
          ].map(a => (
            <button key={a.to} onClick={() => navigate(a.to)}
              className={`${a.color} rounded-xl p-4 text-center font-medium text-sm transition-colors`}>
              <div className="text-2xl mb-1">{a.icon}</div>
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ icon, bg, label, value, sub, color, onClick }: {
  icon: React.ReactNode; bg: string; label: string; value: string;
  sub: string; color: string; onClick?: () => void;
}) {
  return (
    <div className={`card flex flex-col gap-2 ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`} onClick={onClick}>
      <div className="flex items-center justify-between">
        <div className={`${bg} p-2 rounded-lg`}>{icon}</div>
      </div>
      <div>
        <p className={`text-xl font-bold ${color}`}>{value}</p>
        <p className="text-xs text-gray-500 mt-0.5 font-medium">{label}</p>
        <p className="text-xs text-gray-400">{sub}</p>
      </div>
    </div>
  );
}
