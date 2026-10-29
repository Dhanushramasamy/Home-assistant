/*
  Bluetooth Keyboard + Air-Mouse  —  M5Stack Cardputer / Cardputer ADV
  ====================================================================

  Turns the Cardputer into a wireless Bluetooth HID keyboard + mouse. Pair it
  from any PC / phone / Android-TV box ("Cardputer KB/Mouse") and the keys type,
  while the device acts as a mouse too. The mouse is switchable:

    - TILT (air mouse): tilt the Cardputer to move the pointer (BMI270 IMU).
    - KEYS:             move the pointer with the ; . , / cluster.

  Controls
    Fn + m : toggle  KEYBOARD  <->  MOUSE  mode
    Fn + t : (in MOUSE) toggle  TILT  <->  KEYS
    KEYBOARD mode : every key types to the paired device (full layout, modifiers)
    MOUSE mode    : move pointer (tilt or ; . , /),  Enter = left click,
                    Space = right click,  [ / ] = scroll up / down

  esp32 core 3.2.0. Libs: M5Cardputer, M5Unified, M5GFX, ESP32-BLE-Combo
  (patched for core 3.x). Board: M5Cardputer, default partitions.
*/

#include <M5Cardputer.h>
// M5 Keyboard_def.h #defines these as macros; BleCombo declares them as const.
// Drop the macros (unused here) so BleCombo's header compiles.
#undef KEY_LEFT_CTRL
#undef KEY_LEFT_SHIFT
#undef KEY_LEFT_ALT
#undef KEY_BACKSPACE
#undef KEY_TAB
#undef KEY_ENTER
#undef KEY_FN
#undef KEY_OPT
#include <BleCombo.h>

BleComboKeyboard kb("Cardputer KB/Mouse", "M5Stack", 100);
BleComboMouse    mouse(&kb);

auto &D = M5Cardputer.Display;
uint16_t C_BG, C_CARD, C_LIME, C_INK, C_MUTED, C_DIM, C_BLUE, C_RED;
const int W = 240, H = 135;

enum Mode { KEYBOARD, MOUSE };
Mode mode = KEYBOARD;
bool tilt = true;          // MOUSE sub-mode: true = tilt (IMU), false = keys
bool imuOk = false;

// edge-detect for Fn combos and click keys
bool prevFnM = false, prevFnT = false;
bool prevSpace = false, prevEnter = false;

unsigned long lastMove = 0, lastUi = 0;
bool lastConn = false;

// ---------------------------------------------------------------- UI
void drawUi() {
  D.fillScreen(C_BG);
  // header
  D.setFont(&fonts::DejaVu12); D.setTextDatum(middle_left);
  D.setTextColor(C_BLUE, C_BG); D.drawString("BT Keyboard + Mouse", 6, 12);
  int bat = M5Cardputer.Power.getBatteryLevel();
  if (bat >= 0) { D.setFont(&fonts::DejaVu9); D.setTextDatum(middle_right); D.setTextColor(C_MUTED, C_BG); D.drawString(String(bat) + "%", W - 6, 12); }
  D.drawFastHLine(0, 24, W, C_CARD);

  // connection status
  bool conn = kb.isConnected();
  D.setFont(&fonts::DejaVu12); D.setTextDatum(middle_left);
  D.setTextColor(conn ? C_LIME : C_RED, C_BG);
  D.drawString(conn ? "Connected" : "Pairing...  (open BT on device)", 6, 40);

  // big mode label
  D.setFont(&fonts::DejaVu18); D.setTextDatum(middle_center);
  if (mode == KEYBOARD) { D.setTextColor(C_INK, C_BG); D.drawString("KEYBOARD", W / 2, 68); }
  else { D.setTextColor(C_LIME, C_BG); D.drawString(tilt ? "MOUSE - TILT" : "MOUSE - KEYS", W / 2, 68); }

  // legend
  D.setFont(&fonts::DejaVu9); D.setTextDatum(middle_left); D.setTextColor(C_MUTED, C_BG);
  if (mode == KEYBOARD) {
    D.drawString("Keys type to device.  Fn+m = mouse mode", 6, 92);
    D.drawString("Fn+t switches tilt / keys in mouse mode", 6, 106);
  } else {
    D.drawString(tilt ? "Tilt to move.  Enter=L  Space=R" : "; . , / move.  Enter=L  Space=R", 6, 92);
    D.drawString("[ ] scroll   Fn+t switch   Fn+m keyboard", 6, 106);
  }
  if (mode == MOUSE && tilt && !imuOk) {
    D.setTextColor(C_RED, C_BG); D.drawString("IMU not found - use KEYS (Fn+t)", 6, 120);
  }
  lastConn = conn;
}

// ---------------------------------------------------------------- keyboard passthrough
void sendKbState() {
  auto k = M5Cardputer.Keyboard.keysState();
  KeyReport r = {0, 0, {0, 0, 0, 0, 0, 0}};
  r.modifiers = k.modifiers | (k.opt ? (1 << 3) : 0);   // opt -> GUI (Win/Cmd)
  int n = 0;
  for (uint8_t h : k.hid_keys) if (n < 6) r.keys[n++] = h;
  kb.sendReport(&r);
}

void setup() {
  auto cfg = M5.config();
  M5Cardputer.begin(cfg, true);
  D.setRotation(1); D.setBrightness(120);
  M5Cardputer.Speaker.end();
  C_BG=D.color888(19,20,24); C_CARD=D.color888(40,42,50); C_LIME=D.color888(232,240,71); C_INK=D.color888(244,244,245);
  C_MUTED=D.color888(161,161,170); C_DIM=D.color888(82,82,91); C_BLUE=D.color888(125,211,252); C_RED=D.color888(248,113,113);
  imuOk = M5.Imu.isEnabled();
  kb.begin(); mouse.begin();
  drawUi();
}

void loop() {
  M5Cardputer.update();
  unsigned long now = millis();

  auto k = M5Cardputer.Keyboard.keysState();
  bool changed = M5Cardputer.Keyboard.isChange();

  // ----- Fn command layer (never sent to host) -----
  if (changed && k.fn) {
    bool m = false, t = false;
    for (char c : k.word) { if (c == 'm') m = true; if (c == 't') t = true; }
    if (m && !prevFnM) { mode = (mode == KEYBOARD) ? MOUSE : KEYBOARD; kb.releaseAll(); drawUi(); }
    if (t && !prevFnT && mode == MOUSE) { tilt = !tilt; drawUi(); }
    prevFnM = m; prevFnT = t;
  } else if (!k.fn) { prevFnM = prevFnT = false; }

  // ----- KEYBOARD mode -----
  if (mode == KEYBOARD) {
    if (changed) { if (k.fn) kb.releaseAll(); else sendKbState(); }
  }
  // ----- MOUSE mode -----
  else {
    if (!k.fn) {
      // click buttons (press / release edges): Enter = left, Space = right
      bool en = k.enter;   // left click (primary)
      bool sp = k.space;   // right click
      if (en && !prevEnter) mouse.press(MOUSE_LEFT);
      if (!en && prevEnter) mouse.release(MOUSE_LEFT);
      if (sp && !prevSpace) mouse.press(MOUSE_RIGHT);
      if (!sp && prevSpace) mouse.release(MOUSE_RIGHT);
      prevEnter = en; prevSpace = sp;
    }

    // movement, throttled ~16ms
    if (now - lastMove >= 16 && kb.isConnected()) {
      int dx = 0, dy = 0, wheel = 0;
      if (tilt && imuOk) {
        M5.Imu.update();
        float gx, gy, gz;
        if (M5.Imu.getGyro(&gx, &gy, &gz)) {
          const float DEAD = 4.0f, SENS = 0.5f, MAXV = 14.0f;
          float vx = -gz, vy = gx;              // yaw -> x, pitch -> y
          if (fabs(vx) < DEAD) vx = 0; if (fabs(vy) < DEAD) vy = 0;
          dx = (int)constrain(vx * SENS, -MAXV, MAXV);
          dy = (int)constrain(vy * SENS, -MAXV, MAXV);
        }
      } else {
        const int STEP = 6;
        if (M5Cardputer.Keyboard.isKeyPressed(';')) dy -= STEP;
        if (M5Cardputer.Keyboard.isKeyPressed('.')) dy += STEP;
        if (M5Cardputer.Keyboard.isKeyPressed(',')) dx -= STEP;
        if (M5Cardputer.Keyboard.isKeyPressed('/')) dx += STEP;
      }
      if (M5Cardputer.Keyboard.isKeyPressed('[')) wheel += 1;
      if (M5Cardputer.Keyboard.isKeyPressed(']')) wheel -= 1;
      if (dx || dy || wheel) mouse.move(dx, dy, wheel);
      lastMove = now;
    }
  }

  // ----- periodic UI refresh (connection status) -----
  if (now - lastUi >= 500) { if (kb.isConnected() != lastConn) drawUi(); lastUi = now; }
  delay(4);
}
