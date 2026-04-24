import React, { createContext, useContext, useReducer, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type {
  AppState, Product, Customer, Order, Payment, Delivery, Expense,
  Supplier, Purchase, Worker, WorkerPayment,
} from '../types';
import { api } from '../api/client';

type Action =
  | { type: 'SET_STATE';            payload: AppState }
  | { type: 'ADD_ORDER';            payload: Order }
  | { type: 'UPDATE_ORDER';         payload: Order }
  | { type: 'DELETE_ORDER';         payload: string }
  | { type: 'ADD_CUSTOMER';         payload: Customer }
  | { type: 'UPDATE_CUSTOMER';      payload: Customer }
  | { type: 'DELETE_CUSTOMER';      payload: string }
  | { type: 'ADD_PRODUCT';          payload: Product }
  | { type: 'UPDATE_PRODUCT';       payload: Product }
  | { type: 'DELETE_PRODUCT';       payload: string }
  | { type: 'ADD_PAYMENT';          payload: Payment }
  | { type: 'ADD_DELIVERY';         payload: Delivery }
  | { type: 'UPDATE_DELIVERY';      payload: Delivery }
  | { type: 'DELETE_DELIVERY';      payload: string }
  | { type: 'ADD_EXPENSE';          payload: Expense }
  | { type: 'UPDATE_EXPENSE';       payload: Expense }
  | { type: 'DELETE_EXPENSE';       payload: string }
  | { type: 'ADD_SUPPLIER';         payload: Supplier }
  | { type: 'UPDATE_SUPPLIER';      payload: Supplier }
  | { type: 'DELETE_SUPPLIER';      payload: string }
  | { type: 'ADD_PURCHASE';         payload: Purchase }
  | { type: 'UPDATE_PURCHASE';      payload: Purchase }
  | { type: 'DELETE_PURCHASE';      payload: string }
  | { type: 'ADD_WORKER';           payload: Worker }
  | { type: 'UPDATE_WORKER';        payload: Worker }
  | { type: 'DELETE_WORKER';        payload: string }
  | { type: 'ADD_WORKER_PAYMENT';   payload: WorkerPayment }
  | { type: 'DELETE_WORKER_PAYMENT';payload: string };

const empty: AppState = {
  products: [], customers: [], orders: [], payments: [],
  deliveries: [], expenses: [], suppliers: [], purchases: [],
  workers: [], workerPayments: [],
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_STATE':      return action.payload;

    case 'ADD_ORDER':      return { ...state, orders: [action.payload, ...state.orders] };
    case 'UPDATE_ORDER':   return { ...state, orders: state.orders.map(o => o.id === action.payload.id ? action.payload : o) };
    case 'DELETE_ORDER':   return { ...state, orders: state.orders.filter(o => o.id !== action.payload) };

    case 'ADD_CUSTOMER':    return { ...state, customers: [action.payload, ...state.customers] };
    case 'UPDATE_CUSTOMER': return { ...state, customers: state.customers.map(c => c.id === action.payload.id ? action.payload : c) };
    case 'DELETE_CUSTOMER': return { ...state, customers: state.customers.filter(c => c.id !== action.payload) };

    case 'ADD_PRODUCT':    return { ...state, products: [action.payload, ...state.products] };
    case 'UPDATE_PRODUCT': return { ...state, products: state.products.map(p => p.id === action.payload.id ? action.payload : p) };
    case 'DELETE_PRODUCT': return { ...state, products: state.products.filter(p => p.id !== action.payload) };

    case 'ADD_PAYMENT': return {
      ...state,
      payments: [action.payload, ...state.payments],
      orders: action.payload.orderId
        ? state.orders.map(o => {
            if (o.id !== action.payload.orderId) return o;
            const newPaid = o.amountPaid + action.payload.amount;
            const newBal  = o.finalTotal - newPaid;
            return { ...o, amountPaid: newPaid, balance: newBal, paymentStatus: newBal <= 0 ? 'pagado' as const : 'parcial' as const };
          })
        : state.orders,
      customers: state.customers.map(c =>
        c.id === action.payload.customerId ? { ...c, balance: c.balance + action.payload.amount } : c
      ),
    };

    case 'ADD_DELIVERY':    return { ...state, deliveries: [action.payload, ...state.deliveries] };
    case 'UPDATE_DELIVERY': return {
      ...state,
      deliveries: state.deliveries.map(d => d.id === action.payload.id ? action.payload : d),
      orders: action.payload.status === 'entregado'
        ? state.orders.map(o => o.id === action.payload.orderId ? { ...o, status: 'entregado' as const } : o)
        : state.orders,
    };
    case 'DELETE_DELIVERY': return { ...state, deliveries: state.deliveries.filter(d => d.id !== action.payload) };

    case 'ADD_EXPENSE':    return { ...state, expenses: [action.payload, ...state.expenses] };
    case 'UPDATE_EXPENSE': return { ...state, expenses: state.expenses.map(e => e.id === action.payload.id ? action.payload : e) };
    case 'DELETE_EXPENSE': return { ...state, expenses: state.expenses.filter(e => e.id !== action.payload) };

    case 'ADD_SUPPLIER':    return { ...state, suppliers: [action.payload, ...state.suppliers] };
    case 'UPDATE_SUPPLIER': return { ...state, suppliers: state.suppliers.map(s => s.id === action.payload.id ? action.payload : s) };
    case 'DELETE_SUPPLIER': return { ...state, suppliers: state.suppliers.filter(s => s.id !== action.payload) };

    case 'ADD_PURCHASE':    return {
      ...state,
      purchases: [action.payload, ...state.purchases],
      suppliers: state.suppliers.map(s =>
        s.id === action.payload.supplierId
          ? { ...s, totalPurchases: s.totalPurchases + action.payload.total }
          : s
      ),
    };
    case 'UPDATE_PURCHASE': return { ...state, purchases: state.purchases.map(p => p.id === action.payload.id ? action.payload : p) };
    case 'DELETE_PURCHASE': return {
      ...state,
      purchases: state.purchases.filter(p => p.id !== action.payload),
    };

    case 'ADD_WORKER':    return { ...state, workers: [action.payload, ...state.workers] };
    case 'UPDATE_WORKER': return { ...state, workers: state.workers.map(w => w.id === action.payload.id ? action.payload : w) };
    case 'DELETE_WORKER': return { ...state, workers: state.workers.filter(w => w.id !== action.payload) };

    case 'ADD_WORKER_PAYMENT':    return { ...state, workerPayments: [action.payload, ...state.workerPayments] };
    case 'DELETE_WORKER_PAYMENT': return { ...state, workerPayments: state.workerPayments.filter(p => p.id !== action.payload) };

    default: return state;
  }
}

interface AppContextType {
  state: AppState;
  loading: boolean;
  dispatch: React.Dispatch<Action>;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, empty);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [
          products, customers, orders, payments, deliveries, expenses,
          suppliers, purchases, workers, workerPayments,
        ] = await Promise.all([
          api.getProducts(),
          api.getCustomers(),
          api.getOrders(),
          api.getPayments(),
          api.getDeliveries(),
          api.getExpenses(),
          api.getSuppliers(),
          api.getPurchases(),
          api.getWorkers(),
          api.getWorkerPayments(),
        ]);
        dispatch({
          type: 'SET_STATE',
          payload: {
            products, customers, orders, payments, deliveries, expenses,
            suppliers, purchases, workers, workerPayments,
          },
        });
      } catch (e) {
        console.error('Error cargando datos:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <AppContext.Provider value={{ state, loading, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
