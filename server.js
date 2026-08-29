/**
 * Raksha Bandhan Spin & Win  —  server
 * -------------------------------------
 * - Serves the sister's spin page ( / ) and your live admin page ( /admin ).
 * - Uses Socket.io (WebSockets) for real-time results.
 * - The winning gift is decided HERE on the server (weighted odds) so it is
 *   fair and tamper-proof, then the wheel is told where to land.
 * - Each participant (identified by mobile number) can do the FINAL spin only once.
 * - Results are saved to data/results.json so nothing is lost on restart.
 */

const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

/* ------------------------------------------------------------------ *
 *  GIFTS  —  order here must match the order drawn on the wheel.
 *  "weight" is the chance out of the total (these add up to 100).
 * ------------------------------------------------------------------ */
// ALL OPTIONS EQUAL CHANCE: Each option has exactly 11.11% chance (9 items = 100% total).
const GIFTS = [
  { name: 'Designer Diary with Knob',            weight: 11.11 },
  { name: '\u20B91000 Cash',                     weight: 11.11 },
  { name: 'iPhone 17 Pro - 256GB Storage',       weight: 11.11 },
  { name: '\u20B92000 Cash',                     weight: 11.11 },
  { name: 'Diary with Password Lock',            weight: 11.11 },
  { name: 'Facewash + Moisturizer + Sunscreen',  weight: 11.11 },
  { name: 'Mini Bluetooth Speaker',              weight: 11.11 },
  { name: '\u20B91500 Cash',                     weight: 11.11 },
  { name: 'Hair Dryer',                          weight: 11.12 },
];

const TOTAL_WEIGHT = GIFTS.reduce((sum, g) => sum + g.weight, 0);

/** Pick a gift index using the weighted odds. */
function pickWeightedGift() {
  let r = Math.random() * TOTAL_WEIGHT;
  for (let i = 0; i < GIFTS.length; i++) {
    r -= GIFTS[i].weight;
    if (r < 0) return i;
  }
  return GIFTS.length - 1;
}

/* ------------------------------------------------------------------ *
 *  Persistence
 * ------------------------------------------------------------------ */
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'results.json');

/** participants: mobile -> { name, mobile, spun, giftIndex, giftName, message, registeredAt, spunAt } */
let participants = {};

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      participants = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) || {};
      console.log(`Loaded ${Object.keys(participants).length} participant(s) from disk.`);
    }
  } catch (err) {
    console.error('Could not read saved data, starting fresh:', err.message);
    participants = {};
  }
}

function saveData() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(participants, null, 2));
  } catch (err) {
    console.error('Could not save data:', err.message);
  }
}

loadData();

/* ------------------------------------------------------------------ *
 *  Static files + routes
 * ------------------------------------------------------------------ */
app.use(express.static(path.join(__dirname, 'public')));

app.get('/admin', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Give the wheel its gift labels so the front-end never hardcodes them.
app.get('/api/gifts', (_req, res) => {
  res.json(GIFTS.map(g => ({ name: g.name })));
});

/* ------------------------------------------------------------------ *
 *  Real-time (Socket.io)
 * ------------------------------------------------------------------ */
function participantList() {
  return Object.values(participants).sort((a, b) => {
    return (b.registeredAt || 0) - (a.registeredAt || 0);
  });
}

io.on('connection', (socket) => {
  let isAdmin = false;

  /* ---- Admin joins the live dashboard (no password) ---- */
  socket.on('adminJoin', () => {
    isAdmin = true;
    socket.join('admins');
    socket.emit('adminWelcome', {
      gifts: GIFTS,
      participants: participantList(),
    });
  });

  /* ---- Sister registers her details ---- */
  socket.on('register', (data, ack) => {
    const name = String((data && data.name) || '').trim().slice(0, 60);
    const mobile = String((data && data.mobile) || '').replace(/\D/g, '').slice(0, 15);
    const secretCode = String((data && data.secretCode) || '').trim().slice(0, 40);
    const nameKey = name.toLowerCase().replace(/\s+/g, ' ').trim();

    if (name.length < 2) {
      if (ack) ack({ ok: false, error: 'Please enter your name.' });
      return;
    }
    if (mobile.length !== 10) {
      if (ack) ack({ ok: false, error: 'Please enter a valid 10-digit mobile number.' });
      return;
    }
    if (!secretCode) {
      if (ack) ack({ ok: false, error: 'Please choose a secret code.' });
      return;
    }

    // Locked person: "pooja" must use the correct number.
    if (nameKey === 'pooja' && mobile !== '7057470091') {
      if (ack) ack({ ok: false, error: 'Wrong number. Please check and try again.' });
      return;
    }

    socket.data.nameKey = nameKey;

    // One spin per unique NAME.
    const existing = participants[nameKey];
    if (existing && existing.spun) {
      if (ack) ack({ ok: true, alreadySpun: true, giftIndex: existing.giftIndex, giftName: existing.giftName });
      return;
    }

    participants[nameKey] = existing || {
      name,
      mobile,
      secretCode,
      spun: false,
      giftIndex: null,
      giftName: null,
      message: null,
      registeredAt: Date.now(),
      spunAt: null,
    };
    participants[nameKey].name = name;             // keep latest values
    participants[nameKey].mobile = mobile;
    participants[nameKey].secretCode = secretCode;
    saveData();

    io.to('admins').emit('participantUpdate', participants[nameKey]);
    if (ack) ack({ ok: true, alreadySpun: false });
  });

  /* ---- Sister presses the FINAL spin ---- */
  socket.on('finalSpin', (ack) => {
    const key = socket.data.nameKey;
    const p = key ? participants[key] : null;

    if (!p) {
      if (ack) ack({ ok: false, error: 'Please enter your details first.' });
      return;
    }
    if (p.spun) {
      // Guard against refresh / double spin — one spin per name.
      if (ack) ack({ ok: true, alreadySpun: true, giftIndex: p.giftIndex, giftName: p.giftName });
      return;
    }

    const giftIndex = pickWeightedGift();
    p.spun = true;
    p.giftIndex = giftIndex;
    p.giftName = GIFTS[giftIndex].name;
    p.spunAt = Date.now();
    saveData();

    io.to('admins').emit('participantUpdate', p);
    if (ack) ack({ ok: true, giftIndex, giftName: p.giftName });
  });

  /* ---- Sister sends a thank-you message ---- */
  socket.on('thankYouMessage', (msg, ack) => {
    const key = socket.data.nameKey;
    const p = key ? participants[key] : null;
    if (!p) {
      if (ack) ack({ ok: false });
      return;
    }
    p.message = String(msg || '').trim().slice(0, 1000);
    saveData();
    io.to('admins').emit('participantUpdate', p);
    if (ack) ack({ ok: true });
  });

  socket.on('disconnect', () => {
    if (isAdmin) socket.leave('admins');
  });
});

/* ------------------------------------------------------------------ *
 *  Start + print handy local network addresses
 * ------------------------------------------------------------------ */
function printAddresses() {
  const os = require('os');
  const nets = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) ips.push(net.address);
    }
  }
  console.log('\n  Raksha Bandhan Spin & Win is running!');
  console.log('  ----------------------------------------');
  console.log(`  On this computer:      http://localhost:${PORT}`);
  ips.forEach(ip => {
    console.log(`  Sister opens (phone):  http://${ip}:${PORT}`);
  });
  ips.forEach(ip => {
    console.log(`  You open (admin):      http://${ip}:${PORT}/admin`);
  });
  console.log('  ----------------------------------------');
  console.log('  Keep this window open. Press Ctrl+C to stop.\n');
}

server.listen(PORT, () => printAddresses());
