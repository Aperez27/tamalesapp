import express from 'express';
import cors from 'cors';
import { requireAuth } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import productsRoutes from './routes/products.js';
import customersRoutes from './routes/customers.js';
import ordersRoutes from './routes/orders.js';
import paymentsRoutes from './routes/payments.js';
import deliveriesRoutes from './routes/deliveries.js';
import expensesRoutes from './routes/expenses.js';
import suppliersRoutes from './routes/suppliers.js';
import purchasesRoutes from './routes/purchases.js';
import workersRoutes from './routes/workers.js';
import workerPaymentsRoutes from './routes/worker-payments.js';

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/products',        requireAuth, productsRoutes);
app.use('/api/customers',       requireAuth, customersRoutes);
app.use('/api/orders',          requireAuth, ordersRoutes);
app.use('/api/payments',        requireAuth, paymentsRoutes);
app.use('/api/deliveries',      requireAuth, deliveriesRoutes);
app.use('/api/expenses',        requireAuth, expensesRoutes);
app.use('/api/suppliers',       requireAuth, suppliersRoutes);
app.use('/api/purchases',       requireAuth, purchasesRoutes);
app.use('/api/workers',         requireAuth, workersRoutes);
app.use('/api/worker-payments', requireAuth, workerPaymentsRoutes);

app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

export default app;
