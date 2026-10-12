/*
  AC remote for the M5Stack Cardputer / Cardputer ADV
  ===================================================

  Controls Panasonic, LG and Toshiba air conditioners. An AC remote sends the
  WHOLE state (power + temperature + mode + fan) in one long code, which this app
  BUILDS with the IRremoteESP8266 library and sends on the IR LED (G44). This is
  why the generic .ir database files rarely control an AC, but this does.

  Pick your Brand on the first row. Panasonic also has a Model row (its protocol
  variant) — RKR is set, confirmed working. If an AC doesn't respond, aim the top
  edge at it within a few metres; for Panasonic try another Model.

  Keys
    ;  .      move between rows
    -  =      change the selected row's value
    Enter     SEND the current settings
    o         quick power ON + send     p   quick power OFF + send

  Board: M5Cardputer (esp32:esp32:m5stack_cardputer). Libraries: M5Cardputer,
  M5Unified, M5GFX, IRremoteESP8266. esp32 core 3.2.0.
*/

#include <M5Cardputer.h>
#include <IRremoteESP8266.h>
#include <IRsend.h>
#include <ir_Panasonic.h>
#include <ir_LG.h>
#include <ir_Toshiba.h>

#define IR_LED_PIN 44   // Cardputer / Cardputer ADV IR TX

IRPanasonicAc pana(IR_LED_PIN);
IRLgAc        lg(IR_LED_PIN);
IRToshibaAC   tosh(IR_LED_PIN);

auto &D = M5Cardputer.Display;
uint16_t C_BG, C_CARD, C_LIME, C_INK, C_MUTED, C_DIM, C_BLUE;
const int W = 240, H = 135, HEADER = 18, FOOTER = 14;

struct Named { const char* name; uint8_t val; };

// ---- Per-brand tables -------------------------------------------------------
// Panasonic
const Named PANA_MODE[] = {{"Cool",kPanasonicAcCool},{"Heat",kPanasonicAcHeat},{"Dry",kPanasonicAcDry},{"Fan",kPanasonicAcFan},{"Auto",kPanasonicAcAuto}};
const Named PANA_FAN[]  = {{"Auto",kPanasonicAcFanAuto},{"Min",kPanasonicAcFanMin},{"Low",kPanasonicAcFanLow},{"Med",kPanasonicAcFanMed},{"High",kPanasonicAcFanHigh},{"Max",kPanasonicAcFanMax}};
const Named PANA_MODEL[]= {{"RKR",kPanasonicRkr},{"DKE",kPanasonicDke},{"NKE",kPanasonicNke},{"LKE",kPanasonicLke},{"JKE",kPanasonicJke},{"CKP",kPanasonicCkp}};
// LG
const Named LG_MODE[]   = {{"Cool",kLgAcCool},{"Heat",kLgAcHeat},{"Dry",kLgAcDry},{"Fan",kLgAcFan},{"Auto",kLgAcAuto}};
const Named LG_FAN[]    = {{"Auto",kLgAcFanAuto},{"Low",kLgAcFanLow},{"Med",kLgAcFanMedium},{"High",kLgAcFanHigh},{"Max",kLgAcFanMax}};
// Toshiba
const Named TOSH_MODE[] = {{"Cool",kToshibaAcCool},{"Heat",kToshibaAcHeat},{"Dry",kToshibaAcDry},{"Fan",kToshibaAcFan},{"Auto",kToshibaAcAuto}};
const Named TOSH_FAN[]  = {{"Auto",kToshibaAcFanAuto},{"Min",kToshibaAcFanMin},{"Med",kToshibaAcFanMed},{"Max",kToshibaAcFanMax}};

struct Brand {
  const char* name;
  const Named* modes; int nModes;
  const Named* fans;  int nFans;
  int tempMin, tempMax;
  const Named* models; int nModels;   // nModels == 0 means no Model row
};
const Brand BRANDS[] = {
  {"Panasonic", PANA_MODE, 5, PANA_FAN, 6, 16, 30, PANA_MODEL, 6},
  {"LG",        LG_MODE,   5, LG_FAN,   5, 16, 30, nullptr,    0},
  {"Toshiba",   TOSH_MODE, 5, TOSH_FAN, 4, 17, 30, nullptr,    0},
};
const int NBRANDS = 3;

// ---- Current settings -------------------------------------------------------
int  iBrand = 0;             // Panasonic
bool powerOn = true;
int  temp = 24;
int  iMode = 0, iFan = 0, iModel = 0;

enum Row { R_BRAND, R_POWER, R_MODE, R_TEMP, R_FAN, R_MODEL, R_COUNT };
int row = R_BRAND;
String message; uint16_t messageColor; unsigned long messageUntil = 0;

void say(const String &t, uint16_t c, unsigned long ms = 2500) {
  message = t; messageColor = c; messageUntil = millis() + ms;
}

bool hasModel() { return BRANDS[iBrand].nModels > 0; }
bool rowVisible(int r) { return r != R_MODEL || hasModel(); }

void clampToBrand() {
  const Brand &b = BRANDS[iBrand];
  if (iMode >= b.nModes) iMode = 0;
  if (iFan  >= b.nFans)  iFan  = 0;
  temp = constrain(temp, b.tempMin, b.tempMax);
  if (iModel >= b.nModels) iModel = 0;
  if (!rowVisible(row)) row = R_FAN;
}

void drawRow(int y, bool sel, const char* label, const String &value) {
  uint16_t bg = sel ? C_CARD : C_BG;
  D.fillRect(0, y, W, 19, bg);
  if (sel) D.fillRect(0, y + 3, 3, 13, C_LIME);
  D.setFont(&fonts::DejaVu12);
  D.setTextDatum(middle_left);
  D.setTextColor(C_MUTED, bg);
  D.drawString(label, 12, y + 9);
  D.setTextDatum(middle_right);
  D.setTextColor(sel ? C_LIME : C_INK, bg);
  D.drawString(value, W - 12, y + 9);
}

void draw() {
  const Brand &b = BRANDS[iBrand];
  D.fillRect(0, 0, W, HEADER, C_BG);
  D.setFont(&fonts::DejaVu12);
  D.setTextDatum(middle_left);
  D.setTextColor(C_BLUE, C_BG);
  D.drawString("AC Remote", 4, HEADER / 2);
  int bat = M5Cardputer.Power.getBatteryLevel();
  if (bat >= 0) {
    D.setFont(&fonts::DejaVu9);
    D.setTextDatum(middle_right);
    D.setTextColor(C_MUTED, C_BG);
    D.drawString(String(bat) + "%", W - 4, HEADER / 2);
  }
  D.drawFastHLine(0, HEADER - 1, W, C_CARD);

  int y = HEADER;
  drawRow(y + 0 * 19, row == R_BRAND, "Brand", b.name);
  drawRow(y + 1 * 19, row == R_POWER, "Power", powerOn ? "ON" : "OFF");
  drawRow(y + 2 * 19, row == R_MODE,  "Mode",  b.modes[iMode].name);
  drawRow(y + 3 * 19, row == R_TEMP,  "Temp",  String(temp) + " C");
  drawRow(y + 4 * 19, row == R_FAN,   "Fan",   b.fans[iFan].name);
  if (hasModel()) drawRow(y + 5 * 19, row == R_MODEL, "Model", b.models[iModel].name);

  D.fillRect(0, H - FOOTER, W, FOOTER, C_BG);
  D.setFont(&fonts::DejaVu9);
  D.setTextDatum(middle_left);
  bool msg = message.length() && millis() < messageUntil;
  D.setTextColor(msg ? messageColor : C_DIM, C_BG);
  D.drawString(msg ? message : "; . row  -/= change  Enter SEND  o/p on/off", 4, H - FOOTER / 2);
}

void sendState() {
  const Brand &b = BRANDS[iBrand];
  switch (iBrand) {
    case 0:
      pana.setModel((panasonic_ac_remote_model_t)b.models[iModel].val);
      pana.setPower(powerOn); pana.setMode(b.modes[iMode].val);
      pana.setTemp(temp);     pana.setFan(b.fans[iFan].val); pana.send();
      break;
    case 1:
      lg.setPower(powerOn);   lg.setMode(b.modes[iMode].val);
      lg.setTemp(temp);       lg.setFan(b.fans[iFan].val);   lg.send();
      break;
    case 2:
      tosh.setPower(powerOn); tosh.setMode(b.modes[iMode].val);
      tosh.setTemp(temp);     tosh.setFan(b.fans[iFan].val); tosh.send();
      break;
  }
  say(String("Sent ") + b.name + ": " + (powerOn ? "ON " : "OFF ") + b.modes[iMode].name + " " + temp + "C", C_LIME);
}

void changeValue(int dir) {
  const Brand &b = BRANDS[iBrand];
  switch (row) {
    case R_BRAND: iBrand = (iBrand + dir + NBRANDS) % NBRANDS; clampToBrand(); break;
    case R_POWER: powerOn = !powerOn; break;
    case R_MODE:  iMode  = (iMode  + dir + b.nModes) % b.nModes; break;
    case R_TEMP:  temp = constrain(temp + dir, b.tempMin, b.tempMax); break;
    case R_FAN:   iFan   = (iFan   + dir + b.nFans)  % b.nFans;  break;
    case R_MODEL: if (b.nModels) iModel = (iModel + dir + b.nModels) % b.nModels; break;
  }
}

void moveRow(int dir) {
  do { row = (row + dir + R_COUNT) % R_COUNT; } while (!rowVisible(row));
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

  pana.begin(); lg.begin(); tosh.begin();
  clampToBrand();
  draw();
}

void loop() {
  M5Cardputer.update();
  if (M5Cardputer.Keyboard.isChange() && M5Cardputer.Keyboard.isPressed()) {
    auto k = M5Cardputer.Keyboard.keysState();
    char c = k.word.empty() ? 0 : k.word[0];
    if (k.enter) sendState();
    else if (c == ';') moveRow(-1);
    else if (c == '.') moveRow(+1);
    else if (c == '-') changeValue(-1);
    else if (c == '=') changeValue(+1);
    else if (c == 'o') { powerOn = true;  sendState(); }
    else if (c == 'p') { powerOn = false; sendState(); }
    draw();
  }
  delay(10);
}
