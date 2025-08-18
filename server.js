// server.js
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;
const ADMIN_KEY = process.env.ADMIN_KEY || 'dev-key'; // Set this in Render

app.use(express.json());

// Serve static files from /public
app.use(express.static(path.join(__dirname, 'public')));

// --- Simple in-memory stores (reset when redeployed) ---
let settings = {
  service_fee_flat: 199,
  service_fee_percent: 2.5,
  gst_percent: 5,
  markup_percent_budget: 5,
  markup_percent_standard: 8,
  markup_percent_premium: 12,
  currency: 'INR'
};

let rates = [];
let leads = [];

// --- Middleware for admin key ---
function requireAdmin(req, res, next) {
  const key = req.header('x-admin-key') || '';
  if (key !== ADMIN_KEY) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

// --- API: Settings ---
app.get('/api/settings', requireAdmin, (req, res) => {
  res.json(settings);
});
app.post('/api/settings', requireAdmin, (req, res) => {
  settings = { ...settings, ...req.body };
  res.json({ ok: true, settings });
});

// --- API: Rates ---
app.get('/api/rates', requireAdmin, (req, res) => {
  res.json(rates);
});
app.post('/api/rates', requireAdmin, (req, res) => {
  const r = req.body || {};
  r.origin = (r.origin || '').toLowerCase();
  r.destination = (r.destination || '').toLowerCase();

  const i = rates.findIndex(x => x.origin === r.origin && x.destination === r.destination);
  if (i >= 0) rates[i] = { ...rates[i], ...r };
  else rates.push(r);

  res.json({ ok: true, route: r });
});

// --- API: Leads ---
app.get('/api/leads', requireAdmin, (req, res) => {
  res.json(leads);
});
app.post('/api/leads', (req, res) => {
  const lead = req.body || {};
  leads.push(lead);
  res.json({ ok: true, lead });
});

// Fallback: serve index.html for unknown routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Tripora server running on http://localhost:${PORT}`);
});
