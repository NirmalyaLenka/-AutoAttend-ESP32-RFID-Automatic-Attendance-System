/*
 * =====================================================
 *  AutoAttend – ESP32 RFID Attendance Firmware
 *  Sensor : MFRC522 (SPI)
 *  Board  : ESP32 Dev Module
 *  Author : AutoAttend Contributors
 *  License: MIT
 * =====================================================
 *
 *  HOW IT WORKS
 *  ────────────
 *  • Student taps RFID card  →  1st tap = ENTRY recorded
 *  • Student taps RFID card  →  2nd tap = EXIT  recorded
 *  • ESP32 POSTs JSON to your Node.js server over WiFi
 *  • Green LED + beep = success  │  Red LED + long beep = error
 *
 *  WIRING (see /hardware/wiring_diagram.md for full diagram)
 *  ──────────────────────────────────────────────────────────
 *  MFRC522 Pin  │  ESP32 Pin
 *  ─────────────┼───────────
 *  SDA (SS)     │  GPIO 5
 *  SCK          │  GPIO 18
 *  MOSI         │  GPIO 23
 *  MISO         │  GPIO 19
 *  RST          │  GPIO 22
 *  3.3V         │  3.3V
 *  GND          │  GND
 *
 *  LED & Buzzer
 *  ─────────────
 *  Green LED    │  GPIO 25 (+ 220Ω resistor to GND)
 *  Red   LED    │  GPIO 26 (+ 220Ω resistor to GND)
 *  Buzzer       │  GPIO 27
 */

#include <SPI.h>
#include <MFRC522.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>   // NVS flash storage (built-in)

// ── Pin Definitions ──────────────────────────────────
#define SS_PIN      5
#define RST_PIN     22
#define LED_GREEN   25
#define LED_RED     26
#define BUZZER_PIN  27

// ── User Configuration ────────────────────────────────
// Edit these before flashing, or use the Serial setup wizard
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* SERVER_URL    = "http://YOUR_SERVER_IP:3000";  // No trailing slash
// e.g. "http://192.168.1.100:3000"

// ── Timing Constants ─────────────────────────────────
#define DEBOUNCE_MS         2000   // Ignore same card for 2 s after tap
#define WIFI_RETRY_DELAY    500
#define WIFI_MAX_RETRIES    20

// ── Globals ───────────────────────────────────────────
MFRC522 mfrc522(SS_PIN, RST_PIN);
Preferences prefs;

// Simple in-memory state: maps UID → "IN" or "OUT"
// We use ESP32 NVS (Preferences) so state survives reboots
String lastUID = "";
unsigned long lastTapTime = 0;

// ── Helper: read current state for a UID ─────────────
String getStudentState(const String& uid) {
  prefs.begin("attendance", false);
  String state = prefs.getString(uid.c_str(), "OUT");
  prefs.end();
  return state;
}

void setStudentState(const String& uid, const String& state) {
  prefs.begin("attendance", false);
  prefs.putString(uid.c_str(), state);
  prefs.end();
}

// ── Helper: build card UID string ────────────────────
String getUID() {
  String uid = "";
  for (byte i = 0; i < mfrc522.uid.size; i++) {
    if (mfrc522.uid.uidByte[i] < 0x10) uid += "0";
    uid += String(mfrc522.uid.uidByte[i], HEX);
  }
  uid.toUpperCase();
  return uid;
}

// ── Feedback helpers ─────────────────────────────────
void beep(int ms) {
  digitalWrite(BUZZER_PIN, HIGH);
  delay(ms);
  digitalWrite(BUZZER_PIN, LOW);
}

void successFeedback() {
  digitalWrite(LED_GREEN, HIGH);
  beep(100);
  delay(100);
  beep(100);
  delay(300);
  digitalWrite(LED_GREEN, LOW);
}

void errorFeedback() {
  digitalWrite(LED_RED, HIGH);
  beep(600);
  delay(200);
  digitalWrite(LED_RED, LOW);
}

void waitingBlink() {
  // Gentle pulse on green to show it's alive
  static unsigned long last = 0;
  static bool state = false;
  if (millis() - last > 1000) {
    state = !state;
    digitalWrite(LED_GREEN, state);
    last = millis();
  }
}

// ── WiFi Connect ─────────────────────────────────────
void connectWiFi() {
  Serial.printf("\n[WiFi] Connecting to %s", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int retries = 0;
  while (WiFi.status() != WL_CONNECTED && retries < WIFI_MAX_RETRIES) {
    delay(WIFI_RETRY_DELAY);
    Serial.print(".");
    retries++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n[WiFi] Connected! IP: %s\n", WiFi.localIP().toString().c_str());
    // Quick double blink on green
    for (int i = 0; i < 3; i++) {
      digitalWrite(LED_GREEN, HIGH); delay(100);
      digitalWrite(LED_GREEN, LOW);  delay(100);
    }
  } else {
    Serial.println("\n[WiFi] FAILED – will retry on next tap");
    errorFeedback();
  }
}

// ── POST attendance event to server ──────────────────
bool postAttendance(const String& uid, const String& eventType) {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
    if (WiFi.status() != WL_CONNECTED) return false;
  }

  HTTPClient http;
  String endpoint = String(SERVER_URL) + "/api/attendance";
  http.begin(endpoint);
  http.addHeader("Content-Type", "application/json");

  // Build JSON payload
  StaticJsonDocument<200> doc;
  doc["uid"]       = uid;
  doc["eventType"] = eventType;    // "ENTRY" or "EXIT"
  doc["device"]    = WiFi.macAddress();

  String payload;
  serializeJson(doc, payload);

  Serial.printf("[HTTP] POST %s  body=%s\n", endpoint.c_str(), payload.c_str());

  int code = http.POST(payload);
  bool ok  = (code >= 200 && code < 300);

  if (ok) {
    Serial.printf("[HTTP] Response %d: %s\n", code, http.getString().c_str());
  } else {
    Serial.printf("[HTTP] Error %d: %s\n", code, http.errorToString(code).c_str());
  }

  http.end();
  return ok;
}

// ── Setup ─────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  Serial.println("\n\n╔══════════════════════════╗");
  Serial.println("║  AutoAttend  v1.0        ║");
  Serial.println("╚══════════════════════════╝");

  // GPIO setup
  pinMode(LED_GREEN, OUTPUT);
  pinMode(LED_RED,   OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);

  // SPI + RFID
  SPI.begin();
  mfrc522.PCD_Init();
  mfrc522.PCD_DumpVersionToSerial();

  // WiFi
  connectWiFi();

  Serial.println("[Ready] Waiting for card tap…");
}

// ── Main Loop ─────────────────────────────────────────
void loop() {
  // Keep WiFi alive
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WiFi] Reconnecting…");
    connectWiFi();
  }

  // Idle blink
  waitingBlink();

  // Poll RFID reader
  if (!mfrc522.PICC_IsNewCardPresent()) return;
  if (!mfrc522.PICC_ReadCardSerial())   return;

  String uid = getUID();
  unsigned long now = millis();

  // Debounce: ignore same card tapped within DEBOUNCE_MS
  if (uid == lastUID && (now - lastTapTime) < DEBOUNCE_MS) {
    mfrc522.PICC_HaltA();
    return;
  }
  lastUID     = uid;
  lastTapTime = now;

  // Determine event type by toggling current state
  String currentState = getStudentState(uid);
  String eventType    = (currentState == "OUT") ? "ENTRY" : "EXIT";
  String newState     = (eventType == "ENTRY")  ? "IN"    : "OUT";

  Serial.printf("[RFID] UID=%s  currentState=%s  event=%s\n",
                uid.c_str(), currentState.c_str(), eventType.c_str());

  // Send to server
  bool sent = postAttendance(uid, eventType);

  if (sent) {
    setStudentState(uid, newState);
    successFeedback();
    Serial.printf("[OK] %s recorded for %s\n", eventType.c_str(), uid.c_str());
  } else {
    errorFeedback();
    Serial.println("[ERROR] Could not reach server – state NOT updated");
  }

  // Halt card so it isn't read again immediately
  mfrc522.PICC_HaltA();
  mfrc522.PCD_StopCrypto1();
}
