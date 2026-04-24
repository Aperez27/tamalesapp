// Usa el SQLite incorporado de Node.js v22.5+ (sin dependencias nativas)
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// En Vercel (serverless) el filesystem es de solo lectura excepto /tmp
const DB_PATH = process.env.VERCEL
  ? '/tmp/tamales.db'
  : path.join(__dirname, '../../tamales.db');

export const db = new DatabaseSync(DB_PATH);

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      category    TEXT NOT NULL,
      price       REAL NOT NULL,
      cost        REAL NOT NULL DEFAULT 0,
      description TEXT DEFAULT '',
      active      INTEGER DEFAULT 1,
      emoji       TEXT DEFAULT '🌽'
    );

    CREATE TABLE IF NOT EXISTS customers (
      id              TEXT PRIMARY KEY,
      name            TEXT NOT NULL,
      phone           TEXT NOT NULL,
      address         TEXT DEFAULT '',
      neighborhood    TEXT DEFAULT '',
      email           TEXT DEFAULT '',
      balance         REAL DEFAULT 0,
      total_purchases REAL DEFAULT 0,
      created_at      TEXT NOT NULL,
      notes           TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS orders (
      id              TEXT PRIMARY KEY,
      customer_id     TEXT NOT NULL,
      customer_name   TEXT NOT NULL,
      items           TEXT NOT NULL,
      total           REAL NOT NULL,
      discount        REAL DEFAULT 0,
      final_total     REAL NOT NULL,
      status          TEXT DEFAULT 'pendiente',
      payment_status  TEXT DEFAULT 'pendiente',
      payment_method  TEXT NOT NULL,
      amount_paid     REAL DEFAULT 0,
      balance         REAL DEFAULT 0,
      created_at      TEXT NOT NULL,
      updated_at      TEXT NOT NULL,
      is_delivery     INTEGER DEFAULT 0,
      delivery_address TEXT DEFAULT '',
      delivery_date   TEXT DEFAULT '',
      notes           TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS payments (
      id            TEXT PRIMARY KEY,
      customer_id   TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      order_id      TEXT DEFAULT '',
      amount        REAL NOT NULL,
      method        TEXT NOT NULL,
      date          TEXT NOT NULL,
      notes         TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS deliveries (
      id             TEXT PRIMARY KEY,
      order_id       TEXT NOT NULL,
      customer_name  TEXT NOT NULL,
      address        TEXT NOT NULL,
      neighborhood   TEXT DEFAULT '',
      items          TEXT NOT NULL,
      status         TEXT DEFAULT 'pendiente',
      scheduled_date TEXT NOT NULL,
      delivered_at   TEXT DEFAULT '',
      notes          TEXT DEFAULT '',
      phone          TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id          TEXT PRIMARY KEY,
      date        TEXT NOT NULL,
      amount      REAL NOT NULL,
      category    TEXT NOT NULL,
      description TEXT NOT NULL,
      provider    TEXT DEFAULT '',
      method      TEXT DEFAULT 'efectivo',
      notes       TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role          TEXT NOT NULL DEFAULT 'admin'
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id             TEXT PRIMARY KEY,
      name           TEXT NOT NULL,
      category       TEXT NOT NULL,
      contact        TEXT DEFAULT '',
      phone          TEXT DEFAULT '',
      email          TEXT DEFAULT '',
      address        TEXT DEFAULT '',
      nit            TEXT DEFAULT '',
      notes          TEXT DEFAULT '',
      created_at     TEXT NOT NULL,
      total_purchases REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS purchases (
      id             TEXT PRIMARY KEY,
      supplier_id    TEXT NOT NULL,
      supplier_name  TEXT NOT NULL,
      invoice_number TEXT DEFAULT '',
      items          TEXT NOT NULL,
      subtotal       REAL NOT NULL,
      total          REAL NOT NULL,
      amount_paid    REAL DEFAULT 0,
      balance        REAL DEFAULT 0,
      status         TEXT DEFAULT 'pendiente',
      payment_method TEXT DEFAULT 'efectivo',
      date           TEXT NOT NULL,
      due_date       TEXT DEFAULT '',
      notes          TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS workers (
      id           TEXT PRIMARY KEY,
      name         TEXT NOT NULL,
      role         TEXT NOT NULL,
      phone        TEXT DEFAULT '',
      salary       REAL DEFAULT 0,
      salary_type  TEXT DEFAULT 'mensual',
      start_date   TEXT NOT NULL,
      active       INTEGER DEFAULT 1,
      notes        TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS worker_payments (
      id           TEXT PRIMARY KEY,
      worker_id    TEXT NOT NULL,
      worker_name  TEXT NOT NULL,
      worker_role  TEXT NOT NULL,
      amount       REAL NOT NULL,
      period       TEXT NOT NULL,
      period_start TEXT DEFAULT '',
      period_end   TEXT DEFAULT '',
      payment_method TEXT DEFAULT 'efectivo',
      date         TEXT NOT NULL,
      concept      TEXT NOT NULL,
      notes        TEXT DEFAULT ''
    );
  `);

  // Migraciones: agregar columnas si no existen en bases de datos existentes
  try { db.exec(`ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'admin'`); } catch { /* ya existe */ }

  // Productos iniciales si la tabla está vacía
  const count = db.prepare('SELECT COUNT(*) as n FROM products').get() as { n: number };
  if (count.n === 0) {
    const insertProduct = db.prepare(
      `INSERT INTO products (id,name,category,price,cost,description,active,emoji) VALUES (?,?,?,?,?,?,?,?)`
    );
    const products = [
      ['p1','Tamal de Cerdo',   'tamal',   4500, 2200,'Tamal tradicional con cerdo y papa',1,'🌽'],
      ['p2','Tamal de Pollo',   'tamal',   4000, 1900,'Tamal de masa con pollo desmenuzado',1,'🌽'],
      ['p3','Tamal de Pipián',  'tamal',   5000, 2500,'Tamal especial de pipián',1,'🌽'],
      ['p4','Tamal Vegetariano','tamal',   3800, 1800,'Tamal sin carne con verduras',1,'🌿'],
      ['p5','Tamal de Costilla','tamal',   5500, 2800,'Tamal con costilla de cerdo',1,'🌽'],
      ['p6','Tamal Especial',   'tamal',   6000, 3000,'Tamal con cerdo y pollo mixto',1,'⭐'],
      ['p7','Docena Cerdo',     'tamal',  50000,25000,'Docena de tamales de cerdo',1,'📦'],
      ['p8','Docena Pollo',     'tamal',  45000,22000,'Docena de tamales de pollo',1,'📦'],
      ['p9','Chocolate Caliente','bebida',  2000,  600,'Taza de chocolate caliente',1,'☕'],
      ['p10','Agua Panela',     'bebida',  1500,  400,'Agua panela con limón',1,'🍵'],
      ['p11','Café',            'bebida',  1500,  350,'Tinto o café con leche',1,'☕'],
      ['p12','Arepa',           'adicional',1500,  500,'Arepa de maíz',1,'🫓'],
    ];
    for (const p of products) insertProduct.run(...p);
  }

  // Usuario admin por defecto si no existe ninguno
  const userCount = db.prepare('SELECT COUNT(*) as n FROM users').get() as { n: number };
  if (userCount.n === 0) {
    const hash = bcrypt.hashSync('tamales2025', 10);
    db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run('admin', hash);
  }
}
