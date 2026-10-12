/*
  IR blaster for the M5Stack Cardputer / Cardputer ADV
  ====================================================

  Browse the SD card, open any Flipper ".ir" file, and send its buttons on the
  Cardputer's IR LED (G44). It plays the RAW recorded signal, so it sends your
  real remote exactly as captured — the reliable way to control an AC or TV when
  a protocol guess doesn't match. Works with the whole Flipper-IRDB on the card
  (e.g. /Flipper-IRDB/ACs/Toshiba) and your own captures in /downloads.

  Keys (file browser)
    ;  .      move           Enter   open folder / open .ir file
    `  Del    up a folder
  Keys (buttons in a file)
    ;  .      move           Enter   SEND the selected button
    `  Del    back to the browser
    r         send 3x (hold-repeat) for buttons that need it

  Only RAW signals are supported (what AC/TV captures use). esp32 core 3.2.0.
  Board: M5Cardputer. Libraries: M5Cardputer, M5Unified, M5GFX, IRremoteESP8266.
*/

#include <M5Cardputer.h>
#include <SPI.h>
#include <SD.h>
#include <vector>
#include <functional>
#include <IRremoteESP8266.h>
#include <IRsend.h>

#define SD_SCK 40
#define SD_MISO 39
#define SD_MOSI 14
#define SD_CS 12
#define IR_LED_PIN 44

IRsend irsend(IR_LED_PIN);

auto &D = M5Cardputer.Display;
uint16_t C_BG, C_CARD, C_LIME, C_INK, C_MUTED, C_DIM, C_BLUE, C_RED;
const int W = 240, H = 135, HEADER = 18, FOOTER = 14, ROW = 20;
const int VISIBLE = (H - HEADER - FOOTER) / ROW;   // 5

bool sdOk = false;
String message; uint16_t messageColor; unsigned long messageUntil = 0;
void say(const String &t, uint16_t c, unsigned long ms = 2500) { message = t; messageColor = c; messageUntil = millis() + ms; }

// ---- Browser ----------------------------------------------------------------
struct Entry { String name; bool dir; };
std::vector<Entry> entries;
String curPath = "/";
int selB = 0, topB = 0;

// ---- Open file (buttons) ----------------------------------------------------
struct Button { String name; uint16_t freqKHz; std::vector<uint16_t> data; };
std::vector<Button> buttons;
String openFile;
int selK = 0, topK = 0;
bool inFile = false;

void header(const String &title) {
  D.fillRect(0, 0, W, HEADER, C_BG);
  D.setFont(&fonts::DejaVu12); D.setTextDatum(middle_left);
  D.setTextColor(C_BLUE, C_BG);
  String t = title; if (t.length() > 30) t = "…" + t.substring(t.length() - 29);
  D.drawString(t, 4, HEADER / 2);
  D.drawFastHLine(0, HEADER - 1, W, C_CARD);
}
void footer(const char* hint) {
  D.fillRect(0, H - FOOTER, W, FOOTER, C_BG);
  D.setFont(&fonts::DejaVu9); D.setTextDatum(middle_left);
  bool msg = message.length() && millis() < messageUntil;
  D.setTextColor(msg ? messageColor : C_DIM, C_BG);
  D.drawString(msg ? message : String(hint), 4, H - FOOTER / 2);
}

void drawListRows(int count, int sel, int &top, std::function<String(int)> label, std::function<bool(int)> isDir) {
  D.fillRect(0, HEADER, W, H - HEADER - FOOTER, C_BG);
  if (count == 0) {
    D.setFont(&fonts::DejaVu12); D.setTextDatum(middle_center); D.setTextColor(C_MUTED, C_BG);
    D.drawString("(empty)", W / 2, H / 2);
    return;
  }
  if (sel < top) top = sel;
  if (sel >= top + VISIBLE) top = sel - VISIBLE + 1;
  for (int r = 0; r < VISIBLE && top + r < count; r++) {
    int i = top + r, y = HEADER + r * ROW;
    bool s = i == sel; uint16_t bg = s ? C_CARD : C_BG;
    D.fillRect(0, y, W, ROW, bg);
    if (s) D.fillRect(0, y + 3, 3, ROW - 6, C_LIME);
    D.setFont(&fonts::DejaVu12); D.setTextDatum(middle_left);
    D.setTextColor(isDir(i) ? C_BLUE : C_INK, bg);
    String n = label(i);
    if (isDir(i)) n = "/" + n;
    if (n.length() > 28) n = n.substring(0, 27) + "…";
    D.drawString(n, 10, y + ROW / 2);
  }
}

// ---- SD browsing ------------------------------------------------------------
void listDir() {
  entries.clear();
  File d = SD.open(curPath);
  if (d) {
    while (File f = d.openNextFile()) {
      String n = f.name(); int sl = n.lastIndexOf('/'); if (sl >= 0) n = n.substring(sl + 1);
      bool dir = f.isDirectory();
      if (!n.startsWith(".") && (dir || n.endsWith(".ir")))
        entries.push_back({ n, dir });
      f.close();
    }
    d.close();
  }
  std::sort(entries.begin(), entries.end(), [](const Entry &a, const Entry &b) {
    if (a.dir != b.dir) return a.dir;
    return a.name.compareTo(b.name) < 0;
  });
  selB = 0; topB = 0;
}

void drawBrowser() {
  header(curPath);
  drawListRows(entries.size(), selB, topB,
    [](int i) { return entries[i].name; }, [](int i) { return entries[i].dir; });
  footer("; . move   Enter open   ` up");
}

// ---- Parse an .ir file (raw signals only) -----------------------------------
void openIr(const String &path) {
  buttons.clear(); openFile = path;
  File f = SD.open(path);
  if (!f) { say("Can't open file", C_RED); return; }
  String name; uint16_t freq = 38; bool raw = false; size_t totalNums = 0;
  while (f.available()) {
    String line = f.readStringUntil('\n'); line.trim();
    if (line.startsWith("name:")) { name = line.substring(5); name.trim(); raw = false; }
    else if (line.startsWith("type:")) raw = line.indexOf("raw") >= 0;
    else if (line.startsWith("frequency:")) { freq = line.substring(10).toInt() / 1000; if (freq == 0) freq = 38; }
    else if (line.startsWith("data:") && raw && buttons.size() < 300 && totalNums < 40000) {
      Button b; b.name = name.length() ? name : "(unnamed)"; b.freqKHz = freq;
      const char* p = line.c_str() + 5;
      while (*p) {
        while (*p == ' ' || *p == '\t') p++;
        if (!*p) break;
        long v = strtol(p, (char**)&p, 10);
        if (v > 0 && v < 65535) b.data.push_back((uint16_t)v);
      }
      if (b.data.size() >= 3) { totalNums += b.data.size(); buttons.push_back(std::move(b)); }
    }
  }
  f.close();
  selK = 0; topK = 0; inFile = true;
}

void drawFile() {
  int sl = openFile.lastIndexOf('/');
  header(sl >= 0 ? openFile.substring(sl + 1) : openFile);
  if (buttons.empty()) {
    D.fillRect(0, HEADER, W, H - HEADER - FOOTER, C_BG);
    D.setFont(&fonts::DejaVu9); D.setTextDatum(middle_center); D.setTextColor(C_MUTED, C_BG);
    D.drawString("No raw signals in this file", W / 2, H / 2);
  } else {
    drawListRows(buttons.size(), selK, topK,
      [](int i) { return buttons[i].name; }, [](int) { return false; });
  }
  footer("; . move   Enter SEND   r x3   ` back");
}

void sendButton(int i, int times) {
  Button &b = buttons[i];
  for (int t = 0; t < times; t++) {
    irsend.sendRaw(b.data.data(), b.data.size(), b.freqKHz);
    if (t + 1 < times) delay(40);
  }
  say("Sent: " + b.name, C_LIME);
}

void setup() {
  auto cfg = M5.config();
  M5Cardputer.begin(cfg, true);
  D.setRotation(1); D.setBrightness(120);
  M5Cardputer.Speaker.end();
  C_BG = D.color888(19,20,24); C_CARD = D.color888(40,42,50); C_LIME = D.color888(232,240,71);
  C_INK = D.color888(244,244,245); C_MUTED = D.color888(161,161,170); C_DIM = D.color888(82,82,91);
  C_BLUE = D.color888(125,211,252); C_RED = D.color888(248,113,113);

  irsend.begin();
  SPI.begin(SD_SCK, SD_MISO, SD_MOSI, SD_CS);
  sdOk = SD.begin(SD_CS, SPI, 25000000) && SD.cardType() != CARD_NONE;
  if (sdOk) listDir();
  if (!sdOk) { header("IR Blaster"); D.setTextColor(C_RED, C_BG); D.setTextDatum(middle_center); D.drawString("No SD card", W/2, H/2); footer(""); }
  else drawBrowser();
}

void goUp() {
  if (curPath == "/") return;
  int sl = curPath.lastIndexOf('/');
  curPath = sl <= 0 ? "/" : curPath.substring(0, sl);
  listDir();
}

void loop() {
  M5Cardputer.update();
  if (!(M5Cardputer.Keyboard.isChange() && M5Cardputer.Keyboard.isPressed())) { delay(10); return; }
  auto k = M5Cardputer.Keyboard.keysState();
  char c = k.word.empty() ? 0 : k.word[0];
  bool up = (c == '`') || k.del;

  if (!inFile) {                                   // ---- browser ----
    if (!sdOk) return;
    if (c == ';' && selB > 0) selB--;
    else if (c == '.' && selB < (int)entries.size() - 1) selB++;
    else if (up) goUp();
    else if (k.enter && !entries.empty()) {
      Entry &e = entries[selB];
      String path = (curPath == "/" ? "" : curPath) + "/" + e.name;
      if (e.dir) { curPath = path; listDir(); }
      else openIr(path);
    }
    if (inFile) drawFile(); else drawBrowser();
  } else {                                          // ---- buttons ----
    if (c == ';' && selK > 0) selK--;
    else if (c == '.' && selK < (int)buttons.size() - 1) selK++;
    else if (up) { inFile = false; drawBrowser(); return; }
    else if (k.enter && !buttons.empty()) sendButton(selK, 1);
    else if (c == 'r' && !buttons.empty()) sendButton(selK, 3);
    drawFile();
  }
}
