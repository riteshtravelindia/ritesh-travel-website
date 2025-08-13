
/* Ritesh Web & Travel Solutions - Express backend */
const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const path = require('path');
const Database = require('better-sqlite3');

dotenv.config();
const app = express();
const PORT = process.env.PORT || 8080;
const ADMIN_KEY = process.env.ADMIN_KEY || 'change-this-admin-key';
const DEMO_OTP = process.env.DEMO_OTP || '111111';

app.use(helmet());
app.use(cors());
app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

/* ---------- SQLite setup ---------- */
const db = new Database(path.join(__dirname, 'rwts.db'));
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT DEFAULT (datetime('now')),
  name TEXT,
  phone TEXT,
  city TEXT,
  email TEXT,
  service TEXT,
  origin TEXT,
  destination TEXT,
  start_date TEXT,
  end_date TEXT,
  days INTEGER,
  pax INTEGER,
  wants_cab INTEGER DEFAULT 0,
  notes TEXT,
  verified INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS rates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  route_key TEXT, -- origin|destination (lowercase)
  train_oneway REAL,
  train_return REAL,
  bus_oneway REAL,
  bus_return REAL,
  flight_oneway REAL,
  flight_return REAL,
  hotel_per_night_budget REAL,
  hotel_per_night_standard REAL,
  hotel_per_night_premium REAL,
  cab_daily_budget REAL,
  cab_daily_standard REAL,
  cab_daily_premium REAL,
  UNIQUE(route_key)
);
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  service_fee_flat REAL DEFAULT 100,
  service_fee_percent REAL DEFAULT 0,
  markup_percent_budget REAL DEFAULT 5,
  markup_percent_standard REAL DEFAULT 10,
  markup_percent_premium REAL DEFAULT 15,
  gst_percent REAL DEFAULT 0,
  currency TEXT DEFAULT 'INR'
);
INSERT OR IGNORE INTO settings (id) VALUES (1);
`);

/* ---------- Helpers ---------- */
function requireAdmin(req, res, next) {
  const key = req.headers['x-admin-key'];
  if (!key || key !== ADMIN_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}
function parseBool(v){ return v === true || v === 'true' || v === 1 || v === '1'; }

/* ---------- OTP (demo) ---------- */
app.post('/api/send-otp', (req, res) => {
  const { phone } = req.body || {};
  // NOTE: For production, integrate SMS gateway like Twilio/MSG91 here.
  // For demo, we just return success and tell frontend to use DEMO_OTP.
  if (!phone) return res.status(400).json({ error: 'Phone required' });
  return res.json({ ok: true, message: 'OTP sent (demo). Use code: ' + DEMO_OTP });
});

/* ---------- Leads ---------- */
app.post('/api/lead', (req, res) => {
  const d = req.body || {};
  const stmt = db.prepare(`INSERT INTO leads
    (name, phone, city, email, service, origin, destination, start_date, end_date, days, pax, wants_cab, notes, verified)
    VALUES (@name, @phone, @city, @email, @service, @origin, @destination, @start_date, @end_date, @days, @pax, @wants_cab, @notes, @verified)`);
  const info = stmt.run({
    name: d.name || '',
    phone: d.phone || '',
    city: d.city || '',
    email: d.email || '',
    service: d.service || '',
    origin: (d.origin||'').trim(),
    destination: (d.destination||'').trim(),
    start_date: d.start_date || '',
    end_date: d.end_date || '',
    days: parseInt(d.days || 0),
    pax: parseInt(d.pax || 1),
    wants_cab: parseBool(d.wants_cab) ? 1 : 0,
    notes: d.notes || '',
    verified: (d.otp === DEMO_OTP) ? 1 : 0
  });
  res.json({ ok: true, id: info.lastInsertRowid });
});

app.get('/api/leads', requireAdmin, (req, res) => {
  const rows = db.prepare('SELECT * FROM leads ORDER BY id DESC').all();
  res.json(rows);
});

/* ---------- Rates & Settings (Admin) ---------- */
app.get('/api/settings', requireAdmin, (req, res) => {
  const row = db.prepare('SELECT * FROM settings WHERE id = 1').get();
  res.json(row);
});
app.post('/api/settings', requireAdmin, (req, res) => {
  const s = req.body || {};
  db.prepare(`UPDATE settings SET
    service_fee_flat = COALESCE(@service_fee_flat, service_fee_flat),
    service_fee_percent = COALESCE(@service_fee_percent, service_fee_percent),
    markup_percent_budget = COALESCE(@markup_percent_budget, markup_percent_budget),
    markup_percent_standard = COALESCE(@markup_percent_standard, markup_percent_standard),
    markup_percent_premium = COALESCE(@markup_percent_premium, markup_percent_premium),
    gst_percent = COALESCE(@gst_percent, gst_percent),
    currency = COALESCE(@currency, currency)
    WHERE id = 1`).run(s);
  res.json({ ok: true });
});

app.get('/api/rates', requireAdmin, (req, res) => {
  const rows = db.prepare('SELECT * FROM rates ORDER BY id DESC').all();
  res.json(rows);
});
app.post('/api/rates', requireAdmin, (req, res) => {
  const r = req.body || {};
  const route_key = `${(r.origin||'').toLowerCase()}|${(r.destination||'').toLowerCase()}`;
  const stmt = db.prepare(`INSERT INTO rates (
    route_key, train_oneway, train_return, bus_oneway, bus_return, flight_oneway, flight_return,
    hotel_per_night_budget, hotel_per_night_standard, hotel_per_night_premium,
    cab_daily_budget, cab_daily_standard, cab_daily_premium
  ) VALUES (@route_key, @train_oneway, @train_return, @bus_oneway, @bus_return, @flight_oneway, @flight_return,
    @hotel_per_night_budget, @hotel_per_night_standard, @hotel_per_night_premium,
    @cab_daily_budget, @cab_daily_standard, @cab_daily_premium)
  ON CONFLICT(route_key) DO UPDATE SET
    train_oneway=excluded.train_oneway, train_return=excluded.train_return,
    bus_oneway=excluded.bus_oneway, bus_return=excluded.bus_return,
    flight_oneway=excluded.flight_oneway, flight_return=excluded.flight_return,
    hotel_per_night_budget=excluded.hotel_per_night_budget,
    hotel_per_night_standard=excluded.hotel_per_night_standard,
    hotel_per_night_premium=excluded.hotel_per_night_premium,
    cab_daily_budget=excluded.cab_daily_budget,
    cab_daily_standard=excluded.cab_daily_standard,
    cab_daily_premium=excluded.cab_daily_premium
  `);
  stmt.run({
    route_key,
    train_oneway: r.train_oneway || null,
    train_return: r.train_return || null,
    bus_oneway: r.bus_oneway || null,
    bus_return: r.bus_return || null,
    flight_oneway: r.flight_oneway || null,
    flight_return: r.flight_return || null,
    hotel_per_night_budget: r.hotel_per_night_budget || null,
    hotel_per_night_standard: r.hotel_per_night_standard || null,
    hotel_per_night_premium: r.hotel_per_night_premium || null,
    cab_daily_budget: r.cab_daily_budget || null,
    cab_daily_standard: r.cab_daily_standard || null,
    cab_daily_premium: r.cab_daily_premium || null
  });
  res.json({ ok: true });
});

/* ---------- Planner (AI-like rules engine) ---------- */
app.post('/api/plan', async (req, res) => {
  const q = req.body || {};
  const origin = (q.origin || '').toLowerCase().trim();
  const destination = (q.destination || '').toLowerCase().trim();
  const pax = parseInt(q.pax || 1);
  const days = parseInt(q.days || 1);
  const wantsCab = parseBool(q.wants_cab);
  const travelMode = (q.travel_mode || 'train'); // train | bus | flight

  const route_key = `${origin}|${destination}`;
  const r = db.prepare('SELECT * FROM rates WHERE route_key = ?').get(route_key);
  const s = db.prepare('SELECT * FROM settings WHERE id = 1').get();

  function priceOrZero(v){ return (typeof v === 'number' && !isNaN(v)) ? v : 0; }
  function applyMarkup(base, pct){ return base * (1 + (pct/100)); }
  function addServiceFee(amount){ return amount + (s.service_fee_flat || 0) + (amount * (s.service_fee_percent||0)/100); }
  function pack(name, travel_cost, hotel_per_night, cab_daily, markupPct){
    let total = 0;
    total += travel_cost; // round trip if provided
    total += priceOrZero(hotel_per_night) * days;
    if (wantsCab) total += priceOrZero(cab_daily) * days;
    total = applyMarkup(total, markupPct);
    total = addServiceFee(total);
    if (s.gst_percent && s.gst_percent > 0){
      total = total * (1 + s.gst_percent/100);
    }
    return { tier: name, currency: s.currency || 'INR', total: Math.round(total) };
  }

  // derive travel cost based on mode
  let travelRoundTrip = 0;
  if (travelMode === 'train') {
    travelRoundTrip = priceOrZero(r?.train_return || 0);
  } else if (travelMode === 'bus') {
    travelRoundTrip = priceOrZero(r?.bus_return || 0);
  } else if (travelMode === 'flight') {
    travelRoundTrip = priceOrZero(r?.flight_return || 0);
  }

  const options = [
    pack('Budget', travelRoundTrip * pax, r?.hotel_per_night_budget, r?.cab_daily_budget, s.markup_percent_budget),
    pack('Standard', travelRoundTrip * pax, r?.hotel_per_night_standard, r?.cab_daily_standard, s.markup_percent_standard),
    pack('Premium', travelRoundTrip * pax, r?.hotel_per_night_premium, r?.cab_daily_premium, s.markup_percent_premium),
  ];

  res.json({
    origin, destination, pax, days, wantsCab,
    travelMode,
    options,
    note: "Estimates based on admin-configured rates. Update exact fares in Admin > Rates."
  });
});

/* ---------- Serve Single Page Admin ---------- */
app.get('/admin', (req,res)=>{
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

/* ---------- Fallback to index ---------- */
app.get('*', (req,res)=>{
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`RWTS server running on http://localhost:${PORT}`);
});
