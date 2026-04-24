const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';

function getToken(): string | null {
  return sessionStorage.getItem('tamales_token');
}

export function setToken(t: string) { sessionStorage.setItem('tamales_token', t); }
export function clearToken()        { sessionStorage.removeItem('tamales_token'); }

export function getRole(): string {
  return sessionStorage.getItem('tamales_role') ?? 'admin';
}
export function setRole(r: string) { sessionStorage.setItem('tamales_role', r); }
export function clearRole()        { sessionStorage.removeItem('tamales_role'); }

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? 'Error del servidor');
  }
  return res.json() as Promise<T>;
}

export const api = {
  // Auth
  login: (username: string, password: string) =>
    request<{ token: string; username: string; role: string }>('POST', '/auth/login', { username, password }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ ok: boolean }>('POST', '/auth/change-password', { currentPassword, newPassword }),
  changeUsername: (newUsername: string) =>
    request<{ token: string; username: string; role: string }>('POST', '/auth/change-username', { newUsername }),

  // User management (admin only)
  getUsers: () => request<{ id: number; username: string; role: string }[]>('GET', '/auth/users'),
  createUser: (u: { username: string; password: string; role: string }) =>
    request<{ id: number; username: string; role: string }>('POST', '/auth/users', u),
  updateUser: (u: { id: number; username: string; role: string }) =>
    request<{ id: number; username: string; role: string }>('PUT', `/auth/users/${u.id}`, u),
  deleteUser: (id: number) => request<{ ok: boolean }>('DELETE', `/auth/users/${id}`),
  resetUserPassword: (id: number, password: string) =>
    request<{ ok: boolean }>('POST', `/auth/users/${id}/reset-password`, { password }),

  // Products
  getProducts:    () => request<any[]>('GET', '/products'),
  createProduct:  (p: any) => request<any>('POST', '/products', p),
  updateProduct:  (p: any) => request<any>('PUT', `/products/${p.id}`, p),
  deleteProduct:  (id: string) => request<any>('DELETE', `/products/${id}`),

  // Customers
  getCustomers:   () => request<any[]>('GET', '/customers'),
  createCustomer: (c: any) => request<any>('POST', '/customers', c),
  updateCustomer: (c: any) => request<any>('PUT', `/customers/${c.id}`, c),
  deleteCustomer: (id: string) => request<any>('DELETE', `/customers/${id}`),

  // Orders
  getOrders:      () => request<any[]>('GET', '/orders'),
  createOrder:    (o: any) => request<any>('POST', '/orders', o),
  updateOrder:    (o: any) => request<any>('PUT', `/orders/${o.id}`, o),
  deleteOrder:    (id: string) => request<any>('DELETE', `/orders/${id}`),

  // Payments
  getPayments:    () => request<any[]>('GET', '/payments'),
  createPayment:  (p: any) => request<any>('POST', '/payments', p),

  // Deliveries
  getDeliveries:  () => request<any[]>('GET', '/deliveries'),
  createDelivery: (d: any) => request<any>('POST', '/deliveries', d),
  updateDelivery: (d: any) => request<any>('PUT', `/deliveries/${d.id}`, d),
  deleteDelivery: (id: string) => request<any>('DELETE', `/deliveries/${id}`),

  // Expenses
  getExpenses:    () => request<any[]>('GET', '/expenses'),
  createExpense:  (e: any) => request<any>('POST', '/expenses', e),
  updateExpense:  (e: any) => request<any>('PUT', `/expenses/${e.id}`, e),
  deleteExpense:  (id: string) => request<any>('DELETE', `/expenses/${id}`),

  // Suppliers
  getSuppliers:    () => request<any[]>('GET', '/suppliers'),
  createSupplier:  (s: any) => request<any>('POST', '/suppliers', s),
  updateSupplier:  (s: any) => request<any>('PUT', `/suppliers/${s.id}`, s),
  deleteSupplier:  (id: string) => request<any>('DELETE', `/suppliers/${id}`),

  // Purchases
  getPurchases:    () => request<any[]>('GET', '/purchases'),
  createPurchase:  (p: any) => request<any>('POST', '/purchases', p),
  updatePurchase:  (p: any) => request<any>('PUT', `/purchases/${p.id}`, p),
  deletePurchase:  (id: string) => request<any>('DELETE', `/purchases/${id}`),

  // Workers
  getWorkers:      () => request<any[]>('GET', '/workers'),
  createWorker:    (w: any) => request<any>('POST', '/workers', w),
  updateWorker:    (w: any) => request<any>('PUT', `/workers/${w.id}`, w),
  deleteWorker:    (id: string) => request<any>('DELETE', `/workers/${id}`),

  // Worker Payments
  getWorkerPayments:   () => request<any[]>('GET', '/worker-payments'),
  createWorkerPayment: (p: any) => request<any>('POST', '/worker-payments', p),
  deleteWorkerPayment: (id: string) => request<any>('DELETE', `/worker-payments/${id}`),
};
