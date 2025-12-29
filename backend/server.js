// server.js (defensive version)
// Replaces previous server.js: tries multiple frontend/db paths, normalizes phone, supports transactions by userId or phone.
// Added: explicit routes for both /admin.html and /adminpage.html so admin page does not get swallowed by SPA fallback.

const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

/* --- Utilities to locate frontend and database directories robustly --- */
function firstExisting(...candidates) {
  for (const p of candidates) {
    try {
      if (p && fs.existsSync(p)) return p;
    } catch (e) {}
  }
  return null;
}

const cwd = process.cwd();
const dir = __dirname;

// Candidate frontend dirs (common layouts)
const frontendCandidates = [
  path.resolve(dir, '..', 'frontend'),
  path.resolve(dir, 'frontend'),
  path.resolve(cwd, 'frontend'),
  path.resolve(cwd, 'public'),
  path.resolve(dir, '..', 'public'),
];

// Candidate database dirs
const dbCandidates = [
  path.resolve(dir, '..', 'database'),
  path.resolve(dir, 'database'),
  path.resolve(cwd, 'database'),
  path.resolve(cwd, 'db'),
  path.resolve(dir, '..', 'db'),
];

const frontendDir = firstExisting(...frontendCandidates);
const dbDir = firstExisting(...dbCandidates) || path.resolve(dir, '..', 'database'); // pick first existing or default

if (!frontendDir) {
  console.warn('⚠ frontend directory not found at any of:', frontendCandidates.join(', '));
  console.warn('Static assets will not be served. Create a "frontend" or "public" directory next to server.js or in project root.');
} else {
  console.log('▶ Serving frontend from', frontendDir);
}

if (!fs.existsSync(dbDir)) {
  try {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log('Created database directory at', dbDir);
  } catch (e) {
    console.error('Failed to create database dir', dbDir, e);
  }
} else {
  console.log('▶ Using database directory', dbDir);
}

/* Paths for JSON files */
const productsPath = path.join(dbDir, 'products.json');
const usersPath = path.join(dbDir, 'user.json');
const transactionsPath = path.join(dbDir, 'transactions.json');

/* Middleware */
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  console.log(new Date().toISOString(), req.method, req.originalUrl);
  next();
});

/* Serve static assets if frontendDir exists */
if (frontendDir) {
  app.use(express.static(frontendDir));
}

/* --- Helpers --- */
function normalizePhone(raw) {
  try {
    const s = String(raw || '').replace(/\D+/g, '');
    return s;
  } catch (e) {
    return '';
  }
}

function ensureJSONFile(filePath, defaultValue = []) {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2), 'utf8');
      return;
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    JSON.parse(raw);
  } catch (e) {
    try {
      const backup = filePath + '.broken.' + Date.now();
      if (fs.existsSync(filePath)) fs.renameSync(filePath, backup);
      fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2), 'utf8');
      console.warn(`⚠ Replaced corrupted ${path.basename(filePath)}. Backup: ${backup}`);
    } catch (err) {
      console.error('Failed to repair JSON file', filePath, err);
    }
  }
}

function readJSON(file) {
  try {
    ensureJSONFile(file);
    const raw = fs.readFileSync(file, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    console.error('readJSON error for', file, e);
    return [];
  }
}

function writeJSON(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('writeJSON error for', file, e);
  }
}

/* Ensure DB files exist */
ensureJSONFile(productsPath, []);
ensureJSONFile(usersPath, []);
ensureJSONFile(transactionsPath, []);

/* --------- API ROUTES --------- */

// Health check
app.get('/api/ping', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// Products
app.get('/api/products', (req, res) => res.json(readJSON(productsPath) || []));
app.get('/api/products/:id', (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'invalid_id' });
  const p = readJSON(productsPath).find(x => Number(x.id) === id);
  if (!p) return res.status(404).json({ error: 'not_found' });
  res.json(p);
});
app.post('/api/products', (req, res) => {
  const { name, price, image } = req.body || {};
  if (!name || typeof name !== 'string' || isNaN(Number(price))) {
    return res.status(400).json({ error: 'invalid_input' });
  }
  const products = readJSON(productsPath);
  const maxId = products.reduce((m, p) => Math.max(m, Number(p.id) || 0), 0);
  const id = maxId + 1;
  const p = {
    id,
    name: String(name),
    price: Number(price),
    image: image && String(image).trim() ? String(image) : `https://via.placeholder.com/300?text=${encodeURIComponent(name)}`
  };
  products.push(p);
  writeJSON(productsPath, products);
  res.status(201).json(p);
});
app.put('/api/products/:id', (req, res) => {
  const id = Number(req.params.id);
  const { name, price, image } = req.body || {};
  if (isNaN(id)) return res.status(400).json({ error: 'invalid_id' });
  if (!name || typeof name !== 'string' || isNaN(Number(price))) {
    return res.status(400).json({ error: 'invalid_input' });
  }
  const products = readJSON(productsPath);
  const idx = products.findIndex(x => Number(x.id) === id);
  if (idx === -1) return res.status(404).json({ error: 'not_found' });
  products[idx] = { ...products[idx], name: String(name), price: Number(price), image: image && String(image).trim() ? String(image) : products[idx].image };
  writeJSON(productsPath, products);
  res.json(products[idx]);
});
app.delete('/api/products/:id', (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'invalid_id' });
  const products = readJSON(productsPath);
  const idx = products.findIndex(x => Number(x.id) === id);
  if (idx === -1) return res.status(404).json({ error: 'not_found' });
  products.splice(idx, 1);
  writeJSON(productsPath, products);
  res.status(204).end();
});

/* USER & TRANSACTION ROUTES */

// POST /api/signup
app.post('/api/signup', (req, res) => {
  let { phone, password, name } = req.body || {};
  phone = normalizePhone(phone);
  if (!phone || phone.length !== 10) return res.status(400).json({ error: 'invalid_phone' });
  if (!password || typeof password !== 'string') return res.status(400).json({ error: 'invalid_password' });
  const users = readJSON(usersPath);
  if (users.find(u => normalizePhone(u.phone) === phone)) return res.status(409).json({ error: 'exists' });
  const user = { id: Date.now(), phone, password, name: name || '' };
  users.push(user);
  writeJSON(usersPath, users);
  res.status(201).json({ id: user.id, phone: user.phone, name: user.name });
});

// POST /api/login
app.post('/api/login', (req, res) => {
  const { phone: rawPhone, password } = req.body || {};
  const phone = normalizePhone(rawPhone);
  if (!phone) return res.status(400).json({ error: 'invalid_phone' });
  const users = readJSON(usersPath);
  const user = users.find(u => normalizePhone(u.phone) === phone);
  if (!user) return res.status(404).json({ error: 'not_found' });
  if (user.password !== password) return res.status(401).json({ error: 'wrong_password' });
  res.json({ id: user.id, phone: user.phone, name: user.name });
});

// POST /api/transactions
app.post('/api/transactions', (req, res) => {
  const txs = readJSON(transactionsPath);
  const id = txs.reduce((m, t) => Math.max(m, Number(t.id) || 0), 0) + 1;

  let phone = '';
  if (req.body && (req.body.phone || req.body.phoneNumber)) {
    phone = normalizePhone(req.body.phone || req.body.phoneNumber);
  }
  const userId = req.body && req.body.userId ? req.body.userId : null;
  if (!phone && userId) {
    const users = readJSON(usersPath);
    const u = users.find(x => Number(x.id) === Number(userId));
    if (u) phone = normalizePhone(u.phone);
  }
  if (!phone) phone = String(req.body && req.body.phone ? req.body.phone : (req.body && req.body.phoneNumber ? req.body.phoneNumber : 'guest'));

  const tx = {
    id,
    date: new Date().toISOString(),
    status: (req.body && req.body.status) ? String(req.body.status) : 'PAID',
    phone,
    items: req.body && req.body.items ? req.body.items : [],
    total: (req.body && (req.body.total || req.body.amount)) ? (req.body.total || req.body.amount) : 0,
    payment: req.body && req.body.payment ? req.body.payment : null,
    userId: userId || (req.body && req.body.userId ? req.body.userId : null)
  };

  txs.push(tx);
  writeJSON(transactionsPath, txs);
  console.log('Saved transaction', { id: tx.id, phone: tx.phone, userId: tx.userId });
  res.json(tx);
});

// GET /api/transactions (supports ?userId= or ?phone=)
app.get('/api/transactions', (req, res) => {
  const userId = req.query.userId;
  const phoneParam = req.query.phone;
  const txs = readJSON(transactionsPath);
  if (userId) {
    const results = txs.filter(t => String(t.userId) === String(userId));
    console.log(`GET /api/transactions?userId=${userId} -> ${results.length} results`);
    return res.json(results);
  }
  if (phoneParam) {
    const norm = normalizePhone(phoneParam);
    const results = norm ? txs.filter(t => normalizePhone(t.phone) === norm) : txs.filter(t => String(t.phone) === String(phoneParam));
    console.log(`GET /api/transactions?phone=${phoneParam} -> ${results.length} results`);
    return res.json(results);
  }
  // otherwise return all (admin/debug)
  res.json(txs || []);
});

// Backwards-compatible GET /api/transactions/:phone
app.get('/api/transactions/:phone', (req, res) => {
  const raw = req.params.phone;
  const norm = normalizePhone(raw);
  const txs = readJSON(transactionsPath);
  const results = norm ? txs.filter(t => normalizePhone(t.phone) === norm) : txs.filter(t => String(t.phone) === String(raw));
  console.log(`GET /api/transactions/${raw} -> ${results.length} results`);
  res.json(results || []);
});

/* Explicit static file routes (if frontend present)
   NOTE: we now explicitly serve both /admin.html and /adminpage.html
   so the SPA fallback won't accidentally return index.html for those routes.
*/
if (frontendDir) {
  const serveIfExists = (res, filePath) => {
    if (fs.existsSync(filePath)) return res.sendFile(filePath);
    return res.status(404).send(path.basename(filePath) + ' not found');
  };

  app.get('/', (req, res) => serveIfExists(res, path.join(frontendDir, 'index.html')));
  app.get('/index.html', (req, res) => serveIfExists(res, path.join(frontendDir, 'index.html')));

  // Keep both admin names supported
  app.get('/admin.html', (req, res) => serveIfExists(res, path.join(frontendDir, 'admin.html')));
  app.get('/adminpage.html', (req, res) => serveIfExists(res, path.join(frontendDir, 'adminpage.html')));

  // Also accept /admin to redirect to adminpage (optional convenience)
  app.get('/admin', (req, res) => {
    const file = path.join(frontendDir, 'adminpage.html');
    if (fs.existsSync(file)) return res.sendFile(file);
    // fallback to admin.html if adminpage not present
    const alt = path.join(frontendDir, 'admin.html');
    if (fs.existsSync(alt)) return res.sendFile(alt);
    return res.status(404).send('admin page not found');
  });
}

/* SPA fallback when static is present */
if (frontendDir) {
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    const indexFile = path.join(frontendDir, 'index.html');
    if (fs.existsSync(indexFile)) return res.sendFile(indexFile);
    return res.status(404).send('Not found');
  });
}

/* Start server */
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
  console.log('  frontendDir =', frontendDir || '(not found)');
  console.log('  dbDir =', dbDir);
});