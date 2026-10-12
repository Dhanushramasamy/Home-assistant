/*
  Voice recorder for the M5Stack Cardputer
  ========================================

  Records from the built-in microphone straight to the SD card as WAV files
  (16 kHz, mono, 16-bit, about 1.9 MB per minute), for as long as you like,
  lists the recordings and plays them on the speaker.

  Keys (list)
    r  or  G0 button   start / stop recording
    ;  .               up / down
    Enter              play / stop
    Del                delete (press Del again to confirm)
    -  =               volume down / up

  Files: /recordings/REC_0001.wav, REC_0002.wav, ... on the SD card.
  Board: M5Cardputer (esp32:esp32:m5stack_cardputer). Libraries: M5Cardputer,
  M5Unified, M5GFX.
*/

#include <M5Cardputer.h>
#include <SPI.h>
#include <SD.h>
#include <vector>

#define SD_SCK 40
#define SD_MISO 39
#define SD_MOSI 14
#define SD_CS 12

const char* DIR = "/recordings";
const uint32_t RATE = 16000;
const size_t CHUNK = 2048;          // samples per block: 128 ms
const int BUFFERS = 3;              // the mic/speaker work on one while we use another

int16_t* buf[BUFFERS];

auto &D = M5Cardputer.Display;
uint16_t C_BG, C_CARD, C_LIME, C_INK, C_MUTED, C_DIM, C_RED;
const int W = 240, H = 135, HEADER = 18, FOOTER = 14, ROW = 20;
const int VISIBLE = (H - HEADER - FOOTER) / ROW;   // 5

struct Rec { String name; uint32_t seconds; };
std::vector<Rec> recs;
int selected = 0, scrollTop = 0;
int volume = 220;
bool confirmDelete = false;
bool sdOk = false;
String message;
uint16_t messageColor;
unsigned long messageUntil = 0;


// ============================================================
// WAV
// ============================================================

struct WavHeader {
  char riff[4] = { 'R', 'I', 'F', 'F' };
  uint32_t fileSize = 36;
  char wave[4] = { 'W', 'A', 'V', 'E' };
  char fmt[4] = { 'f', 'm', 't', ' ' };
  uint32_t fmtSize = 16;
  uint16_t format = 1;
  uint16_t channels = 1;
  uint32_t sampleRate = RATE;
  uint32_t byteRate = RATE * 2;
  uint16_t blockAlign = 2;
  uint16_t bits = 16;
  char data[4] = { 'd', 'a', 't', 'a' };
  uint32_t dataSize = 0;
};

uint32_t secondsOf(uint32_t bytes) {
  return bytes > 44 ? (bytes - 44) / (RATE * 2) : 0;
}


// ============================================================
// SCREEN
// ============================================================

void say(const String &text, uint16_t color, unsigned long ms = 3000) {
  message = text;
  messageColor = color;
  messageUntil = millis() + ms;
}

String mmss(uint32_t s) {
  char b[12];
  snprintf(b, sizeof(b), "%02lu:%02lu", (unsigned long)(s / 60), (unsigned long)(s % 60));
  return b;
}

void header(const String &title) {
  D.fillRect(0, 0, W, HEADER, C_BG);
  D.setFont(&fonts::DejaVu12);
  D.setTextDatum(middle_left);
  D.setTextColor(C_INK, C_BG);
  D.drawString(title, 4, HEADER / 2);

  String right = "vol " + String(volume * 100 / 255) + "%";
  int bat = M5Cardputer.Power.getBatteryLevel();
  if (bat >= 0) right += "  " + String(bat) + "%";
  D.setFont(&fonts::DejaVu9);
  D.setTextDatum(middle_right);
  D.setTextColor(C_MUTED, C_BG);
  D.drawString(right, W - 4, HEADER / 2);
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
  header("Recorder");
  D.fillRect(0, HEADER, W, H - HEADER - FOOTER, C_BG);
  D.setTextDatum(middle_center);
  D.setFont(&fonts::DejaVu12);

  if (!sdOk) {
    D.setTextColor(C_RED, C_BG);
    D.drawString("No SD card", W / 2, H / 2);
  } else if (recs.empty()) {
    D.setTextColor(C_MUTED, C_BG);
    D.drawString("No recordings yet", W / 2, H / 2 - 8);
    D.setFont(&fonts::DejaVu9);
    D.drawString("Press r to record", W / 2, H / 2 + 10);
  } else {
    if (selected < scrollTop) scrollTop = selected;
    if (selected >= scrollTop + VISIBLE) scrollTop = selected - VISIBLE + 1;
    for (int r = 0; r < VISIBLE && scrollTop + r < (int)recs.size(); r++) {
      int i = scrollTop + r;
      int y = HEADER + r * ROW;
      bool sel = i == selected;
      uint16_t bg = sel ? C_CARD : C_BG;
      D.fillRect(0, y, W, ROW, bg);
      if (sel) D.fillRect(0, y + 3, 3, ROW - 6, C_LIME);
      D.setFont(&fonts::DejaVu12);
      D.setTextDatum(middle_left);
      D.setTextColor(C_INK, bg);
      D.drawString(recs[i].name, 10, y + ROW / 2);
      D.setTextDatum(middle_right);
      D.setTextColor(sel ? C_LIME : C_MUTED, bg);
      D.drawString(mmss(recs[i].seconds), W - 8, y + ROW / 2);
    }
  }
  footer(confirmDelete ? "Del again to delete, any key to keep" : "r rec  Enter play  Del delete  -/= vol");
}


// ============================================================
// FILES
// ============================================================

void scan() {
  recs.clear();
  File dir = SD.open(DIR);
  if (!dir) return;
  while (File f = dir.openNextFile()) {
    String n = f.name();
    if (!f.isDirectory() && n.endsWith(".wav")) recs.push_back({ n, secondsOf(f.size()) });
    f.close();
  }
  dir.close();
  // Newest first.
  std::sort(recs.begin(), recs.end(), [](const Rec &a, const Rec &b) { return a.name > b.name; });
  if (selected >= (int)recs.size()) selected = recs.empty() ? 0 : recs.size() - 1;
}

String nextName() {
  int n = 0;
  for (auto &r : recs) {
    int k = r.name.substring(4, 8).toInt();   // REC_0007.wav
    if (k > n) n = k;
  }
  char b[20];
  snprintf(b, sizeof(b), "REC_%04d.wav", n + 1);
  return b;
}


// ============================================================
// RECORD
// ============================================================

bool stopPressed() {
  M5Cardputer.update();
  if (M5Cardputer.BtnA.wasClicked()) return true;
  if (M5Cardputer.Keyboard.isChange() && M5Cardputer.Keyboard.isPressed()) {
    auto k = M5Cardputer.Keyboard.keysState();
    if (k.enter) return true;
    for (char c : k.word) if (c == 'r' || c == '`') return true;
  }
  return false;
}

// ES8311 sound chip on the Cardputer ADV (I2C address 0x18).
void boostAdvMic() {
  M5.In_I2C.writeRegister8(0x18, 0x14, 0x1A, 100000);  // mic input 1, analog gain +30 dB (max)
  M5.In_I2C.writeRegister8(0x18, 0x17, 0xDF, 100000);  // digital volume +16 dB
}

void record() {
  String name = nextName();
  String path = String(DIR) + "/" + name;
  File f = SD.open(path, FILE_WRITE);
  if (!f) {
    say("Can't create file", C_RED);
    return;
  }
  WavHeader hdr;
  f.write((uint8_t*)&hdr, sizeof(hdr));

  M5Cardputer.Speaker.end();
  bool micOk = M5Cardputer.Mic.begin();
  bool adv = M5.getBoard() == m5::board_t::board_M5CardputerADV;
  const char* model = M5.getBoard() == m5::board_t::board_M5CardputerADV ? "Cardputer ADV"
                    : M5.getBoard() == m5::board_t::board_M5Cardputer    ? "Cardputer" : "unknown";

  header("Recording");
  D.fillRect(0, HEADER, W, H - HEADER - FOOTER, C_BG);
  footer("r / Enter / G0 to stop");

  uint32_t written = 0;
  int i = 0;
  bool stop = false;
  unsigned long lastDraw = 0;

  while (!stop) {
    // Queue the next block; the block two back is finished and can be saved.
    M5Cardputer.Mic.record(buf[i % BUFFERS], CHUNK, RATE);
    // The ADV's sound chip (ES8311) starts its mic at minimum gain: almost silent.
    // Once the mic is running, turn the gain up.
    if (adv && i == 1) boostAdvMic();
    if (i >= 2) {
      int16_t* done = buf[(i - 2) % BUFFERS];
      written += f.write((uint8_t*)done, CHUNK * 2);

      if (millis() - lastDraw > 200) {
        lastDraw = millis();
        int peak = 0;
        for (size_t s = 0; s < CHUNK; s++) peak = max(peak, (int)abs(done[s]));
        int level = min(W - 40, peak * (W - 40) / 12000);
        D.fillCircle(24, 52, 9, (millis() / 500) % 2 ? C_RED : C_BG);
        D.setFont(&fonts::DejaVu24);
        D.setTextDatum(middle_left);
        D.setTextColor(C_INK, C_BG);
        D.drawString(mmss(written / (RATE * 2)) + "  ", 44, 52);
        D.setFont(&fonts::DejaVu9);
        D.setTextColor(C_MUTED, C_BG);
        D.drawString(name, 44, 72);
        D.fillRect(20, 90, W - 40, 8, C_CARD);
        D.fillRect(20, 90, level, 8, level > (W - 40) * 0.85 ? C_RED : C_LIME);
        // Diagnostics: model, mic start result, loudest raw sample.
        D.setTextDatum(middle_left);
        D.setTextColor(micOk ? C_MUTED : C_RED, C_BG);
        D.drawString(String(model) + "  mic " + (micOk ? "on" : "FAILED") + "  peak " + String(peak) + "     ", 20, 108);
      }
    }
    i++;
    stop = stopPressed();
  }

  // Save the last two blocks.
  while (M5Cardputer.Mic.isRecording()) delay(1);
  for (int k = max(0, i - 2); k < i; k++) written += f.write((uint8_t*)buf[k % BUFFERS], CHUNK * 2);
  M5Cardputer.Mic.end();

  hdr.dataSize = written;
  hdr.fileSize = written + 36;
  f.seek(0);
  f.write((uint8_t*)&hdr, sizeof(hdr));
  f.close();

  say("Saved " + name + " (" + mmss(written / (RATE * 2)) + ")", C_LIME);
  scan();
  for (int k = 0; k < (int)recs.size(); k++) if (recs[k].name == name) selected = k;
}


// ============================================================
// PLAY
// ============================================================

void play(const Rec &r) {
  File f = SD.open(String(DIR) + "/" + r.name);
  if (!f) {
    say("Can't open file", C_RED);
    return;
  }
  uint32_t total = f.size() > 44 ? f.size() - 44 : 0;

  header("Playing " + r.name);
  D.fillRect(0, HEADER, W, H - HEADER - FOOTER, C_BG);
  message = ""; footer("Checking loudness...");

  // Find the loudest sample, so quiet recordings can be made louder.
  f.seek(44);
  int peak = 0;
  for (;;) {
    size_t n = f.read((uint8_t*)buf[0], CHUNK * 2);
    if (n == 0) break;
    for (size_t s = 0; s < n / 2; s++) peak = max(peak, (int)abs(buf[0][s]));
  }
  int gain = peak > 0 ? constrain(28000 / peak, 1, 32) : 1;
  f.seek(44);

  M5Cardputer.Mic.end();
  M5Cardputer.Speaker.begin();
  M5Cardputer.Speaker.setVolume(volume);
  // Short beep: proves the speaker itself works.
  M5Cardputer.Speaker.tone(1200, 80);
  delay(150);

  footer("Enter / ` to stop  -/= vol");
  D.fillRect(0, HEADER, W, H - HEADER - FOOTER, C_BG);
  D.setFont(&fonts::DejaVu9);
  D.setTextDatum(middle_center);
  D.setTextColor(peak < 200 ? C_RED : C_MUTED, C_BG);
  D.drawString(peak < 200 ? "Recording is silent (mic gave no sound)"
                          : "Loudness x" + String(gain), W / 2, 105);

  uint32_t played = 0;
  int i = 0;
  unsigned long lastDraw = 0;
  bool stop = false;

  while (!stop && played < total) {
    int16_t* b = buf[i % BUFFERS];
    size_t n = f.read((uint8_t*)b, CHUNK * 2);
    if (n == 0) break;
    int level = 0;
    for (size_t s = 0; s < n / 2; s++) {
      int v = constrain((int)b[s] * gain, -32768, 32767);
      b[s] = v;
      level = max(level, abs(v));
    }
    // Wait until the speaker has room for another block.
    while (M5Cardputer.Speaker.isPlaying(0) == 2) {
      delay(1);
    }
    M5Cardputer.Speaker.playRaw(b, n / 2, RATE, false, 1, 0);
    played += n;
    i++;

    if (millis() - lastDraw > 200) {
      lastDraw = millis();
      D.setFont(&fonts::DejaVu24);
      D.setTextDatum(middle_center);
      D.setTextColor(C_INK, C_BG);
      D.drawString(mmss(played / (RATE * 2)) + " / " + mmss(total / (RATE * 2)), W / 2, 55);
      D.fillRect(20, 85, W - 40, 8, C_CARD);
      D.fillRect(20, 85, total ? (uint64_t)(W - 40) * played / total : 0, 8, C_LIME);
      D.fillRect(20, 96, W - 40, 3, C_CARD);
      D.fillRect(20, 96, level * (W - 40) / 32768, 3, C_INK);
    }

    M5Cardputer.update();
    if (M5Cardputer.Keyboard.isChange() && M5Cardputer.Keyboard.isPressed()) {
      auto k = M5Cardputer.Keyboard.keysState();
      if (k.enter) stop = true;
      for (char c : k.word) {
        if (c == '`') stop = true;
        if (c == '=') volume = min(255, volume + 24);
        if (c == '-') volume = max(0, volume - 24);
      }
      M5Cardputer.Speaker.setVolume(volume);
    }
  }

  if (stop) M5Cardputer.Speaker.stop();
  while (M5Cardputer.Speaker.isPlaying()) delay(1);
  M5Cardputer.Speaker.end();
  f.close();
}


// ============================================================
// SETUP / LOOP
// ============================================================

void setup() {
  auto cfg = M5.config();
  M5Cardputer.begin(cfg, true);
  D.setRotation(1);
  D.setBrightness(120);

  C_BG = D.color888(19, 20, 24);
  C_CARD = D.color888(40, 42, 50);
  C_LIME = D.color888(232, 240, 71);
  C_INK = D.color888(244, 244, 245);
  C_MUTED = D.color888(161, 161, 170);
  C_DIM = D.color888(82, 82, 91);
  C_RED = D.color888(248, 113, 113);

  for (int i = 0; i < BUFFERS; i++) buf[i] = (int16_t*)heap_caps_malloc(CHUNK * 2, MALLOC_CAP_8BIT);

  SPI.begin(SD_SCK, SD_MISO, SD_MOSI, SD_CS);
  sdOk = SD.begin(SD_CS, SPI, 25000000) && SD.cardType() != CARD_NONE;
  if (sdOk && !SD.exists(DIR)) SD.mkdir(DIR);
  if (sdOk) scan();

  M5Cardputer.Speaker.end();
  drawList();
}

void loop() {
  M5Cardputer.update();
  bool changed = false;

  if (M5Cardputer.BtnA.wasClicked() && sdOk) {
    record();
    changed = true;
  }

  if (M5Cardputer.Keyboard.isChange() && M5Cardputer.Keyboard.isPressed()) {
    auto k = M5Cardputer.Keyboard.keysState();
    char c = k.word.empty() ? 0 : k.word[0];

    if (k.del && !recs.empty()) {
      if (confirmDelete) {
        String name = recs[selected].name;
        SD.remove(String(DIR) + "/" + name);
        say("Deleted " + name, C_MUTED);
        scan();
        confirmDelete = false;
      } else {
        confirmDelete = true;
      }
    } else {
      confirmDelete = false;
      if (c == 'r' && sdOk) record();
      else if (c == ';' && selected > 0) selected--;
      else if (c == '.' && selected < (int)recs.size() - 1) selected++;
      else if (k.enter && !recs.empty()) play(recs[selected]);
      else if (c == '=') volume = min(255, volume + 24);
      else if (c == '-') volume = max(0, volume - 24);
    }
    changed = true;
  }

  static unsigned long lastFooter = 0;
  if (changed) drawList();
  else if (millis() - lastFooter > 1000) {
    lastFooter = millis();
    footer(confirmDelete ? "Del again to delete, any key to keep" : "r rec  Enter play  Del delete  -/= vol");
  }
  delay(10);
}
