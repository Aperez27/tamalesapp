import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initDb } from './db.js';
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

initDb();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, '../../dist');

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Rutas públicas
app.use('/api/auth', authRoutes);

// Rutas protegidas
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

// Servir el frontend de React (producción)
app.use(express.static(DIST));
app.get('*', (_req, res) => {
  res.sendFile(path.join(DIST, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🌽 TamalesApp corriendo en http://localhost:${PORT}`);
});
