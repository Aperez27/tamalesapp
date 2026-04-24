import { useState, useMemo, useRef, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingCart, Package, Users, Truck,
  BarChart3, CreditCard, Settings, Menu, X, ChevronRight,
  TrendingUp, LogOut, Package2, Receipt, Bell, AlertTriangle,
  Clock, Banknote, CheckCircle, Map, Building2, ShoppingBag, Wallet,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { fmt } from '../utils/helpers';
import { differenceInHours, isToday, parseISO } from 'date-fns';

// ─── Role config ──────────────────────────────────────────────────────────────
const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  admin:      { label: 'Admin',      color: 'bg-orange-500 text-white' },
  cajero:     { label: 'Cajero',     color: 'bg-blue-500 text-white' },
  repartidor: { label: 'Repartidor', color: 'bg-green-500 text-white' },
  contador:   { label: 'Contador',   color: 'bg-purple-500 text-white' },
};

const ROLE_ROUTES: Record<string, string[]> = {
  admin:      ['/', '/pos', '/orders', '/deliveries', '/route-map', '/customers', '/accounts', '/intelligence', '/reports', '/products', '/expenses', '/suppliers', '/purchases', '/payroll', '/settings'],
  cajero:     ['/', '/pos', '/orders', '/deliveries', '/route-map', '/customers', '/settings'],
  repartidor: ['/deliveries', '/route-map', '/settings'],
  contador:   ['/', '/accounts', '/expenses', '/intelligence', '/reports', '/settings'],
};

const ALL_NAV = [
  { to: '/',             icon: LayoutDashboard, label: 'Dashboard',      exact: true },
  { to: '/pos',          icon: ShoppingCart,    label: 'Nueva Venta' },
  { to: '/orders',       icon: Package,         label: 'Pedidos' },
  { to: '/deliveries',   icon: Truck,           label: 'Entregas' },
  { to: '/route-map',    icon: Map,             label: 'Mapa de Rutas' },
  { to: '/customers',    icon: Users,           label: 'Clientes' },
  { to: '/accounts',     icon: CreditCard,      label: 'Cuentas' },
  { to: '/intelligence', icon: TrendingUp,      label: 'Inteligencia' },
  { to: '/reports',      icon: BarChart3,       label: 'Reportes' },
  { to: '/products',     icon: Package2,        label: 'Productos' },
  { to: '/expenses',     icon: Receipt,         label: 'Gastos' },
  { to: '/suppliers',    icon: Building2,       label: 'Proveedores' },
  { to: '/purchases',    icon: ShoppingBag,     label: 'Compras' },
  { to: '/payroll',      icon: Wallet,          label: 'Nómina' },
  { to: '/settings',     icon: Settings,        label: 'Configuración' },
];

// ─── Notification bell ────────────────────────────────────────────────────────
function NotificationBell() {
  const { state } = useApp();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const alerts = useMemo(() => {
    const list: { type: 'warning' | 'danger' | 'info'; title: string; detail: string; link: string }[] = [];

    // Pedidos pendientes > 3h sin actualizar
    const staleOrders = state.orders.filter(o =>
      o.status === 'pendiente' &&
      differenceInHours(new Date(), parseISO(o.updatedAt)) >= 3
    );
    if (staleOrders.length > 0) {
      list.push({
        type: 'warning',
        title: `${staleOrders.length} pedido${staleOrders.length > 1 ? 's' : ''} pendiente${staleOrders.length > 1 ? 's' : ''} +3h`,
        detail: staleOrders.slice(0, 2).map(o => o.customerName).join(', ') + (staleOrders.length > 2 ? '…' : ''),
        link: '/orders',
      });
    }

    // Pedidos entregados con saldo > 0
    const unpaidDelivered = state.orders.filter(o => o.status === 'entregado' && o.balance > 0);
    if (unpaidDelivered.length > 0) {
      const total = unpaidDelivered.reduce((s, o) => s + o.balance, 0);
      list.push({
        type: 'danger',
        title: `${unpaidDelivered.length} pedido${unpaidDelivered.length > 1 ? 's' : ''} entregado${unpaidDelivered.length > 1 ? 's' : ''} sin cobrar`,
        detail: `Saldo total: ${fmt(total)}`,
        link: '/orders',
      });
    }

    // Entregas de hoy pendientes
    const todayDeliveries = state.deliveries.filter(d =>
      d.status === 'pendiente' && isToday(parseISO(d.scheduledDate))
    );
    if (todayDeliveries.length > 0) {
      list.push({
        type: 'info',
        title: `${todayDeliveries.length} entrega${todayDeliveries.length > 1 ? 's' : ''} para hoy`,
        detail: todayDeliveries.slice(0, 2).map(d => d.customerName).join(', ') + (todayDeliveries.length > 2 ? '…' : ''),
        link: '/deliveries',
      });
    }

    // Clientes con deuda alta (> 30,000)
    const highDebt = state.customers.filter(c => c.balance < -30000);
    if (highDebt.length > 0) {
      list.push({
        type: 'warning',
        title: `${highDebt.length} cliente${highDebt.length > 1 ? 's' : ''} con deuda alta`,
        detail: highDebt.slice(0, 2).map(c => c.name).join(', ') + (highDebt.length > 2 ? '…' : ''),
        link: '/accounts',
      });
    }

    return list;
  }, [state.orders, state.deliveries, state.customers]);

  const iconClass = {
    warning: 'text-yellow-500',
    danger:  'text-red-500',
    info:    'text-blue-500',
  };
  const bgClass = {
    warning: 'bg-yellow-50 border-yellow-100',
    danger:  'bg-red-50 border-red-100',
    info:    'bg-blue-50 border-blue-100',
  };
  const IconMap = {
    warning: AlertTriangle,
    danger:  Banknote,
    info:    Clock,
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="relative w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500 transition-colors"
      >
        <Bell size={18} />
        {alerts.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {alerts.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h4 className="font-semibold text-gray-800 text-sm">Notificaciones</h4>
            {alerts.length > 0 && (
              <span className="text-xs bg-red-100 text-red-600 font-medium px-2 py-0.5 rounded-full">{alerts.length}</span>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                <CheckCircle size={28} className="mb-2 text-green-400" />
                <p className="text-sm">Todo en orden</p>
              </div>
            ) : (
              alerts.map((a, i) => {
                const Icon = IconMap[a.type];
                return (
                  <button
                    key={i}
                    onClick={() => { navigate(a.link); setOpen(false); }}
                    className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 flex gap-3 transition-colors ${bgClass[a.type]}`}
                  >
                    <Icon size={16} className={`${iconClass[a.type]} mt-0.5 flex-shrink-0`} />
                    <div>
                      <p className="text-xs font-semibold text-gray-800">{a.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{a.detail}</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────
export default function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { username, role, logout } = useAuth();

  const roleInfo = ROLE_LABELS[role] ?? ROLE_LABELS.admin;
  const allowedRoutes = ROLE_ROUTES[role] ?? ROLE_ROUTES.admin;

  const navItems = ALL_NAV.filter(n => allowedRoutes.includes(n.to));

  const currentLabel = ALL_NAV.find(n =>
    n.exact ? location.pathname === n.to : location.pathname.startsWith(n.to)
  )?.label ?? '';

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`fixed inset-y-0 left-0 z-30 w-64 bg-gradient-to-b from-orange-800 to-orange-900 text-white flex flex-col transform transition-transform duration-300 lg:translate-x-0 lg:static lg:z-auto ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center gap-3 px-4 py-5 border-b border-orange-700 shrink-0">
          <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">🌽</div>
          <div className="min-w-0">
            <div className="font-bold text-sm leading-tight text-white">Tamales Donde Mi Abue</div>
            <div className="text-orange-300 text-xs">Sistema de Gestión</div>
          </div>
          <button className="ml-auto lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X size={20} className="text-orange-300" />
          </button>
        </div>

        <nav className="flex-1 py-3 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg mb-0.5 text-sm font-medium transition-all ${
                  isActive ? 'bg-white/20 text-white' : 'text-orange-200 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <Icon size={18} />
              <span>{label}</span>
              <ChevronRight size={14} className="ml-auto opacity-40" />
            </NavLink>
          ))}
        </nav>

        <div className="px-4 py-3 border-t border-orange-700 shrink-0">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 bg-orange-500 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
              {username[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-orange-100 truncate leading-tight">{username}</p>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${roleInfo.color}`}>
                {roleInfo.label}
              </span>
            </div>
            <button onClick={logout} title="Cerrar sesión"
              className="p-1.5 rounded-lg hover:bg-white/10 text-orange-300 hover:text-white transition-colors">
              <LogOut size={15} />
            </button>
          </div>
          <div className="text-xs text-orange-400 text-center">Donde Mi Abue · v1.1</div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 no-print shadow-sm shrink-0">
          <button className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100" onClick={() => setSidebarOpen(true)}>
            <Menu size={22} className="text-gray-600" />
          </button>
          <div>
            <h1 className="font-bold text-gray-800 text-base leading-tight">{currentLabel}</h1>
            <p className="text-xs text-gray-400">
              {new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <NotificationBell />
            <div className="flex items-center gap-2 pl-2 border-l border-gray-100">
              <span className="text-xs text-gray-400 hidden sm:block">{username}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium hidden sm:block ${roleInfo.color}`}>
                {roleInfo.label}
              </span>
              <button onClick={logout}
                className="w-8 h-8 bg-orange-100 hover:bg-orange-200 rounded-full flex items-center justify-center text-orange-700 font-bold text-sm transition-colors"
                title={`Cerrar sesión (${username})`}>
                {username[0]?.toUpperCase()}
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
