import { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { fmt } from '../utils/helpers';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { format, subMonths, startOfMonth, endOfMonth, eachMonthOfInterval, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { TrendingUp, TrendingDown, Award, AlertTriangle } from 'lucide-react';

const COLORS = ['#ea580c', '#f97316', '#fb923c', '#fdba74', '#fed7aa', '#fef3c7'];

export default function Intelligence() {
  const { state } = useApp();

  const analysis = useMemo(() => {
    const now = new Date();
    const months = eachMonthOfInterval({ start: subMonths(now, 11), end: now });

    // Monthly sales
    const monthlySales = months.map(m => {
      const start = startOfMonth(m);
      const end = endOfMonth(m);
      const monthOrders = state.orders.filter(o => {
        const d = parseISO(o.createdAt);
        return d >= start && d <= end;
      });
      return {
        month: format(m, 'MMM', { locale: es }),
        ventas: monthOrders.reduce((s, o) => s + o.finalTotal, 0),
        pedidos: monthOrders.length,
        promedio: monthOrders.length ? monthOrders.reduce((s, o) => s + o.finalTotal, 0) / monthOrders.length : 0,
      };
    });

    // Product performance
    const productStats: Record<string, { qty: number; revenue: number; profit: number }> = {};
    state.orders.forEach(o => {
      o.items.forEach(it => {
        if (!productStats[it.productName]) productStats[it.productName] = { qty: 0, revenue: 0, profit: 0 };
        const prod = state.products.find(p => p.id === it.productId);
        const profit = prod ? (it.unitPrice - prod.cost) * it.quantity : 0;
        productStats[it.productName].qty += it.quantity;
        productStats[it.productName].revenue += it.subtotal;
        productStats[it.productName].profit += profit;
      });
    });

    const topByRevenue = Object.entries(productStats)
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 6)
      .map(([name, s]) => ({ name: name.replace('Tamal de ', '').replace('Tamal ', ''), ...s }));

    // Payment method distribution
    const methodCounts: Record<string, number> = {};
    state.orders.forEach(o => { methodCounts[o.paymentMethod] = (methodCounts[o.paymentMethod] || 0) + o.finalTotal; });
    const paymentMix = Object.entries(methodCounts).map(([name, value]) => ({
      name: name === 'efectivo' ? 'Efectivo' : name === 'nequi' ? 'Nequi' : name === 'daviplata' ? 'Daviplata' : name === 'fiado' ? 'Fiado' : 'Transferencia',
      value,
    })).sort((a, b) => b.value - a.value);

    // Day of week analysis
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const byDay: Record<number, { sales: number; count: number }> = {};
    state.orders.forEach(o => {
      const d = parseISO(o.createdAt).getDay();
      if (!byDay[d]) byDay[d] = { sales: 0, count: 0 };
      byDay[d].sales += o.finalTotal;
      byDay[d].count++;
    });
    const dayAnalysis = dayNames.map((name, i) => ({
      name,
      ventas: byDay[i]?.sales || 0,
      pedidos: byDay[i]?.count || 0,
    }));

    // Hour of day
    const byHour: Record<number, number> = {};
    state.orders.forEach(o => {
      const h = parseISO(o.createdAt).getHours();
      byHour[h] = (byHour[h] || 0) + 1;
    });
    const hourAnalysis = Array.from({ length: 24 }, (_, h) => ({
      hora: `${h}h`,
      pedidos: byHour[h] || 0,
    })).filter(h => h.pedidos > 0);

    // Growth
    const thisMonth = monthlySales[monthlySales.length - 1];
    const lastMonth = monthlySales[monthlySales.length - 2];
    const growth = lastMonth?.ventas ? ((thisMonth.ventas - lastMonth.ventas) / lastMonth.ventas) * 100 : 0;

    // Top customers
    const topCustomers = state.customers
      .sort((a, b) => b.totalPurchases - a.totalPurchases)
      .slice(0, 5);

    // Fiado risk
    const totalFiado = state.orders.filter(o => o.paymentStatus === 'fiado' || o.paymentStatus === 'parcial')
      .reduce((s, o) => s + o.balance, 0);

    // Total revenue, profit
    const totalRevenue = state.orders.reduce((s, o) => s + o.finalTotal, 0);
    const totalProfit = Object.values(productStats).reduce((s, p) => s + p.profit, 0);
    const margin = totalRevenue ? (totalProfit / totalRevenue) * 100 : 0;

    return { monthlySales, topByRevenue, paymentMix, dayAnalysis, hourAnalysis, growth, topCustomers, totalFiado, totalRevenue, totalProfit, margin, thisMonth };
  }, [state]);

  const InsightCard = ({ icon, title, value, sub, color }: { icon: React.ReactNode; title: string; value: string; sub: string; color: string }) => (
    <div className="card">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${color}`}>{icon}</div>
        <div>
          <p className="text-xs text-gray-500">{title}</p>
          <p className="text-xl font-bold text-gray-800">{value}</p>
          <p className="text-xs text-gray-500">{sub}</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Intelligence header */}
      <div className="bg-gradient-to-r from-orange-800 to-orange-600 rounded-2xl p-5 text-white">
        <h2 className="text-xl font-bold mb-1">Inteligencia de Negocio</h2>
        <p className="text-orange-200 text-sm">Análisis basado en {state.orders.length.toLocaleString()} pedidos · Último año</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <InsightCard icon={<TrendingUp size={20} className="text-green-700" />} title="Ingresos Totales" value={fmt(analysis.totalRevenue)} sub="Último año completo" color="bg-green-100" />
        <InsightCard icon={<Award size={20} className="text-orange-700" />} title="Ganancia Estimada" value={fmt(analysis.totalProfit)} sub={`Margen: ${analysis.margin.toFixed(1)}%`} color="bg-orange-100" />
        <InsightCard
          icon={analysis.growth >= 0 ? <TrendingUp size={20} className="text-blue-700" /> : <TrendingDown size={20} className="text-red-700" />}
          title="Crecimiento" value={`${analysis.growth >= 0 ? '+' : ''}${analysis.growth.toFixed(1)}%`}
          sub="vs mes anterior" color={analysis.growth >= 0 ? "bg-blue-100" : "bg-red-100"}
        />
        <InsightCard icon={<AlertTriangle size={20} className="text-red-700" />} title="Cartera en Riesgo" value={fmt(analysis.totalFiado)} sub="Fiados y parciales" color="bg-red-100" />
      </div>

      {/* Monthly trend */}
      <div className="card">
        <h3 className="font-semibold text-gray-800 mb-4">Tendencia de Ventas — 12 Meses</h3>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={analysis.monthlySales}>
            <defs>
              <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ea580c" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#ea580c" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v: unknown) => [fmt(Number(v)), 'Ventas']} />
            <Area type="monotone" dataKey="ventas" stroke="#ea580c" fill="url(#g1)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Product performance & payment mix */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-4">Ingresos por Producto</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={analysis.topByRevenue} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={65} />
              <Tooltip formatter={(v: unknown) => [fmt(Number(v)), 'Ingresos']} />
              <Bar dataKey="revenue" fill="#ea580c" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-4">Métodos de Pago</h3>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={analysis.paymentMix} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={35}>
                  {analysis.paymentMix.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: unknown) => [fmt(Number(v)), '']} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1.5 shrink-0">
              {analysis.paymentMix.map((m, i) => (
                <div key={m.name} className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="text-gray-600">{m.name}</span>
                  <span className="font-medium ml-auto">{((m.value / analysis.totalRevenue) * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Day of week & hours */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-1">Ventas por Día de Semana</h3>
          <p className="text-xs text-gray-400 mb-4">Identifica tus mejores días</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={analysis.dayAnalysis}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: unknown) => [fmt(Number(v)), 'Ventas']} />
              <Bar dataKey="ventas" fill="#f97316" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-1">Horarios de Mayor Demanda</h3>
          <p className="text-xs text-gray-400 mb-4">Optimiza tu producción</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={analysis.hourAnalysis}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="hora" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: unknown) => [Number(v), 'Pedidos']} />
              <Bar dataKey="pedidos" fill="#fb923c" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top customers */}
      <div className="card">
        <h3 className="font-semibold text-gray-800 mb-4">🏆 Mejores Clientes</h3>
        <div className="space-y-3">
          {analysis.topCustomers.map((c, i) => (
            <div key={c.id} className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm text-white ${i === 0 ? 'bg-yellow-500' : i === 1 ? 'bg-gray-400' : i === 2 ? 'bg-amber-700' : 'bg-gray-200 text-gray-600'}`}>
                {i + 1}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-800">{c.name}</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                    <div className="bg-orange-500 h-1.5 rounded-full" style={{ width: `${(c.totalPurchases / analysis.topCustomers[0].totalPurchases) * 100}%` }} />
                  </div>
                </div>
              </div>
              <p className="font-bold text-orange-600 text-sm">{fmt(c.totalPurchases)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* AI Insights */}
      <div className="card bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
        <h3 className="font-semibold text-orange-800 mb-3 flex items-center gap-2">
          <span className="text-lg">🤖</span> Recomendaciones del Sistema
        </h3>
        <div className="space-y-2">
          {analysis.growth > 10 && (
            <Insight type="success" text="¡Excelente! Las ventas están creciendo más de 10% vs el mes pasado. Considera aumentar producción." />
          )}
          {analysis.growth < -10 && (
            <Insight type="warning" text="Atención: Las ventas bajaron más de 10% vs el mes anterior. Revisa estrategia de precios o promociones." />
          )}
          {analysis.totalFiado > 500000 && (
            <Insight type="danger" text={`Cartera en riesgo alta: ${fmt(analysis.totalFiado)}. Se recomienda implementar límites de crédito.`} />
          )}
          {analysis.margin < 40 && (
            <Insight type="warning" text={`Margen de ganancia del ${analysis.margin.toFixed(0)}% está por debajo del 40% recomendado. Revisa costos de producción.`} />
          )}
          {analysis.paymentMix.find(p => p.name === 'Fiado') && (() => {
            const fiado = analysis.paymentMix.find(p => p.name === 'Fiado')!;
            const pct = (fiado.value / analysis.totalRevenue) * 100;
            if (pct > 20) return <Insight type="warning" text={`El ${pct.toFixed(0)}% de las ventas son fiadas. Considera reducir esta práctica o cobrar intereses.`} />;
            return null;
          })()}
          <Insight type="info" text={`Tu día más rentable es ${analysis.dayAnalysis.sort((a,b) => b.ventas - a.ventas)[0]?.name}. Asegura stock suficiente ese día.`} />
          <Insight type="info" text={`El producto estrella es "${analysis.topByRevenue[0]?.name}". Mantén siempre disponibilidad.`} />
        </div>
      </div>
    </div>
  );
}

function Insight({ type, text }: { type: 'success' | 'warning' | 'danger' | 'info'; text: string }) {
  const styles = {
    success: 'bg-green-50 border-green-200 text-green-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    danger: 'bg-red-50 border-red-200 text-red-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  };
  const icons = { success: '✅', warning: '⚠️', danger: '🚨', info: '💡' };
  return (
    <div className={`flex items-start gap-2 p-2.5 rounded-lg border text-sm ${styles[type]}`}>
      <span>{icons[type]}</span>
      <span>{text}</span>
    </div>
  );
}
