/**
 * AutoAttend – Node.js / Express Backend
 * ─────────────────────────────────────────────────────
 *  • REST API  :  POST /api/attendance
 *                 GET  /api/attendance
 *                 GET  /api/students
 *                 POST /api/students   (register a card name)
 *                 GET  /api/dashboard  (live stats)
 *  • WebSocket :  broadcasts real-time events to dashboard
 *  • Database  :  SQLite via better-sqlite3  (zero setup)
 * ─────────────────────────────────────────────────────
 */

const express   = require('express');
const Database  = require('better-sqlite3');
const cors      = require('cors');
const { WebSocketServer } = require('ws');
const http      = require('http');
const path      = require('path');

// ── Config ──────────────────────────────────────────
const PORT    = process.env.PORT || 3000;
const DB_FILE = process.env.DB_FILE || './attendance.db';

// ── App Setup ────────────────────────────────────────
const app    = express();
const server = http.createServer(app);
const wss    = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Database Setup ───────────────────────────────────
const db = new Database(DB_FILE);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS students (
    uid        TEXT PRIMARY KEY,
    name       TEXT NOT NULL DEFAULT 'Unknown',
    roll_no    TEXT,
    class      TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS attendance (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    uid         TEXT    NOT NULL,
    event_type  TEXT    NOT NULL CHECK(event_type IN ('ENTRY','EXIT')),
    timestamp   TEXT    DEFAULT (datetime('now','localtime')),
    device      TEXT,
    duration_s  INTEGER,   -- filled in on EXIT
    FOREIGN KEY (uid) REFERENCES students(uid) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_attendance_uid  ON attendance(uid);
  CREATE INDEX IF NOT EXISTS idx_attendance_ts   ON attendance(timestamp);
`);

// ── Prepared Statements ──────────────────────────────
const stmts = {
  upsertStudent : db.prepare(`
    INSERT INTO students (uid, name) VALUES (?, ?)
    ON CONFLICT(uid) DO NOTHING
  `),
  getStudent   : db.prepare('SELECT * FROM students WHERE uid = ?'),
  allStudents  : db.prepare('SELECT * FROM students ORDER BY name'),
  updateStudent: db.prepare(`
    UPDATE students SET name=?, roll_no=?, class=? WHERE uid=?
  `),

  insertEvent  : db.prepare(`
    INSERT INTO attendance (uid, event_type, device)
    VALUES (?, ?, ?)
  `),
  lastEntry    : db.prepare(`
    SELECT * FROM attendance
    WHERE uid = ? AND event_type = 'ENTRY'
    ORDER BY id DESC LIMIT 1
  `),
  updateDuration: db.prepare(`
    UPDATE attendance SET duration_s = ? WHERE id = ?
  `),
  allRecords   : db.prepare(`
    SELECT a.*, s.name, s.roll_no, s.class
    FROM attendance a
    LEFT JOIN students s ON a.uid = s.uid
    ORDER BY a.id DESC
    LIMIT 200
  `),
  recordsByDate: db.prepare(`
    SELECT a.*, s.name, s.roll_no, s.class
    FROM attendance a
    LEFT JOIN students s ON a.uid = s.uid
    WHERE date(a.timestamp) = ?
    ORDER BY a.id DESC
  `),
  presentToday : db.prepare(`
    SELECT DISTINCT uid FROM attendance
    WHERE date(timestamp) = date('now','localtime')
      AND event_type = 'ENTRY'
  `),
  totalToday   : db.prepare(`
    SELECT COUNT(*) as cnt FROM attendance
    WHERE date(timestamp) = date('now','localtime')
      AND event_type = 'ENTRY'
  `),
  recentActivity: db.prepare(`
    SELECT a.*, s.name FROM attendance a
    LEFT JOIN students s ON a.uid = s.uid
    ORDER BY a.id DESC LIMIT 10
  `),
};

// ── WebSocket Broadcast ───────────────────────────────
function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === 1) client.send(msg);
  });
}

wss.on('connection', ws => {
  console.log('[WS] Client connected');
  ws.on('close', () => console.log('[WS] Client disconnected'));
});

// ── Helper: format seconds to h m s string ────────────
function formatDuration(secs) {
  if (!secs) return null;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// ── POST /api/attendance  (called by ESP32) ───────────
app.post('/api/attendance', (req, res) => {
  const { uid, eventType, device } = req.body;

  if (!uid || !eventType) {
    return res.status(400).json({ error: 'uid and eventType required' });
  }

  const upperEvent = eventType.toUpperCase();
  if (!['ENTRY', 'EXIT'].includes(upperEvent)) {
    return res.status(400).json({ error: 'eventType must be ENTRY or EXIT' });
  }

  // Auto-register unknown cards with a placeholder name
  stmts.upsertStudent.run(uid, `Student-${uid.slice(-4)}`);
  const student = stmts.getStudent.get(uid);

  // Insert event
  const info = stmts.insertEvent.run(uid, upperEvent, device || null);

  // On EXIT: compute duration since last ENTRY
  let duration    = null;
  let durationFmt = null;
  if (upperEvent === 'EXIT') {
    const lastEntry = stmts.lastEntry.get(uid);
    if (lastEntry) {
      const entryTime = new Date(lastEntry.timestamp);
      const exitTime  = new Date();
      duration = Math.round((exitTime - entryTime) / 1000);
      durationFmt = formatDuration(duration);
      stmts.updateDuration.run(duration, info.lastInsertRowid);
    }
  }

  const record = {
    id        : info.lastInsertRowid,
    uid,
    eventType : upperEvent,
    student   : student.name,
    rollNo    : student.roll_no,
    class     : student.class,
    timestamp : new Date().toISOString(),
    duration  : duration,
    durationFmt,
    device    : device || null,
  };

  // Push to all connected dashboards instantly
  broadcast({ type: 'NEW_EVENT', record });

  console.log(`[Event] ${upperEvent}  UID=${uid}  Name=${student.name}  Duration=${durationFmt || '-'}`);
  res.json({ success: true, record });
});

// ── GET /api/attendance  (list records) ──────────────
app.get('/api/attendance', (req, res) => {
  const { date } = req.query;
  const records  = date
    ? stmts.recordsByDate.all(date)
    : stmts.allRecords.all();
  res.json(records);
});

// ── GET /api/students ────────────────────────────────
app.get('/api/students', (req, res) => {
  res.json(stmts.allStudents.all());
});

// ── POST /api/students  (register or update a card) ──
app.post('/api/students', (req, res) => {
  const { uid, name, roll_no, class: cls } = req.body;
  if (!uid || !name) return res.status(400).json({ error: 'uid and name required' });

  stmts.upsertStudent.run(uid, name);
  stmts.updateStudent.run(name, roll_no || null, cls || null, uid);

  res.json({ success: true, student: stmts.getStudent.get(uid) });
});

// ── GET /api/dashboard  (stats snapshot) ─────────────
app.get('/api/dashboard', (req, res) => {
  const presentCount   = stmts.presentToday.all().length;
  const totalTodayTaps = stmts.totalToday.get().cnt;
  const recentActivity = stmts.recentActivity.all();
  const allStudents    = stmts.allStudents.all().length;

  res.json({
    presentToday  : presentCount,
    totalStudents : allStudents,
    tapsToday     : totalTodayTaps,
    recentActivity,
  });
});

// ── Test endpoint to simulate a tap from browser ─────
app.post('/api/simulate', (req, res) => {
  const { uid, name, eventType } = req.body;
  req.body.device = 'SIMULATOR';
  req.url = '/api/attendance';
  // Just forward it
  const forwardReq = Object.assign({}, req, {
    body: { uid, eventType, device: 'SIMULATOR' }
  });

  // Quick inline duplicate of attendance logic
  stmts.upsertStudent.run(uid, name || `Student-${uid.slice(-4)}`);
  stmts.updateStudent.run(name || `Student-${uid.slice(-4)}`, null, null, uid);
  const student = stmts.getStudent.get(uid);
  const info    = stmts.insertEvent.run(uid, eventType.toUpperCase(), 'SIMULATOR');

  let duration = null, durationFmt = null;
  if (eventType.toUpperCase() === 'EXIT') {
    const last = stmts.lastEntry.get(uid);
    if (last) {
      duration    = Math.round((Date.now() - new Date(last.timestamp)) / 1000);
      durationFmt = formatDuration(duration);
      stmts.updateDuration.run(duration, info.lastInsertRowid);
    }
  }

  const record = { id: info.lastInsertRowid, uid, eventType: eventType.toUpperCase(),
    student: student.name, timestamp: new Date().toISOString(), duration, durationFmt };
  broadcast({ type: 'NEW_EVENT', record });
  res.json({ success: true, record });
});

// ── Start ─────────────────────────────────────────────
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n╔══════════════════════════════════╗`);
  console.log(`║  AutoAttend Server  v1.0         ║`);
  console.log(`║  http://localhost:${PORT}           ║`);
  console.log(`╚══════════════════════════════════╝\n`);
});
