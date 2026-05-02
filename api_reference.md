# AutoAttend REST API Reference

Base URL: `http://YOUR_SERVER_IP:3000`

---

## POST /api/attendance
**Called by the ESP32 on every card tap.**

**Request body:**
```json
{
  "uid":       "A1B2C3D4",      // Card UID (required)
  "eventType": "ENTRY",         // "ENTRY" or "EXIT" (required)
  "device":    "AA:BB:CC:DD:EE:FF"  // ESP32 MAC address (optional)
}
```

**Response 200:**
```json
{
  "success": true,
  "record": {
    "id":          42,
    "uid":         "A1B2C3D4",
    "eventType":   "ENTRY",
    "student":     "Riya Sharma",
    "rollNo":      "23CS007",
    "class":       "CS-B 2nd Year",
    "timestamp":   "2025-03-15T09:04:22.000Z",
    "duration":    null,
    "durationFmt": null,
    "device":      "AA:BB:CC:DD:EE:FF"
  }
}
```
On EXIT, `duration` is the seconds the student was in class and `durationFmt` is human-readable (e.g. `"1h 23m"`).

---

## GET /api/attendance
Returns the last 200 records across all students.

**Query params:**
- `?date=2025-03-15` — filter to a specific date (YYYY-MM-DD)

**Response 200:** Array of record objects (same shape as above + joined student fields)

---

## GET /api/students
Returns all registered students.

**Response 200:**
```json
[
  {
    "uid":        "A1B2C3D4",
    "name":       "Riya Sharma",
    "roll_no":    "23CS007",
    "class":      "CS-B 2nd Year",
    "created_at": "2025-03-10T10:00:00"
  }
]
```

---

## POST /api/students
Register or update a student's card.

**Request body:**
```json
{
  "uid":     "A1B2C3D4",       // required
  "name":    "Riya Sharma",    // required
  "roll_no": "23CS007",        // optional
  "class":   "CS-B 2nd Year"  // optional
}
```

**Response 200:**
```json
{ "success": true, "student": { ... } }
```

---

## GET /api/dashboard
Returns a stats snapshot for the live counters.

**Response 200:**
```json
{
  "presentToday":   12,
  "totalStudents":  30,
  "tapsToday":      24,
  "recentActivity": [ ... last 10 records ... ]
}
```

---

## POST /api/simulate
Simulate a tap from the browser (dev/demo — no hardware needed).

**Request body:**
```json
{
  "uid":       "DEMO0000",
  "name":      "Test Student",
  "eventType": "ENTRY"
}
```

---

## WebSocket
Connect to `ws://YOUR_SERVER_IP:3000`

**Pushed message on every new event:**
```json
{
  "type":   "NEW_EVENT",
  "record": { ... same record shape as POST /api/attendance ... }
}
```
