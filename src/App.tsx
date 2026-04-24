import type { ReactElement } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import POS from './pages/POS';
import Orders from './pages/Orders';
import Deliveries from './pages/Deliveries';
import Customers from './pages/Customers';
import Accounts from './pages/Accounts';
import Intelligence from './pages/Intelligence';
import Reports from './pages/Reports';
import Products from './pages/Products';
import Expenses from './pages/Expenses';
import Settings from './pages/Settings';
import RouteMap from './pages/RouteMap';
import Suppliers from './pages/Suppliers';
import Purchases from './pages/Purchases';
import Payroll from './pages/Payroll';

// First route allowed for each role (used as fallback redirect)
const ROLE_HOME: Record<string, string> = {
  admin:      '/',
  cajero:     '/',
  repartidor: '/deliveries',
  contador:   '/',
};

const ROLE_ROUTES: Record<string, string[]> = {
  admin:      ['/', '/pos', '/orders', '/deliveries', '/route-map', '/customers', '/accounts', '/intelligence', '/reports', '/products', '/expenses', '/suppliers', '/purchases', '/payroll', '/settings'],
  cajero:     ['/', '/pos', '/orders', '/deliveries', '/route-map', '/customers', '/settings'],
  repartidor: ['/deliveries', '/route-map', '/settings'],
  contador:   ['/', '/accounts', '/expenses', '/intelligence', '/reports', '/settings'],
};

function Guard({ path, element }: { path: string; element: ReactElement }) {
  const { role } = useAuth();
  const allowed = ROLE_ROUTES[role] ?? ROLE_ROUTES.admin;
  return allowed.includes(path) ? element : <Navigate to={ROLE_HOME[role] ?? '/'} replace />;
}

function AppShell() {
  const { loading } = useApp() as any;
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-5xl mb-3">🌽</div>
          <p className="font-bold text-orange-700 text-lg leading-tight mb-2">Tamales Donde Mi Abue</p>
          <div className="flex items-center gap-2 text-orange-500 font-medium text-sm">
            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            Cargando datos...
          </div>
        </div>
      </div>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/"             element={<Guard path="/"             element={<Dashboard />} />} />
        <Route path="/pos"          element={<Guard path="/pos"          element={<POS />} />} />
        <Route path="/orders"       element={<Guard path="/orders"       element={<Orders />} />} />
        <Route path="/deliveries"   element={<Guard path="/deliveries"   element={<Deliveries />} />} />
        <Route path="/customers"    element={<Guard path="/customers"    element={<Customers />} />} />
        <Route path="/accounts"     element={<Guard path="/accounts"     element={<Accounts />} />} />
        <Route path="/intelligence" element={<Guard path="/intelligence" element={<Intelligence />} />} />
        <Route path="/reports"      element={<Guard path="/reports"      element={<Reports />} />} />
        <Route path="/products"     element={<Guard path="/products"     element={<Products />} />} />
        <Route path="/expenses"     element={<Guard path="/expenses"     element={<Expenses />} />} />
        <Route path="/route-map"    element={<Guard path="/route-map"    element={<RouteMap />} />} />
        <Route path="/suppliers"    element={<Guard path="/suppliers"    element={<Suppliers />} />} />
        <Route path="/purchases"    element={<Guard path="/purchases"    element={<Purchases />} />} />
        <Route path="/payroll"      element={<Guard path="/payroll"      element={<Payroll />} />} />
        <Route path="/settings"     element={<Guard path="/settings"     element={<Settings />} />} />
        <Route path="*"             element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

function ProtectedApp() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Login />;
  return <AppProvider><AppShell /></AppProvider>;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ProtectedApp />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
