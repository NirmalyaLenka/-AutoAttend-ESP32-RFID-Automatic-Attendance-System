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
| 📡 Real-time dashboard | WebSocket push — updates the browser the instant a card is tapped |
| 🗄️ SQLite database | Zero setup, everything stored in a single file |
| 📋 Student registration | Register card UIDs with names, roll numbers, class from the dashboard |
| 🔌 Offline resilience | ESP32 retries WiFi; state survives reboots using NVS flash |
| 🧪 Built-in simulator | Test the dashboard without any hardware |
| 🌐 REST API | Export records, filter by date, integrate with any system |
| 💸 Cheap hardware | Full BOM under ₹600 / $8 |

---

## 🗂️ Project Structure

```
auto-attendance/
├── firmware/
│   └── attendance_firmware.ino   ← Flash this to the ESP32
├── server/
│   ├── server.js                 ← Node.js backend
│   ├── package.json
│   └── public/
│       └── index.html            ← Web dashboard (served by Node)
├── hardware/
│   └── wiring_diagram.md         ← Full wiring guide with ASCII diagrams
├── docs/
│   └── api_reference.md          ← REST API reference
├── .gitignore
├── LICENSE
└── README.md                     ← You are here
```

---

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

See `/hardware/wiring_diagram.md` for the complete wiring guide.

---

## 🚀 Quick Start

### 1 — Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/auto-attendance.git
cd auto-attendance
```

### 2 — Start the server

```bash
cd server
npm install
npm start
```
Open your browser at **http://localhost:3000** — the dashboard is up!

> **Find your server's local IP** (needed for the ESP32):
> - **Windows**: `ipconfig` → look for IPv4 Address (e.g. `192.168.1.100`)
> - **Linux/Mac**: `ip a` or `ifconfig` → look for `inet` on your WiFi interface

### 3 — Flash the firmware

**Install Arduino IDE dependencies first:**

In Arduino IDE → Library Manager, install:
- `MFRC522` by GithubCommunity
- `ArduinoJson` by Benoit Blanchon

Also install the ESP32 board package:
- File → Preferences → Additional Boards URLs → add:
  `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`
- Tools → Board Manager → search `esp32` → install

**Edit firmware/attendance_firmware.ino** — change these three lines:

```cpp
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* SERVER_URL    = "http://192.168.1.100:3000";  // ← your PC's IP
```

Then:
- Select **Tools → Board → ESP32 Dev Module**
- Select the correct **COM port**
- Click **Upload** ✓

### 4 — Wire the hardware

Follow `/hardware/wiring_diagram.md`.
Short summary:

```
MFRC522 SDA  → GPIO 5    MFRC522 SCK  → GPIO 18
MFRC522 MOSI → GPIO 23   MFRC522 MISO → GPIO 19
MFRC522 RST  → GPIO 22   MFRC522 VCC  → 3.3V  MFRC522 GND → GND
Green LED    → GPIO 25 (via 220Ω)
Red LED      → GPIO 26 (via 220Ω)
Buzzer (+)   → GPIO 27
```

### 5 — Register students

1. Ask a student to tap their RFID card (it will appear as `Student-XXXX`)
2. In the dashboard sidebar, enter their real name + roll number, paste the UID, click **Register Card**
3. Future taps will show their name instantly

---

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
