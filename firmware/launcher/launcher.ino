/*
  Dhanush Launcher for the M5Stack Cardputer / Cardputer ADV
  ==========================================================

  A small home menu that lists the .bin apps on the SD card and boots the one
  you choose, the way M5Launcher / Evil Cardputer does. The launcher lives in
  the "factory" memory slot; a chosen app is copied into the "ota_0" slot and
  run from there. The bootloader always falls back to the launcher.

  How booting an app works (the core trick, from M5Launcher):
    1. Read the .bin from the SD card.
    2. Copy it into the ota_0 slot with the ESP32 OTA system (esp_ota_*).
    3. Mark ota_0 as "boot next" and restart.
  To come back, one of OUR apps sets the boot slot back to "factory" and
  restarts (see returnToLauncher() at the bottom — paste it into our apps).

  Keys
    ;  .      move up / down
    Enter     run the selected app (asks to confirm)
    r         rescan the SD card
    -  =      brightness down / up

  First install MUST be over USB from the Pi (it also sets the memory layout):
    partitions.csv in this folder; build with esp32 core 3.2.0.

  Board: M5Cardputer (esp32:esp32:m5stack_cardputer). Libraries: M5Cardputer,
  M5Unified, M5GFX.
*/

#include <M5Cardputer.h>
#include <SPI.h>
#include <SD.h>
#include <vector>
#include <esp_ota_ops.h>
#include <esp_partition.h>

#define SD_SCK 40
#define SD_MISO 39
#define SD_MOSI 14
#define SD_CS 12

auto &D = M5Cardputer.Display;
uint16_t C_BG, C_CARD, C_LIME, C_INK, C_MUTED, C_DIM, C_RED;
const int W = 240, H = 135, HEADER = 18, FOOTER = 14, ROW = 20;
const int VISIBLE = (H - HEADER - FOOTER) / ROW;   // 5

struct App { String name; String path; uint32_t size; };
std::vector<App> apps;
int selected = 0, scrollTop = 0;
bool sdOk = false;
int brightness = 120;
String message;
uint16_t messageColor;
unsigned long messageUntil = 0;


// ============================================================
// SCREEN
// ============================================================

void say(const String &text, uint16_t color, unsigned long ms = 3000) {
  message = text;
  messageColor = color;
  messageUntil = millis() + ms;
}

String sizeStr(uint32_t b) {
  if (b >= 1024 * 1024) return String(b / 1048576.0, 1) + " MB";
  return String((b + 1023) / 1024) + " KB";
}

void header(const String &title) {
  D.fillRect(0, 0, W, HEADER, C_BG);
  D.setFont(&fonts::DejaVu12);
  D.setTextDatum(middle_left);
  D.setTextColor(C_LIME, C_BG);
  D.drawString(title, 4, HEADER / 2);
  int bat = M5Cardputer.Power.getBatteryLevel();
  if (bat >= 0) {
    D.setFont(&fonts::DejaVu9);
    D.setTextDatum(middle_right);
    D.setTextColor(C_MUTED, C_BG);
    D.drawString(String(bat) + "%", W - 4, HEADER / 2);
  }
  D.drawFastHLine(0, HEADER - 1, W, C_CARD);
}

void footer(const char* hint) {
  D.fillRect(0, H - FOOTER, W, FOOTER, C_BG);
  D.setFont(&fonts::DejaVu9);
  D.setTextDatum(middle_left);
  bool msg = message.length() && millis() < messageUntil;
  D.setTextColor(msg ? messageColor : C_DIM, C_BG);
  D.drawString(msg ? message : String(hint), 4, H - FOOTER / 2);
}

void drawList() {
  header("Launcher");
  D.fillRect(0, HEADER, W, H - HEADER - FOOTER, C_BG);
  D.setTextDatum(middle_center);
  D.setFont(&fonts::DejaVu12);

  if (!sdOk) {
    D.setTextColor(C_RED, C_BG);
    D.drawString("No SD card", W / 2, H / 2);
  } else if (apps.empty()) {
    D.setTextColor(C_MUTED, C_BG);
    D.drawString("No .bin apps on the card", W / 2, H / 2);
  } else {
    if (selected < scrollTop) scrollTop = selected;
    if (selected >= scrollTop + VISIBLE) scrollTop = selected - VISIBLE + 1;
    for (int r = 0; r < VISIBLE && scrollTop + r < (int)apps.size(); r++) {
      int i = scrollTop + r;
      int y = HEADER + r * ROW;
      bool sel = i == selected;
      uint16_t bg = sel ? C_CARD : C_BG;
      D.fillRect(0, y, W, ROW, bg);
      if (sel) D.fillRect(0, y + 3, 3, ROW - 6, C_LIME);
      D.setFont(&fonts::DejaVu12);
      D.setTextDatum(middle_left);
      D.setTextColor(C_INK, bg);
      String n = apps[i].name;
      if (n.length() > 22) n = n.substring(0, 21) + "…";
      D.drawString(n, 10, y + ROW / 2);
      D.setTextDatum(middle_right);
      D.setTextColor(sel ? C_LIME : C_MUTED, bg);
      D.drawString(sizeStr(apps[i].size), W - 8, y + ROW / 2);
    }
  }
  footer("; . move   Enter run   r rescan   -/= bright");
}


// ============================================================
// FILES
// ============================================================

void addBinsFrom(const char* dir) {
  File d = SD.open(dir);
  if (!d) return;
  while (File f = d.openNextFile()) {
    String n = f.name();
    int slash = n.lastIndexOf('/');
    String base = slash >= 0 ? n.substring(slash + 1) : n;
    if (!f.isDirectory() && base.endsWith(".bin") && !base.startsWith(".")) {
      String path = n.startsWith("/") ? n : String(dir) + "/" + base;
      apps.push_back({ base.substring(0, base.length() - 4), path, (uint32_t)f.size() });
    }
    f.close();
  }
  d.close();
}

void scan() {
  apps.clear();
  addBinsFrom("/");
  if (SD.exists("/apps")) addBinsFrom("/apps");
  std::sort(apps.begin(), apps.end(), [](const App &a, const App &b) {
    return a.name.compareTo(b.name) < 0;
  });
  if (selected >= (int)apps.size()) selected = apps.empty() ? 0 : apps.size() - 1;
}


// ============================================================
// RUN AN APP  (copy SD .bin -> ota_0 slot -> boot it)
// ============================================================

void screenMessage(const String &title, const String &line, uint16_t color) {
  header(title);
  D.fillRect(0, HEADER, W, H - HEADER - FOOTER, C_BG);
  D.setFont(&fonts::DejaVu12);
  D.setTextDatum(middle_center);
  D.setTextColor(color, C_BG);
  D.drawString(line, W / 2, H / 2);
  footer("");
}

bool confirmRun(const App &a) {
  header("Run this app?");
  D.fillRect(0, HEADER, W, H - HEADER - FOOTER, C_BG);
  D.setFont(&fonts::DejaVu12);
  D.setTextDatum(middle_center);
  D.setTextColor(C_INK, C_BG);
  D.drawString(a.name, W / 2, H / 2 - 10);
  D.setFont(&fonts::DejaVu9);
  D.setTextColor(C_MUTED, C_BG);
  D.drawString(sizeStr(a.size), W / 2, H / 2 + 8);
  footer("Enter = run    ` = cancel");
  for (;;) {
    M5Cardputer.update();
    if (M5Cardputer.Keyboard.isChange() && M5Cardputer.Keyboard.isPressed()) {
      auto k = M5Cardputer.Keyboard.keysState();
      if (k.enter) return true;
      for (char c : k.word) if (c == '`') return false;
    }
    delay(10);
  }
}

void runApp(const App &a) {
  if (!confirmRun(a)) { drawList(); return; }

  File f = SD.open(a.path);
  if (!f) { say("Can't open file", C_RED); drawList(); return; }

  // The ota_0 slot the chosen app is copied into and run from.
  const esp_partition_t* slot = esp_partition_find_first(
      ESP_PARTITION_TYPE_APP, ESP_PARTITION_SUBTYPE_APP_OTA_0, NULL);
  if (!slot) { say("No ota_0 slot (reflash layout)", C_RED); f.close(); drawList(); return; }
  if (f.size() == 0 || f.size() > slot->size) {
    say("App too big for the slot", C_RED); f.close(); drawList(); return;
  }

  // Safety: a real ESP32 app image starts with 0xE9. Refuse anything else so a
  // stray file can't be written over the run slot.
  uint8_t magic = 0;
  f.read(&magic, 1);
  f.seek(0);
  if (magic != 0xE9) { say("Not an ESP32 app (.bin)", C_RED); f.close(); drawList(); return; }

  esp_ota_handle_t h;
  if (esp_ota_begin(slot, f.size(), &h) != ESP_OK) {
    say("Couldn't prepare the slot", C_RED); f.close(); drawList(); return;
  }

  header("Installing");
  D.fillRect(0, HEADER, W, H - HEADER - FOOTER, C_BG);
  D.setFont(&fonts::DejaVu12);
  D.setTextDatum(middle_center);
  D.setTextColor(C_INK, C_BG);
  D.drawString(a.name, W / 2, 44);
  footer("Please wait, do not power off");

  static uint8_t page[4096];
  uint32_t total = f.size(), done = 0;
  bool ok = true;
  while (done < total) {
    int n = f.read(page, sizeof(page));
    if (n <= 0) { ok = false; break; }
    if (esp_ota_write(h, page, n) != ESP_OK) { ok = false; break; }
    done += n;
    int w = (int)((uint64_t)(W - 40) * done / total);
    D.fillRect(20, 74, W - 40, 10, C_CARD);
    D.fillRect(20, 74, w, 10, C_LIME);
    D.setFont(&fonts::DejaVu9);
    D.setTextDatum(middle_center);
    D.setTextColor(C_MUTED, C_BG);
    D.drawString(String(done / 1024) + " / " + String(total / 1024) + " KB  ", W / 2, 96);
  }
  f.close();

  if (!ok || esp_ota_end(h) != ESP_OK) {
    screenMessage("Failed", "Install failed", C_RED);
    delay(1500); drawList(); return;
  }
  if (esp_ota_set_boot_partition(slot) != ESP_OK) {
    screenMessage("Failed", "Couldn't set boot", C_RED);
    delay(1500); drawList(); return;
  }

  screenMessage("Starting", a.name, C_LIME);
  delay(600);
  esp_restart();
}


// ============================================================
// SETUP / LOOP
// ============================================================

void setup() {
  auto cfg = M5.config();
  M5Cardputer.begin(cfg, true);
  D.setRotation(1);
  D.setBrightness(brightness);

  // Mark the launcher as a good, valid boot app so the bootloader keeps using
  // it as the fallback.
  esp_ota_mark_app_valid_cancel_rollback();

  C_BG = D.color888(19, 20, 24);
  C_CARD = D.color888(40, 42, 50);
  C_LIME = D.color888(232, 240, 71);
  C_INK = D.color888(244, 244, 245);
  C_MUTED = D.color888(161, 161, 170);
  C_DIM = D.color888(82, 82, 91);
  C_RED = D.color888(248, 113, 113);

  SPI.begin(SD_SCK, SD_MISO, SD_MOSI, SD_CS);
  sdOk = SD.begin(SD_CS, SPI, 25000000) && SD.cardType() != CARD_NONE;
  if (sdOk) scan();

  M5Cardputer.Speaker.end();
  drawList();
}

void loop() {
  M5Cardputer.update();
  bool changed = false;

  if (M5Cardputer.Keyboard.isChange() && M5Cardputer.Keyboard.isPressed()) {
    auto k = M5Cardputer.Keyboard.keysState();
    char c = k.word.empty() ? 0 : k.word[0];
    if (c == ';' && selected > 0) selected--;
    else if (c == '.' && selected < (int)apps.size() - 1) selected++;
    else if (k.enter && !apps.empty()) runApp(apps[selected]);
    else if (c == 'r') { sdOk = SD.begin(SD_CS, SPI, 25000000) && SD.cardType() != CARD_NONE; if (sdOk) scan(); say("Rescanned", C_MUTED); }
    else if (c == '=') { brightness = min(255, brightness + 25); D.setBrightness(brightness); }
    else if (c == '-') { brightness = max(25, brightness - 25); D.setBrightness(brightness); }
    changed = true;
  }

  static unsigned long lastFooter = 0;
  if (changed) drawList();
  else if (millis() - lastFooter > 1000) {
    lastFooter = millis();
    footer("; . move   Enter run   r rescan   -/= bright");
  }
  delay(10);
}


// ============================================================
// FOR OUR OWN APPS: paste this in, call returnToLauncher() on a key, so the
// app can send the Cardputer back to the launcher.
// ============================================================
//
//   #include <esp_ota_ops.h>
//   #include <esp_partition.h>
//   void returnToLauncher() {
//     const esp_partition_t* f = esp_partition_find_first(
//         ESP_PARTITION_TYPE_APP, ESP_PARTITION_SUBTYPE_APP_FACTORY, NULL);
//     if (f) esp_ota_set_boot_partition(f);
//     esp_restart();
//   }
