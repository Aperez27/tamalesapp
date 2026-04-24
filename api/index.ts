import { initDb } from '../server/src/db.js';
import app from '../server/src/app.js';

// initDb es idempotente (CREATE TABLE IF NOT EXISTS), seguro llamarlo en cada cold start
initDb();

export default app;
