/*
  IR Remote for the M5Stack Cardputer / Cardputer ADV  (all-in-one)
  ================================================================

  Home menu with two tools, sending on the IR LED (G44):

  1) AC Remote  — builds the full AC frame (power/temp/mode/fan) for Panasonic,
     LG and Toshiba with IRremoteESP8266. Each brand has a Model row (protocol
     variant); change it if the AC doesn't respond. Panasonic default RKR works.
  2) IR Files   — browse the SD card and send any Flipper ".ir" file's buttons as
     the RAW recorded signal (your real remote capture, the Flipper-IRDB on the
     card, TVs, etc.). The reliable fallback when a protocol guess misses.

  Keys
    Home menu:  ; . move   Enter open
    AC Remote:  ; . row   -/= change   Enter SEND   o/p on-off   ` menu
    IR Files:   ; . move   Enter open/SEND   r send x3   ` up / back

  esp32 core 3.2.0. Board: M5Cardputer. Libs: M5Cardputer, M5Unified, M5GFX,
  IRremoteESP8266.
*/

#include <M5Cardputer.h>
#include <SPI.h>
#include <SD.h>
#include <vector>
#include <functional>
#include <IRremoteESP8266.h>
#include <IRsend.h>
#include <ir_Panasonic.h>
#include <ir_LG.h>
#include <ir_Toshiba.h>

#define SD_SCK 40
#define SD_MISO 39
#define SD_MOSI 14
#define SD_CS 12
#define IR_LED_PIN 44

IRsend        irsend(IR_LED_PIN);
IRPanasonicAc pana(IR_LED_PIN);
IRLgAc        lg(IR_LED_PIN);
IRToshibaAC   tosh(IR_LED_PIN);

auto &D = M5Cardputer.Display;
uint16_t C_BG, C_CARD, C_LIME, C_INK, C_MUTED, C_DIM, C_BLUE, C_RED;
const int W = 240, H = 135, HEADER = 18, FOOTER = 14, ROW = 20;
const int VISIBLE = (H - HEADER - FOOTER) / ROW;

enum Screen { MENU, AC, BROWSER, FILEV };
Screen screen = MENU;
bool sdOk = false;
String message; uint16_t messageColor; unsigned long messageUntil = 0;
void say(const String &t, uint16_t c, unsigned long ms = 2500) { message = t; messageColor = c; messageUntil = millis() + ms; }

// ============================================================ shared drawing
void header(const String &title, uint16_t col) {
  D.fillRect(0, 0, W, HEADER, C_BG);
  D.setFont(&fonts::DejaVu12); D.setTextDatum(middle_left); D.setTextColor(col, C_BG);
  String t = title; if (t.length() > 30) t = "…" + t.substring(t.length() - 29);
  D.drawString(t, 4, HEADER / 2);
  int bat = M5Cardputer.Power.getBatteryLevel();
  if (bat >= 0) { D.setFont(&fonts::DejaVu9); D.setTextDatum(middle_right); D.setTextColor(C_MUTED, C_BG); D.drawString(String(bat) + "%", W - 4, HEADER / 2); }
  D.drawFastHLine(0, HEADER - 1, W, C_CARD);
}
void footer(const char* hint) {
  D.fillRect(0, H - FOOTER, W, FOOTER, C_BG);
  D.setFont(&fonts::DejaVu9); D.setTextDatum(middle_left);
  bool msg = message.length() && millis() < messageUntil;
  D.setTextColor(msg ? messageColor : C_DIM, C_BG);
  D.drawString(msg ? message : String(hint), 4, H - FOOTER / 2);
}
void drawRows(int count, int sel, int &top, std::function<String(int)> label, std::function<uint16_t(int)> color) {
  D.fillRect(0, HEADER, W, H - HEADER - FOOTER, C_BG);
  if (count == 0) { D.setFont(&fonts::DejaVu12); D.setTextDatum(middle_center); D.setTextColor(C_MUTED, C_BG); D.drawString("(empty)", W / 2, H / 2); return; }
  if (sel < top) top = sel;
  if (sel >= top + VISIBLE) top = sel - VISIBLE + 1;
  for (int r = 0; r < VISIBLE && top + r < count; r++) {
    int i = top + r, y = HEADER + r * ROW; bool s = i == sel; uint16_t bg = s ? C_CARD : C_BG;
    D.fillRect(0, y, W, ROW, bg);
    if (s) D.fillRect(0, y + 3, 3, ROW - 6, C_LIME);
    D.setFont(&fonts::DejaVu12); D.setTextDatum(middle_left); D.setTextColor(color(i), bg);
    String n = label(i); if (n.length() > 28) n = n.substring(0, 27) + "…";
    D.drawString(n, 10, y + ROW / 2);
  }
}

// ============================================================ HOME MENU
const char* MENU_ITEMS[] = { "AC Remote  (Panasonic/LG/Toshiba)", "IR Files   (send any .ir from SD)" };
int selM = 0, topM = 0;
void drawMenu() {
  header("IR Remote", C_BLUE);
  drawRows(2, selM, topM, [](int i) { return String(MENU_ITEMS[i]); }, [](int) { return C_INK; });
  footer("; . move   Enter open");
}

// ============================================================ embedded Toshiba raw POWER codes (test which toggles your AC)
const uint16_t TRC_RAS13[] = {4384, 4380, 522, 1611, 551, 1609, 553, 1607, 555, 1605, 557, 523, 547, 533, 548, 1612, 550, 530, 551, 529, 552, 528, 553, 527, 554, 526, 555, 1605, 557, 1603, 549, 531, 550, 1610, 552, 528, 553, 527, 554, 527, 554, 526, 555, 525, 556, 524, 546, 1613, 549, 1611, 551, 1609, 553, 1607, 555, 1605, 557, 1603, 548, 1611, 551, 1609, 553, 527, 554, 527, 554, 526, 555, 525, 556, 524, 557, 523, 547, 533, 548, 532, 549, 531, 550, 1609, 553, 527, 554, 1606, 556, 1604, 547, 533, 548, 532, 549, 531, 550, 530, 551, 529, 552, 528, 553, 527, 554, 526, 555, 525, 556, 524, 557, 523, 547, 532, 549, 1611, 551, 529, 552, 528, 553, 528, 553, 527, 554, 526, 555, 525, 556, 524, 546, 533, 548, 532, 549, 1611, 551, 1609, 553, 527, 554, 526, 555, 525, 556, 524, 557, 523, 547, 7458, 4392, 4345, 556, 1604, 547, 1612, 550, 1611, 551, 1609, 553, 527, 554, 526, 555, 1605, 557, 523, 547, 533, 548, 532, 549, 531, 550, 530, 551, 1609, 553, 1607, 555, 525, 556, 1604, 547, 532, 549, 532, 549, 531, 550, 530, 551, 529, 552, 528, 553, 1607, 555, 1605, 557, 1603, 548, 1611, 551, 1610, 552, 1608, 554, 1606, 556, 1604, 547, 533, 548, 532, 549, 532, 549, 531, 550, 530, 551, 529, 552, 528, 553, 527, 554, 526, 555, 1604, 547, 533, 548, 1612, 550, 1610, 552, 528, 553, 528, 553, 527, 554, 526, 555, 525, 556, 524, 557, 523, 547, 533, 548, 532, 549, 531, 550, 530, 551, 529, 552, 1607, 555, 525, 556, 525, 556, 524, 557, 523, 547, 533, 548, 532, 549, 531, 550, 530, 551, 529, 552, 1607, 555, 1605, 557, 523, 547, 533, 548, 532, 549, 531, 550, 530, 551};
const uint16_t TRC_RASB10[] = {4381, 4450, 511, 1623, 545, 1618, 547, 1622, 546, 1619, 546, 570, 512, 540, 545, 1619, 546, 539, 545, 536, 547, 536, 546, 536, 546, 538, 544, 1625, 543, 1620, 545, 540, 545, 1654, 512, 536, 546, 536, 546, 536, 546, 540, 543, 537, 545, 540, 545, 1618, 547, 1620, 546, 1622, 546, 1620, 545, 1621, 547, 1618, 547, 1622, 546, 1653, 511, 538, 544, 540, 544, 535, 547, 536, 546, 537, 545, 539, 547, 535, 547, 538, 544, 538, 544, 1621, 545, 536, 546, 1622, 546, 1619, 546, 1622, 546, 539, 543, 538, 544, 535, 548, 540, 544, 1618, 547, 1621, 547, 536, 546, 535, 547, 536, 546, 540, 545, 537, 545, 1654, 512, 536, 546, 538, 544, 538, 544, 536, 546, 573, 512, 537, 546, 536, 546, 538, 546, 1618, 547, 536, 546, 1624, 544, 1619, 546, 570, 512, 540, 545, 538, 544, 536, 545, 6711, 4378, 4417, 544, 1623, 545, 1619, 546, 1656, 512, 1620, 545, 535, 547, 538, 547, 1619, 546, 539, 545, 535, 547, 535, 547, 538, 544, 537, 545, 1623, 545, 1619, 546, 540, 545, 1621, 545, 536, 546, 537, 545, 536, 546, 570, 512, 537, 545, 542, 544, 1619, 546, 1621, 545, 1622, 546, 1618, 547, 1622, 546, 1619, 546, 1624, 544, 1621, 544, 536, 546, 538, 546, 538, 544, 536, 546, 537, 545, 540, 545, 537, 546, 537, 545, 536, 546, 1620, 546, 536, 546, 1622, 546, 1620, 545, 1622, 546, 536, 546, 538, 544, 537, 545, 539, 545, 1619, 546, 1625, 543, 537, 545, 538, 544, 536, 546, 538, 547, 538, 544, 1622, 544, 537, 545, 537, 545, 535, 547, 538, 544, 542, 543, 538, 544, 537, 545, 538, 546, 1619, 546, 537, 545, 1623, 545, 1620, 545, 538, 544, 540, 545, 537, 545, 536, 545};
const uint16_t TRC_RG57[] = {4414, 4350, 566, 1579, 568, 504, 569, 1576, 571, 501, 572, 500, 563, 535, 538, 507, 566, 1579, 568, 1578, 569, 529, 544, 501, 572, 500, 563, 509, 564, 507, 566, 532, 541, 1578, 569, 503, 570, 1574, 563, 1583, 564, 508, 565, 1580, 567, 1579, 568, 1577, 570, 529, 544, 1575, 572, 1573, 564, 1582, 565, 1581, 566, 1579, 568, 1578, 569, 1576, 571, 1575, 572, 1573, 564, 1582, 565, 1581, 566, 1579, 568, 1578, 569, 1577, 570, 1575, 572, 1574, 563, 509, 564, 1582, 565, 1606, 541, 505, 568, 530, 543, 502, 572, 501, 562, 1609, 538, 5170, 4410, 4354, 562, 536, 537, 1608, 539, 507, 566, 1580, 567, 1578, 569, 1577, 570, 1575, 572, 527, 536, 510, 563, 1582, 565, 1580, 567, 1579, 568, 1577, 570, 1576, 571, 1575, 572, 526, 537, 1583, 564, 508, 565, 507, 566, 1579, 568, 504, 569, 503, 570, 528, 545, 1574, 563, 510, 564, 508, 565, 507, 566, 506, 567, 504, 569, 503, 570, 502, 571, 500, 563, 536, 537, 508, 565, 507, 566, 505, 568, 530, 543, 503, 570, 501, 572, 526, 537, 1582, 565, 507, 566, 506, 567, 1579, 568, 1577, 570, 1576, 571, 1574, 573, 500, 563};
struct ToshRaw { const char* name; uint16_t khz; const uint16_t* data; uint16_t len; };
const ToshRaw TOSH_RAW[] = {
  {"RAS13 raw",  38, TRC_RAS13,  sizeof(TRC_RAS13)  / 2},
  {"RASB10 raw", 38, TRC_RASB10, sizeof(TRC_RASB10) / 2},
  {"RG57 raw",   38, TRC_RG57,   sizeof(TRC_RG57)   / 2},
};
const int NTOSH_RAW = 3;

// ============================================================ AC REMOTE (encoder)
struct Named { const char* name; uint8_t val; };
const Named PANA_MODE[] = {{"Cool",kPanasonicAcCool},{"Heat",kPanasonicAcHeat},{"Dry",kPanasonicAcDry},{"Fan",kPanasonicAcFan},{"Auto",kPanasonicAcAuto}};
const Named PANA_FAN[]  = {{"Auto",kPanasonicAcFanAuto},{"Min",kPanasonicAcFanMin},{"Low",kPanasonicAcFanLow},{"Med",kPanasonicAcFanMed},{"High",kPanasonicAcFanHigh},{"Max",kPanasonicAcFanMax}};
const Named PANA_MODEL[]= {{"RKR",kPanasonicRkr},{"DKE",kPanasonicDke},{"NKE",kPanasonicNke},{"LKE",kPanasonicLke},{"JKE",kPanasonicJke},{"CKP",kPanasonicCkp}};
const Named LG_MODE[]   = {{"Cool",kLgAcCool},{"Heat",kLgAcHeat},{"Dry",kLgAcDry},{"Fan",kLgAcFan},{"Auto",kLgAcAuto}};
const Named LG_FAN[]    = {{"Auto",kLgAcFanAuto},{"Low",kLgAcFanLow},{"Med",kLgAcFanMedium},{"High",kLgAcFanHigh},{"Max",kLgAcFanMax}};
const Named LG_MODEL[]  = {{"GE6711",GE6711AR2853M},{"AKB75215403",AKB75215403},{"AKB74955603",AKB74955603},{"AKB73757604",AKB73757604},{"LG6711A",LG6711A20083V}};
const Named TOSH_MODE[] = {{"Cool",kToshibaAcCool},{"Heat",kToshibaAcHeat},{"Dry",kToshibaAcDry},{"Fan",kToshibaAcFan},{"Auto",kToshibaAcAuto}};
const Named TOSH_FAN[]  = {{"Auto",kToshibaAcFanAuto},{"Min",kToshibaAcFanMin},{"Med",kToshibaAcFanMed},{"Max",kToshibaAcFanMax}};
const Named TOSH_MODEL[]= {{"Remote A",kToshibaGenericRemote_A},{"Remote B",kToshibaGenericRemote_B},{"RAS13 raw",0},{"RASB10 raw",1},{"RG57 raw",2}};

struct Brand { const char* name; const Named* modes; int nModes; const Named* fans; int nFans; int tempMin, tempMax; const Named* models; int nModels; };
const Brand BRANDS[] = {
  {"Panasonic", PANA_MODE,5, PANA_FAN,6, 16,30, PANA_MODEL,6},
  {"LG",        LG_MODE,5,   LG_FAN,5,   16,30, LG_MODEL,5},
  {"Toshiba",   TOSH_MODE,5, TOSH_FAN,4, 17,30, TOSH_MODEL,5},
};
const int NBRANDS = 3;
int iBrand = 0; bool powerOn = true; int temp = 24; int iMode = 0, iFan = 0, iModel = 0;
enum Row { R_BRAND, R_POWER, R_MODE, R_TEMP, R_FAN, R_MODEL, R_COUNT };
int row = R_BRAND;

void clampBrand() {
  const Brand &b = BRANDS[iBrand];
  if (iMode >= b.nModes) iMode = 0; if (iFan >= b.nFans) iFan = 0;
  temp = constrain(temp, b.tempMin, b.tempMax); if (iModel >= b.nModels) iModel = 0;
}
#define AC_RH 17   // row height: 6 rows * 17 = 102 fits in H-HEADER-FOOTER (103)
void drawAcRow(int y, bool sel, const char* label, const String &value) {
  uint16_t bg = sel ? C_CARD : C_BG; D.fillRect(0, y, W, AC_RH, bg);
  if (sel) D.fillRect(0, y + 3, 3, AC_RH - 6, C_LIME);
  D.setFont(&fonts::DejaVu12); D.setTextDatum(middle_left); D.setTextColor(C_MUTED, bg); D.drawString(label, 12, y + AC_RH / 2);
  D.setTextDatum(middle_right); D.setTextColor(sel ? C_LIME : C_INK, bg); D.drawString(value, W - 12, y + AC_RH / 2);
}
void drawAc() {
  const Brand &b = BRANDS[iBrand];
  header("AC Remote", C_BLUE);
  int y = HEADER;
  drawAcRow(y+0*AC_RH, row==R_BRAND, "Brand", b.name);
  drawAcRow(y+1*AC_RH, row==R_POWER, "Power", powerOn?"ON":"OFF");
  drawAcRow(y+2*AC_RH, row==R_MODE,  "Mode",  b.modes[iMode].name);
  drawAcRow(y+3*AC_RH, row==R_TEMP,  "Temp",  String(temp)+" C");
  drawAcRow(y+4*AC_RH, row==R_FAN,   "Fan",   b.fans[iFan].name);
  drawAcRow(y+5*AC_RH, row==R_MODEL, "Model", b.models[iModel].name);
  footer("; . row  -/= change  Enter SEND  ` menu");
}
void sendAc() {
  const Brand &b = BRANDS[iBrand];
  switch (iBrand) {
    case 0: pana.setModel((panasonic_ac_remote_model_t)b.models[iModel].val); pana.setPower(powerOn); pana.setMode(b.modes[iMode].val); pana.setTemp(temp); pana.setFan(b.fans[iFan].val); pana.send(); break;
    case 1: lg.setModel((lg_ac_remote_model_t)b.models[iModel].val); lg.setPower(powerOn); lg.setMode(b.modes[iMode].val); lg.setTemp(temp); lg.setFan(b.fans[iFan].val); lg.send(); break;
    case 2:
      if (iModel < 2) { tosh.setModel((toshiba_ac_remote_model_t)b.models[iModel].val); tosh.setPower(powerOn); tosh.setMode(b.modes[iMode].val); tosh.setTemp(temp); tosh.setFan(b.fans[iFan].val); tosh.send(); }
      else { const ToshRaw &rc = TOSH_RAW[iModel - 2]; irsend.sendRaw((uint16_t*)rc.data, rc.len, rc.khz); say(String("Sent raw ") + rc.name, C_LIME); return; }
      break;
  }
  say(String("Sent ")+b.name+": "+(powerOn?"ON ":"OFF ")+b.modes[iMode].name+" "+temp+"C", C_LIME);
}
void acChange(int dir) {
  const Brand &b = BRANDS[iBrand];
  switch (row) {
    case R_BRAND: iBrand=(iBrand+dir+NBRANDS)%NBRANDS; clampBrand(); break;
    case R_POWER: powerOn=!powerOn; break;
    case R_MODE:  iMode=(iMode+dir+b.nModes)%b.nModes; break;
    case R_TEMP:  temp=constrain(temp+dir,b.tempMin,b.tempMax); break;
    case R_FAN:   iFan=(iFan+dir+b.nFans)%b.nFans; break;
    case R_MODEL: iModel=(iModel+dir+b.nModels)%b.nModels; break;
  }
}

// ============================================================ IR FILES (raw .ir)
struct Entry { String name; bool dir; };
std::vector<Entry> entries; String curPath = "/"; int selB = 0, topB = 0;
struct Button { String name; uint16_t freqKHz; std::vector<uint16_t> data; };
std::vector<Button> buttons; String openFile; int selK = 0, topK = 0;

void listDir() {
  entries.clear();
  File d = SD.open(curPath);
  if (d) { while (File f = d.openNextFile()) { String n=f.name(); int sl=n.lastIndexOf('/'); if(sl>=0)n=n.substring(sl+1); bool dir=f.isDirectory(); if(!n.startsWith(".")&&(dir||n.endsWith(".ir"))) entries.push_back({n,dir}); f.close(); } d.close(); }
  std::sort(entries.begin(), entries.end(), [](const Entry&a,const Entry&b){ if(a.dir!=b.dir)return a.dir; return a.name.compareTo(b.name)<0; });
  selB=0; topB=0;
}
void drawBrowser() {
  header(curPath, C_BLUE);
  drawRows(entries.size(), selB, topB, [](int i){ return (entries[i].dir?String("/"):String(""))+entries[i].name; }, [](int i){ return entries[i].dir?C_BLUE:C_INK; });
  footer("; . move   Enter open   ` up/menu");
}
void openIr(const String &path) {
  buttons.clear(); openFile = path;
  File f = SD.open(path); if (!f) { say("Can't open file", C_RED); return; }
  String name; uint16_t freq=38; bool raw=false; size_t total=0;
  while (f.available()) {
    String line=f.readStringUntil('\n'); line.trim();
    if (line.startsWith("name:")) { name=line.substring(5); name.trim(); raw=false; }
    else if (line.startsWith("type:")) raw=line.indexOf("raw")>=0;
    else if (line.startsWith("frequency:")) { freq=line.substring(10).toInt()/1000; if(freq==0)freq=38; }
    else if (line.startsWith("data:") && raw && buttons.size()<300 && total<40000) {
      Button b; b.name=name.length()?name:"(unnamed)"; b.freqKHz=freq;
      const char* p=line.c_str()+5;
      while (*p) { while(*p==' '||*p=='\t')p++; if(!*p)break; long v=strtol(p,(char**)&p,10); if(v>0&&v<65535)b.data.push_back((uint16_t)v); }
      if (b.data.size()>=3) { total+=b.data.size(); buttons.push_back(std::move(b)); }
    }
  }
  f.close(); selK=0; topK=0;
}
void drawFile() {
  int sl=openFile.lastIndexOf('/');
  header(sl>=0?openFile.substring(sl+1):openFile, C_LIME);
  if (buttons.empty()) { D.fillRect(0,HEADER,W,H-HEADER-FOOTER,C_BG); D.setFont(&fonts::DejaVu9); D.setTextDatum(middle_center); D.setTextColor(C_MUTED,C_BG); D.drawString("No raw signals in this file", W/2, H/2); }
  else drawRows(buttons.size(), selK, topK, [](int i){ return buttons[i].name; }, [](int){ return C_INK; });
  footer("; . move   Enter SEND   r x3   ` back");
}
void sendButton(int i, int times) {
  Button &b=buttons[i];
  for (int t=0;t<times;t++){ irsend.sendRaw(b.data.data(), b.data.size(), b.freqKHz); if(t+1<times)delay(40); }
  say("Sent: "+b.name, C_LIME);
}
void goUp() { if (curPath=="/"){ screen=MENU; drawMenu(); return; } int sl=curPath.lastIndexOf('/'); curPath = sl<=0?"/":curPath.substring(0,sl); listDir(); drawBrowser(); }

// ============================================================ SETUP / LOOP
void setup() {
  auto cfg = M5.config(); M5Cardputer.begin(cfg, true); D.setRotation(1); D.setBrightness(120); M5Cardputer.Speaker.end();
  C_BG=D.color888(19,20,24); C_CARD=D.color888(40,42,50); C_LIME=D.color888(232,240,71); C_INK=D.color888(244,244,245);
  C_MUTED=D.color888(161,161,170); C_DIM=D.color888(82,82,91); C_BLUE=D.color888(125,211,252); C_RED=D.color888(248,113,113);
  irsend.begin(); pana.begin(); lg.begin(); tosh.begin();
  SPI.begin(SD_SCK, SD_MISO, SD_MOSI, SD_CS);
  sdOk = SD.begin(SD_CS, SPI, 25000000) && SD.cardType() != CARD_NONE;
  clampBrand();
  drawMenu();
}

void loop() {
  M5Cardputer.update();
  if (!(M5Cardputer.Keyboard.isChange() && M5Cardputer.Keyboard.isPressed())) { delay(10); return; }
  auto k = M5Cardputer.Keyboard.keysState();
  char c = k.word.empty() ? 0 : k.word[0];
  bool back = (c == '`') || k.del;

  if (screen == MENU) {
    if (c==';' && selM>0) selM--;
    else if (c=='.' && selM<1) selM++;
    else if (k.enter) {
      if (selM==0) { screen=AC; drawAc(); }
      else { if(!sdOk){ say("No SD card", C_RED); drawMenu(); } else { screen=BROWSER; curPath="/"; listDir(); drawBrowser(); } }
      return;
    }
    drawMenu();
  }
  else if (screen == AC) {
    if (back) { screen=MENU; drawMenu(); return; }
    if (k.enter) sendAc();
    else if (c==';') row=(row-1+R_COUNT)%R_COUNT;
    else if (c=='.') row=(row+1)%R_COUNT;
    else if (c=='-') acChange(-1);
    else if (c=='=') acChange(+1);
    else if (c=='o'){ powerOn=true; sendAc(); }
    else if (c=='p'){ powerOn=false; sendAc(); }
    drawAc();
  }
  else if (screen == BROWSER) {
    if (back) { goUp(); return; }
    if (c==';' && selB>0) selB--;
    else if (c=='.' && selB<(int)entries.size()-1) selB++;
    else if (k.enter && !entries.empty()) {
      Entry &e=entries[selB]; String path=(curPath=="/"?"":curPath)+"/"+e.name;
      if (e.dir){ curPath=path; listDir(); drawBrowser(); return; }
      else { openIr(path); screen=FILEV; drawFile(); return; }
    }
    drawBrowser();
  }
  else { // FILEV
    if (back) { screen=BROWSER; drawBrowser(); return; }
    if (c==';' && selK>0) selK--;
    else if (c=='.' && selK<(int)buttons.size()-1) selK++;
    else if (k.enter && !buttons.empty()) sendButton(selK,1);
    else if (c=='r' && !buttons.empty()) sendButton(selK,3);
    drawFile();
  }
}
