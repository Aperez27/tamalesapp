import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initDb } from './db.js';
import app from './app.js';

initDb();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, '../../dist');

app.use(express.static(DIST));
app.get('*', (_req, res) => {
  res.sendFile(path.join(DIST, 'index.html'));
});

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => {
  console.log(`🌽 TamalesApp corriendo en http://localhost:${PORT}`);
});
