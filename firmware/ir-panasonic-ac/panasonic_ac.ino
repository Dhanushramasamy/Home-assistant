/*
  Panasonic AC remote for the M5Stack Cardputer / Cardputer ADV
  =============================================================

  An AC remote sends the WHOLE state (power + temperature + mode + fan) in one
  long code, and Panasonic has several model variants. This app BUILDS the
  correct Panasonic frame for your settings with the IRremoteESP8266 library and
  sends it on the Cardputer's IR LED (G44). The generic .ir database files rarely
  work for ACs; this does.

  If your AC doesn't respond, change the "Model" row (DKE / NKE / LKE / JKE / CKP
  / RKR) and send again until it does — that picks the Panasonic protocol variant
  your unit uses.

  Keys
    ;  .      move between rows
    -  =      change the selected row's value
    Enter     SEND the current settings to the AC
    o         quick power ON + send     p   quick power OFF + send

  Board: M5Cardputer (esp32:esp32:m5stack_cardputer). Libraries: M5Cardputer,
  M5Unified, M5GFX, IRremoteESP8266. esp32 core 3.2.0.
*/

#include <M5Cardputer.h>
#include <IRremoteESP8266.h>
#include <IRsend.h>
#include <ir_Panasonic.h>

#define IR_LED_PIN 44   // Cardputer / Cardputer ADV IR TX

IRPanasonicAc ac(IR_LED_PIN);

auto &D = M5Cardputer.Display;
uint16_t C_BG, C_CARD, C_LIME, C_INK, C_MUTED, C_DIM, C_BLUE;
const int W = 240, H = 135, HEADER = 18, FOOTER = 14;

// Model variants, DKE first (the most common on recent units).
struct Named { const char* name; uint8_t val; };
const Named MODELS[] = {
  {"DKE", kPanasonicDke}, {"NKE", kPanasonicNke}, {"LKE", kPanasonicLke},
  {"JKE", kPanasonicJke}, {"CKP", kPanasonicCkp}, {"RKR", kPanasonicRkr},
};
const Named MODES[] = {
  {"Cool", kPanasonicAcCool}, {"Heat", kPanasonicAcHeat}, {"Dry", kPanasonicAcDry},
  {"Fan",  kPanasonicAcFan},  {"Auto", kPanasonicAcAuto},
};
const Named FANS[] = {
  {"Auto", kPanasonicAcFanAuto}, {"Min", kPanasonicAcFanMin}, {"Low", kPanasonicAcFanLow},
  {"Med",  kPanasonicAcFanMed},  {"High", kPanasonicAcFanHigh}, {"Max", kPanasonicAcFanMax},
};
const int NMODELS = sizeof(MODELS) / sizeof(MODELS[0]);
const int NMODES  = sizeof(MODES)  / sizeof(MODES[0]);
const int NFANS   = sizeof(FANS)   / sizeof(FANS[0]);

// Current settings.
bool powerOn = true;
int  temp = 24;              // 16..30
int  iMode = 0, iFan = 0, iModel = 0;

// Rows in the UI.
enum Row { R_POWER, R_MODE, R_TEMP, R_FAN, R_MODEL, R_COUNT };
int row = R_POWER;
String message;
uint16_t messageColor;
unsigned long messageUntil = 0;

void say(const String &t, uint16_t c, unsigned long ms = 2500) {
  message = t; messageColor = c; messageUntil = millis() + ms;
}

void drawRow(int y, bool sel, const char* label, const String &value) {
  uint16_t bg = sel ? C_CARD : C_BG;
  D.fillRect(0, y, W, 21, bg);
  if (sel) D.fillRect(0, y + 3, 3, 15, C_LIME);
  D.setFont(&fonts::DejaVu12);
  D.setTextDatum(middle_left);
  D.setTextColor(C_MUTED, bg);
  D.drawString(label, 12, y + 10);
  D.setTextDatum(middle_right);
  D.setTextColor(sel ? C_LIME : C_INK, bg);
  D.drawString(value, W - 12, y + 10);
}

void draw() {
  D.fillRect(0, 0, W, HEADER, C_BG);
  D.setFont(&fonts::DejaVu12);
  D.setTextDatum(middle_left);
  D.setTextColor(C_BLUE, C_BG);
  D.drawString("Panasonic AC", 4, HEADER / 2);
  int bat = M5Cardputer.Power.getBatteryLevel();
  if (bat >= 0) {
    D.setFont(&fonts::DejaVu9);
    D.setTextDatum(middle_right);
    D.setTextColor(C_MUTED, C_BG);
    D.drawString(String(bat) + "%", W - 4, HEADER / 2);
  }
  D.drawFastHLine(0, HEADER - 1, W, C_CARD);

  int y = HEADER;
  drawRow(y + 0 * 21, row == R_POWER, "Power", powerOn ? "ON" : "OFF");
  drawRow(y + 1 * 21, row == R_MODE,  "Mode",  MODES[iMode].name);
  drawRow(y + 2 * 21, row == R_TEMP,  "Temp",  String(temp) + " C");
  drawRow(y + 3 * 21, row == R_FAN,   "Fan",   FANS[iFan].name);
  drawRow(y + 4 * 21, row == R_MODEL, "Model", MODELS[iModel].name);

  D.fillRect(0, H - FOOTER, W, FOOTER, C_BG);
  D.setFont(&fonts::DejaVu9);
  D.setTextDatum(middle_left);
  bool msg = message.length() && millis() < messageUntil;
  D.setTextColor(msg ? messageColor : C_DIM, C_BG);
  D.drawString(msg ? message : "; . row   -/= change   Enter SEND   o/p on/off", 4, H - FOOTER / 2);
}

void sendState() {
  ac.setModel((panasonic_ac_remote_model_t)MODELS[iModel].val);
  ac.setPower(powerOn);
  ac.setMode(MODES[iMode].val);
  ac.setTemp(temp);
  ac.setFan(FANS[iFan].val);
  ac.send();
  say(String("Sent: ") + (powerOn ? "ON " : "OFF ") + MODES[iMode].name + " " + temp + "C  [" + MODELS[iModel].name + "]", C_LIME);
}

void changeValue(int dir) {
  switch (row) {
    case R_POWER: powerOn = !powerOn; break;
    case R_MODE:  iMode  = (iMode  + dir + NMODES)  % NMODES;  break;
    case R_TEMP:  temp = constrain(temp + dir, 16, 30); break;
    case R_FAN:   iFan   = (iFan   + dir + NFANS)   % NFANS;   break;
    case R_MODEL: iModel = (iModel + dir + NMODELS) % NMODELS; break;
  }
}

void setup() {
  auto cfg = M5.config();
  M5Cardputer.begin(cfg, true);
  D.setRotation(1);
  D.setBrightness(120);
  M5Cardputer.Speaker.end();

  C_BG = D.color888(19, 20, 24);
  C_CARD = D.color888(40, 42, 50);
  C_LIME = D.color888(232, 240, 71);
  C_INK = D.color888(244, 244, 245);
  C_MUTED = D.color888(161, 161, 170);
  C_DIM = D.color888(82, 82, 91);
  C_BLUE = D.color888(125, 211, 252);

  ac.begin();
  draw();
}

void loop() {
  M5Cardputer.update();
  if (M5Cardputer.Keyboard.isChange() && M5Cardputer.Keyboard.isPressed()) {
    auto k = M5Cardputer.Keyboard.keysState();
    char c = k.word.empty() ? 0 : k.word[0];
    if (k.enter) sendState();
    else if (c == ';') row = (row - 1 + R_COUNT) % R_COUNT;
    else if (c == '.') row = (row + 1) % R_COUNT;
    else if (c == '-') changeValue(-1);
    else if (c == '=') changeValue(+1);
    else if (c == 'o') { powerOn = true;  sendState(); }
    else if (c == 'p') { powerOn = false; sendState(); }
    draw();
  }
  delay(10);
}
