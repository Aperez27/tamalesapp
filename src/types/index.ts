export type ProductCategory = 'tamal' | 'bebida' | 'adicional';
export type OrderStatus = 'pendiente' | 'en_preparacion' | 'listo' | 'entregado' | 'cancelado';
export type PaymentStatus = 'pagado' | 'parcial' | 'pendiente' | 'fiado';
export type PaymentMethod = 'efectivo' | 'transferencia' | 'nequi' | 'daviplata' | 'tarjeta' | 'fiado';
export type DeliveryStatus = 'pendiente' | 'en_camino' | 'entregado' | 'fallido';

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  price: number;
  cost: number;
  description: string;
  active: boolean;
  emoji: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  email?: string;
  neighborhood?: string;
  balance: number; // negative = owes money
  totalPurchases: number;
  createdAt: string;
  notes?: string;
}

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface Order {
  id: string;
  customerId: string;
  customerName: string;
  items: OrderItem[];
  total: number;
  discount: number;
  finalTotal: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  amountPaid: number;
  balance: number;
  createdAt: string;
  updatedAt: string;
  deliveryDate?: string;
  deliveryAddress?: string;
  notes?: string;
  isDelivery: boolean;
}

export interface Payment {
  id: string;
  customerId: string;
  customerName: string;
  orderId?: string;
  amount: number;
  method: PaymentMethod;
  date: string;
  notes?: string;
}

export interface Delivery {
  id: string;
  orderId: string;
  customerName: string;
  address: string;
  neighborhood: string;
  items: OrderItem[];
  status: DeliveryStatus;
  scheduledDate: string;
  deliveredAt?: string;
  notes?: string;
  phone: string;
}

export type ExpenseCategory = 'insumos' | 'empaques' | 'servicios' | 'transporte' | 'nomina' | 'otros';

export interface Expense {
  id: string;
  date: string;
  amount: number;
  category: ExpenseCategory;
  description: string;
  provider: string;
  method: PaymentMethod;
  notes: string;
}

// ─── Proveedores ──────────────────────────────────────────────────────────────

export type SupplierCategory = 'ingredientes' | 'empaques' | 'equipos' | 'servicios' | 'otros';

export interface Supplier {
  id: string;
  name: string;
  category: SupplierCategory;
  contact: string;
  phone: string;
  email?: string;
  address?: string;
  nit?: string;
  notes?: string;
  createdAt: string;
  totalPurchases: number;
}

// ─── Compras ──────────────────────────────────────────────────────────────────

export interface PurchaseItem {
  description: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export type PurchaseStatus = 'pagado' | 'parcial' | 'pendiente';

export interface Purchase {
  id: string;
  supplierId: string;
  supplierName: string;
  invoiceNumber?: string;
  items: PurchaseItem[];
  subtotal: number;
  total: number;
  amountPaid: number;
  balance: number;
  status: PurchaseStatus;
  paymentMethod: PaymentMethod;
  date: string;
  dueDate?: string;
  notes?: string;
}

// ─── Trabajadores y Nómina ────────────────────────────────────────────────────

export type WorkerRole = 'cocinero' | 'auxiliar_cocina' | 'auxiliar_preparacion' | 'repartidor' | 'otro';
export type SalaryType  = 'mensual' | 'quincenal' | 'semanal' | 'diario' | 'destajo';
export type PaymentPeriod = 'quincena_1' | 'quincena_2' | 'mensual' | 'semanal' | 'pago_unico' | 'bonificacion';

export interface Worker {
  id: string;
  name: string;
  role: WorkerRole;
  phone: string;
  salary: number;
  salaryType: SalaryType;
  startDate: string;
  active: boolean;
  notes?: string;
}

export interface WorkerPayment {
  id: string;
  workerId: string;
  workerName: string;
  workerRole: WorkerRole;
  amount: number;
  period: PaymentPeriod;
  periodStart?: string;
  periodEnd?: string;
  paymentMethod: PaymentMethod;
  date: string;
  concept: string;
  notes?: string;
}

export interface AppState {
  products: Product[];
  customers: Customer[];
  orders: Order[];
  payments: Payment[];
  deliveries: Delivery[];
  expenses: Expense[];
  suppliers: Supplier[];
  purchases: Purchase[];
  workers: Worker[];
  workerPayments: WorkerPayment[];
}
