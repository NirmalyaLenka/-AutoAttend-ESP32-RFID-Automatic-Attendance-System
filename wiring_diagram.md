# 🔌 Hardware Wiring Guide

## Bill of Materials

| # | Component           | Qty | Notes                                  |
|---|---------------------|-----|----------------------------------------|
| 1 | ESP32 Dev Board     |  1  | 38-pin or 30-pin variant works fine    |
| 2 | MFRC522 RFID Module |  1  | 3.3V SPI, very common, ~₹80 / $1.50   |
| 3 | RFID Cards/Fobs     |  N  | 13.56 MHz Mifare Classic 1K            |
| 4 | Green LED           |  1  | 5mm, any colour                        |
| 5 | Red LED             |  1  | 5mm                                    |
| 6 | Active Buzzer       |  1  | 3.3V – active (not passive)            |
| 7 | 220Ω Resistor       |  2  | For LEDs                               |
| 8 | Breadboard + Wires  |  1  | –                                      |
| 9 | USB cable           |  1  | Micro-USB or USB-C depending on board  |

**Total cost: ~₹400–600 / $5–8**

---

## Wiring Diagram (ASCII)

```
  ┌────────────────────────────────────────────┐
  │               ESP32 Dev Board              │
  │                                            │
  │  3.3V ──────────────────── VCC (MFRC522)  │
  │  GND  ──────────────────── GND (MFRC522)  │
  │  GPIO 18 (SCK)  ─────────── SCK (MFRC522) │
  │  GPIO 19 (MISO) ─────────── MISO(MFRC522) │
  │  GPIO 23 (MOSI) ─────────── MOSI(MFRC522) │
  │  GPIO 5  (SS)   ─────────── SDA (MFRC522) │
  │  GPIO 22 (RST)  ─────────── RST (MFRC522) │
  │                                            │
  │  GPIO 25 ──[220Ω]── Green LED ── GND      │
  │  GPIO 26 ──[220Ω]── Red LED   ── GND      │
  │  GPIO 27 ──────── (+) Buzzer  ── GND      │
  └────────────────────────────────────────────┘
```

---

## Step-by-Step Visual

### Step 1 – MFRC522 to ESP32 (SPI bus)

```
MFRC522 Module          ESP32 Pin
─────────────           ──────────
  SDA   (pin 1)  ──────  GPIO  5
  SCK   (pin 2)  ──────  GPIO 18
  MOSI  (pin 3)  ──────  GPIO 23
  MISO  (pin 4)  ──────  GPIO 19
  IRQ   (pin 5)  ──  NC  (not connected)
  GND   (pin 6)  ──────  GND
  RST   (pin 7)  ──────  GPIO 22
  3.3V  (pin 8)  ──────  3.3V  ⚠️  DO NOT connect to 5V!
```

### Step 2 – LEDs

```
  GPIO 25 ──── [220Ω] ──── (+) Green LED (–) ──── GND
  GPIO 26 ──── [220Ω] ──── (+) Red   LED (–) ──── GND
```
The flat side of the LED is the negative (–) leg.

### Step 3 – Buzzer

```
  GPIO 27 ──── (+) Buzzer (–) ──── GND
```
Make sure you buy an **active** buzzer (it beeps by itself when power is applied).

---

## Important Notes

- **Voltage**: MFRC522 runs on **3.3V only**. Connecting it to 5V will damage it.
- **Antenna distance**: The RFID card should be held within 2–3 cm of the reader antenna.
- **Enclosure**: You can 3D-print or use a project box. Put the reader on the outside of the classroom door.
- **Power**: In production power the ESP32 from a USB phone charger or a 5V wall adapter.

---

## Fritzing / KiCad

A Fritzing `.fzz` breadboard diagram is available in `/hardware/fritzing/` (see the `hardware` folder).
