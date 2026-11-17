# 📡 AutoAttend – ESP32 RFID Automatic Attendance System

> **Beginner-friendly · Zero cloud required · Real-time dashboard · Open-source MIT**

A complete automatic attendance system using an **ESP32 microcontroller** and an **MFRC522 RFID reader**.
Students tap their RFID card at the classroom door. The system logs **entry** and **exit** timestamps, calculates time spent in class, and streams everything live to a beautiful web dashboard hosted on your local network.

---



---

## ✨ Features

| Feature | Detail |
|---------|--------|
| 🟢 Auto ENTRY / EXIT | First tap = entry, second tap = exit — automatic toggle |
| ⏱️ Duration tracking | Calculates exact time each student spent in class |
| 📡 Live event transport | The API broadcasts events over WebSocket; the checked-in dashboard is not currently served by the backend path configuration |
| 🗄️ SQLite database | Zero setup, everything stored in a single file |
| 📋 Student registration | Register card UIDs with names, roll numbers, class from the dashboard |
| 🔌 Offline resilience | ESP32 retries WiFi; state survives reboots using NVS flash |
| 🧪 Built-in simulator | Test the dashboard without any hardware |
| 🌐 REST API | Export records, filter by date, integrate with any system |
| 💸 Cheap hardware | Full BOM under ₹600 / $8 |

---

## 🗂️ Project Structure

The checked-in files are at the repository root; the folder layout shown in older examples (`firmware/`, `server/`, `hardware/`, and `docs/`) is not present.

```text
.
├── attendance_firmware.ino   # ESP32 RFID reader, Wi-Fi client and GPIO feedback
├── server.js                 # Express REST API, WebSocket broadcast and SQLite setup
├── package.json              # Node.js scripts and server dependencies
├── index.html                # Dashboard source (currently not served by server.js)
├── api_reference.md          # REST and WebSocket API notes
├── wiring_diagram.md         # Hardware pinout and bill of materials
└── LICENSE
```

The backend's static-file middleware points to a `public/` directory, but that directory is absent from the current tree. Consequently, the checked-in `index.html` is not automatically served at `/`. See **Known limitations** below. No files were moved as part of this documentation review.

## 🛒 Hardware Required

| Component | Cost (approx) |
|-----------|--------------|
| ESP32 Dev Board (any 38-pin) | ₹250 / $3 |
| MFRC522 RFID Module | ₹80 / $1.50 | <img width="288" height="288" alt="image" src="https://github.com/user-attachments/assets/d55e2a89-5792-4a9f-8bae-78bb1db62892" />

| RFID Cards or Key Fobs (pack of 10) | ₹150 / $2 |
| Green + Red LED + 220Ω resistors | ₹20 / $0.30 |
| Active Buzzer 3.3V | ₹20 / $0.30 |
| Breadboard + jumper wires | ₹80 / $1.50 |
| **Total** | **~₹600 / $8** |

See [wiring_diagram.md](wiring_diagram.md) for the complete wiring guide.

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18 or newer and npm
- Arduino IDE with the ESP32 board package
- ESP32 development board, MFRC522 reader, RFID cards, two LEDs with current-limiting resistors, and an active buzzer
- The `MFRC522` and `ArduinoJson` Arduino libraries

### 1. Start the backend

```bash
git clone https://github.com/NirmalyaLenka/-AutoAttend-ESP32-RFID-Automatic-Attendance-System.git autoattend
cd autoattend
npm install
npm start
```

The server listens on port `3000` by default. The SQLite database file is `attendance.db` in the server's working directory; set `PORT` or `DB_FILE` environment variables to change those values.

**Current limitation:** the API can start independently, but `GET /` will not serve the dashboard from the current tree because `server.js` serves `public/` while the only checked-in `index.html` is at the repository root. This review documents the mismatch; it does not change server code or move files.

### 2. Configure and upload the ESP32 firmware

Open `attendance_firmware.ino` from the repository root. Replace the Wi-Fi placeholders and `SERVER_URL` with the SSID, password, and LAN address of the computer running the server, for example `http://192.168.1.100:3000` (no trailing slash).

The sketch contains no working serial setup wizard despite a comment suggesting one. Install the ESP32 Arduino board package, select **ESP32 Dev Module** (or the matching board), select the correct serial port, and upload. Open Serial Monitor at **115200 baud** to inspect connection messages. The ESP32 and server must be able to reach each other on the same network.

### 3. Wire the hardware

Use [wiring_diagram.md](wiring_diagram.md) as the pin reference. The MFRC522 is a **3.3 V device**; do not power it from 5 V. Disconnect USB power before changing the wiring.

| Signal | ESP32 connection |
|---|---|
| MFRC522 SDA/SS | GPIO 5 |
| MFRC522 SCK | GPIO 18 |
| MFRC522 MOSI | GPIO 23 |
| MFRC522 MISO | GPIO 19 |
| MFRC522 RST | GPIO 22 |
| Green LED | GPIO 25 through 220 Ω resistor |
| Red LED | GPIO 26 through 220 Ω resistor |
| Active buzzer | GPIO 27 |
| MFRC522 VCC / GND | 3.3 V / GND |

### 4. Check the API

Open `http://localhost:3000/api/dashboard` to check whether the backend responds with JSON. The dashboard's `index.html` uses relative `/api/...` paths and a WebSocket at the current host, so opening it directly as a `file://` page is not a substitute for serving it from the backend.

Register only test/student data you are authorized to handle. See [api_reference.md](api_reference.md) for endpoint payloads.

## 📡 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/attendance` | Record a tap event (used by ESP32) |
| `GET`  | `/api/attendance` | Get last 200 records |
| `GET`  | `/api/attendance?date=YYYY-MM-DD` | Records for a specific date |
| `GET`  | `/api/students` | List all registered students |
| `POST` | `/api/students` | Register / update a student |
| `GET`  | `/api/dashboard` | Live stats snapshot |
| `POST` | `/api/simulate` | Simulate a tap (testing only) |

**POST /api/attendance payload (sent by ESP32):**
```json
{
  "uid":       "A1B2C3D4",
  "eventType": "ENTRY",
  "device":    "AA:BB:CC:DD:EE:FF"
}
```

---

## 🔧 Customisation

### Change the LED / Buzzer pins
Edit `#define` values at the top of the `.ino` file.

### Add more classes / subjects
Add a `subject` column to the database and include it in the POST payload.

### Export to CSV
```bash
sqlite3 -csv attendance.db "SELECT * FROM attendance;" > export.csv
```

### Run the server on boot (Linux / Raspberry Pi)
```bash
# using pm2
npm install -g pm2
pm2 start server.js --name autoattend
pm2 save && pm2 startup
```

---

## 🤝 Contributing

Pull requests are welcome! Ideas for contributions:
- Export to Google Sheets
- Email / SMS alerts when a student is absent
- Face-recognition mode using ESP32-CAM
- Multiple classroom support
- Progressive Web App (PWA) for offline dashboard

Please open an issue before starting a big feature.

---

## 📄 License

MIT © AutoAttend Contributors — see `LICENSE` for full text.

---

## ⭐ Show your support

If this project helped you, please give it a ⭐ on GitHub!
It helps others find the project.


---

## Skills & technologies

`Arduino/C++` · `JavaScript` · `HTML/CSS`


## Repository structure

Key files and folders (not exhaustive):

- `LICENSE`
- `README.md`
- `api_reference.md`
- `attendance_firmware.ino`
- `index.html`
- `package.json`
- `server.js`
- `wiring_diagram.md`


## How it works and known limitations

- The firmware reads card UIDs from an MFRC522 over SPI, alternates each card's local state between ENTRY and EXIT, and posts events to the Node.js API.
- The server stores records in SQLite and broadcasts new events over WebSocket. Unknown UIDs are auto-registered with a placeholder name.
- The firmware stores its per-card IN/OUT state in ESP32 NVS and updates that state only after a successful HTTP response.
- The dashboard file is at the repository root, while the Express static middleware expects `public/`. The current repository therefore does not provide a working `/` dashboard route without a code or layout fix.
- The API uses permissive CORS and has no authentication or authorization. Do not expose it to the public internet or forward port 3000 from a router. Attendance records can contain personal data; use only on a trusted network and protect the database.
- The server and firmware were inspected, but no Node.js run, Arduino build, API test, or physical RFID test was performed during this documentation pass.

## Maintenance & Audit

- **Audit date:** 17 November 2026
- **Documentation status:** README reviewed and audit record added on this date.
- **Scope and evidence:** This is a documentation-level maintenance pass. It does not establish that source code compiles, dependencies are current, security has been tested, or hardware/runtime behavior has been verified.
- **Code and tests:** No new functional code changes or test results are claimed by this README update. Run project-specific build, test, and hardware/runtime checks before relying on the project.
- **Maintenance baseline:** Documentation status recorded through 11 November 2026; revisit setup instructions, dependencies, known limitations, and tests when the project changes.
