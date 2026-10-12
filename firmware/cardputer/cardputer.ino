/*
  Home Control remote for the M5Stack Cardputer
  =============================================

  Signs in to the Home Control app (prp-home-assistant.vercel.app) like the
  phone app does, lists the switches this user may use, and switches them
  or sets timers from the keyboard. Works on any Wi-Fi with internet, because
  the boards are cloud boards.

  Keys
    ;  .      up / down (the arrow keys)
    Enter     switch the selected light / fan ON or OFF
    t         timers for the selected switch
    r         refresh now
    `         back (Esc)

  Timer screen
    o         change action (Turn ON / Turn OFF)
    0-9, Del  minutes
    Enter     start the timer
    c         cancel all timers on this switch
    `         back

  Board: M5Cardputer (esp32:esp32:m5stack_cardputer).
  Libraries: M5Cardputer, M5Unified, M5GFX, ArduinoJson.
  Wi-Fi and the app sign-in are in secrets.h (copy secrets.example.h).
*/

#include <M5Cardputer.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>

#include "secrets.h"
#include "roots.h"


// ============================================================
// LOOK
// ============================================================

auto &D = M5Cardputer.Display;

uint16_t C_BG, C_CARD, C_LIME, C_INK, C_MUTED, C_DIM, C_RED;

const int W = 240, H = 135;
const int HEADER = 18, FOOTER = 14, ROW = 26;
const int VISIBLE_ROWS = (H - HEADER - FOOTER) / ROW;   // 3


// ============================================================
// STATE
// ============================================================

struct Switch {
  String id;
  String name;
  String room;
  String type;
  bool on;
  bool online;
};

#define MAX_SWITCHES 24
Switch switches[MAX_SWITCHES];
int switchCount = 0;
int selected = 0;
int scrollTop = 0;

enum Screen { LIST, TIMERS };
Screen screen = LIST;

String session;            // the app's sign-in cookie (hc_session=...)
Preferences prefs;

String footerText = "";
uint16_t footerColor = 0;
unsigned long footerUntil = 0;

unsigned long lastRefresh = 0;
const unsigned long REFRESH_MS = 8000;

// Timer screen
bool timerOn = false;      // false = Turn OFF
String timerMinutes = "10";
struct RunningTimer { int id; String action; long remaining; bool repeat; };
RunningTimer running[10];
int runningCount = 0;
unsigned long runningSyncedAt = 0;


// ============================================================
// DRAWING
// ============================================================

void say(const String &text, uint16_t color, unsigned long ms = 4000) {
  footerText = text;
  footerColor = color;
  footerUntil = millis() + ms;
}

void drawHeader(const char* title) {
  D.fillRect(0, 0, W, HEADER, C_BG);
  D.setFont(&fonts::DejaVu12);
  D.setTextDatum(middle_left);
  D.setTextColor(C_INK, C_BG);
  D.drawString(title, 4, HEADER / 2);

  // Wi-Fi + battery, right-aligned
  int bat = M5Cardputer.Power.getBatteryLevel();
  String right = (WiFi.status() == WL_CONNECTED ? String(WiFi.RSSI()) + "dBm" : String("no wifi"));
  if (bat >= 0) right += "  " + String(bat) + "%";
  D.setFont(&fonts::DejaVu9);
  D.setTextDatum(middle_right);
  D.setTextColor(C_MUTED, C_BG);
  D.drawString(right, W - 4, HEADER / 2);
  D.drawFastHLine(0, HEADER - 1, W, C_CARD);
}

void drawFooter(const char* hint) {
  D.fillRect(0, H - FOOTER, W, FOOTER, C_BG);
  D.setFont(&fonts::DejaVu9);
  D.setTextDatum(middle_left);
  bool msg = footerText.length() && millis() < footerUntil;
  D.setTextColor(msg ? footerColor : C_DIM, C_BG);
  D.drawString(msg ? footerText : String(hint), 4, H - FOOTER / 2);
}

void drawRow(int i, int y, bool busy) {
  const Switch &s = switches[i];
  bool sel = i == selected;
  uint16_t bg = sel ? C_CARD : C_BG;
  D.fillRect(0, y, W, ROW, bg);
  if (sel) D.fillRect(0, y + 3, 3, ROW - 6, C_LIME);

  D.setTextDatum(top_left);
  D.setFont(&fonts::DejaVu12);
  D.setTextColor(C_INK, bg);
  D.drawString(s.name, 10, y + 2);
  D.setFont(&fonts::DejaVu9);
  D.setTextColor(C_MUTED, bg);
  D.drawString(s.room + (s.online ? "" : "  · offline"), 10, y + 15);

  // ON / OFF pill
  int px = W - 52, py = y + 5, pw = 44, ph = 16;
  if (busy) {
    D.fillRoundRect(px, py, pw, ph, 8, C_DIM);
    D.setTextColor(C_INK, C_DIM);
    D.setTextDatum(middle_center);
    D.drawString("...", px + pw / 2, py + ph / 2);
  } else if (!s.online) {
    D.drawRoundRect(px, py, pw, ph, 8, C_DIM);
    D.setTextColor(C_DIM, bg);
    D.setTextDatum(middle_center);
    D.drawString("--", px + pw / 2, py + ph / 2);
  } else {
    uint16_t fill = s.on ? C_LIME : C_DIM;
    D.fillRoundRect(px, py, pw, ph, 8, fill);
    D.setTextColor(s.on ? C_BG : C_INK, fill);
    D.setTextDatum(middle_center);
    D.drawString(s.on ? "ON" : "OFF", px + pw / 2, py + ph / 2);
  }
}

void drawList(int busyIndex = -1) {
  drawHeader("Home Control");
  D.fillRect(0, HEADER, W, H - HEADER - FOOTER, C_BG);

  if (switchCount == 0) {
    D.setFont(&fonts::DejaVu12);
    D.setTextDatum(middle_center);
    D.setTextColor(C_MUTED, C_BG);
    D.drawString(session.length() ? "No switches for this user" : "Signing in...", W / 2, H / 2);
  } else {
    if (selected < scrollTop) scrollTop = selected;
    if (selected >= scrollTop + VISIBLE_ROWS) scrollTop = selected - VISIBLE_ROWS + 1;
    for (int r = 0; r < VISIBLE_ROWS && scrollTop + r < switchCount; r++) {
      int i = scrollTop + r;
      drawRow(i, HEADER + r * ROW, i == busyIndex);
    }
  }
  drawFooter(";. move  Enter switch  t timer  r refresh");
}

String fmtTime(long secs) {
  if (secs < 0) secs = 0;
  char buf[16];
  if (secs >= 3600) snprintf(buf, sizeof(buf), "%ld:%02ld:%02ld", secs / 3600, (secs % 3600) / 60, secs % 60);
  else snprintf(buf, sizeof(buf), "%02ld:%02ld", secs / 60, secs % 60);
  return buf;
}

void drawTimers() {
  const Switch &s = switches[selected];
  drawHeader(("Timer: " + s.name).c_str());
  D.fillRect(0, HEADER, W, H - HEADER - FOOTER, C_BG);

  // New timer line
  D.setFont(&fonts::DejaVu12);
  D.setTextDatum(top_left);
  D.setTextColor(C_INK, C_BG);
  D.drawString(timerOn ? "Turn ON" : "Turn OFF", 6, HEADER + 6);
  D.setTextColor(C_MUTED, C_BG);
  D.drawString("after", 82, HEADER + 6);
  D.fillRoundRect(124, HEADER + 3, 64, 18, 6, C_CARD);
  D.setTextColor(C_LIME, C_CARD);
  D.drawString(timerMinutes + "_", 130, HEADER + 6);
  D.setTextColor(C_MUTED, C_BG);
  D.drawString("min", 194, HEADER + 6);

  // Running timers
  D.setFont(&fonts::DejaVu9);
  D.setTextColor(C_DIM, C_BG);
  D.drawString(runningCount ? "Running" : "No timers running", 6, HEADER + 30);
  long passed = (millis() - runningSyncedAt) / 1000;
  for (int i = 0; i < runningCount && i < 4; i++) {
    const RunningTimer &t = running[i];
    long left = t.remaining - passed;
    if (t.repeat && left <= 0) left = 0;
    D.setTextColor(C_INK, C_BG);
    D.drawString("#" + String(t.id) + "  Turn " + (t.action == "on" ? String("ON") : String("OFF")) + (t.repeat ? "  (repeat)" : ""), 6, HEADER + 44 + i * 12);
    D.setTextColor(C_LIME, C_BG);
    D.setTextDatum(top_right);
    D.drawString(fmtTime(left), W - 6, HEADER + 44 + i * 12);
    D.setTextDatum(top_left);
  }
  drawFooter("o on/off  0-9 min  Enter start  c cancel  ` back");
}

void redraw(int busyIndex = -1) {
  if (screen == LIST) drawList(busyIndex);
  else drawTimers();
}


// ============================================================
// HTTPS TO THE APP
// ============================================================

int api(const char* method, const String &path, const String &body, String* response) {

  if (WiFi.status() != WL_CONNECTED) return -1;

  WiFiClientSecure client;
  client.setCACert(ROOT_CA);
  client.setHandshakeTimeout(10);

  HTTPClient http;
  http.setConnectTimeout(8000);
  http.setTimeout(12000);
  if (!http.begin(client, String("https://") + APP_HOST + path)) return -1;

  const char* keep[] = { "Set-Cookie" };
  http.collectHeaders(keep, 1);
  http.addHeader("Content-Type", "application/json");
  if (session.length()) http.addHeader("Cookie", session);

  int code = http.sendRequest(method, body);
  if (response) *response = code > 0 ? http.getString() : "";

  // Sign-in answers with the session cookie.
  String cookie = http.header("Set-Cookie");
  if (cookie.startsWith("hc_session=")) {
    int end = cookie.indexOf(';');
    session = end > 0 ? cookie.substring(0, end) : cookie;
    prefs.putString("session", session);
  }

  http.end();
  return code;
}

bool signIn() {
  JsonDocument req;
  req["username"] = APP_USER;
  req["password"] = APP_PASSWORD;
  String body;
  serializeJson(req, body);
  String resp;
  session = "";
  int code = api("POST", "/api/auth/login", body, &resp);
  if (code == 200 && session.length()) return true;
  say(code == 401 ? "Sign-in refused: check user/password" : "Sign-in failed (" + String(code) + ")", C_RED, 8000);
  return false;
}

// Calls the app; signs in again once if the session expired.
int appCall(const char* method, const String &path, const String &body, String* response) {
  if (!session.length() && !signIn()) return 401;
  int code = api(method, path, body, response);
  if (code == 401 && signIn()) code = api(method, path, body, response);
  return code;
}

bool loadSwitches() {
  String resp;
  int code = appCall("GET", "/api/devices", "", &resp);
  if (code != 200) {
    say("Couldn't load switches (" + String(code) + ")", C_RED);
    return false;
  }

  JsonDocument filter;
  filter[0]["id"] = true;
  filter[0]["name"] = true;
  filter[0]["room"] = true;
  filter[0]["type"] = true;
  filter[0]["powerState"] = true;
  filter[0]["connectionState"] = true;
  JsonDocument doc;
  if (deserializeJson(doc, resp, DeserializationOption::Filter(filter))) return false;

  String keep = switchCount ? switches[selected].id : "";
  switchCount = 0;
  for (JsonObjectConst d : doc.as<JsonArrayConst>()) {
    if (switchCount >= MAX_SWITCHES) break;
    Switch &s = switches[switchCount++];
    s.id = d["id"] | "";
    s.name = d["name"] | "";
    s.room = d["room"] | "";
    s.type = d["type"] | "";
    s.on = strcmp(d["powerState"] | "", "on") == 0;
    s.online = strcmp(d["connectionState"] | "", "connected") == 0;
  }
  for (int i = 0; i < switchCount; i++) if (switches[i].id == keep) selected = i;
  if (selected >= switchCount) selected = switchCount ? switchCount - 1 : 0;
  lastRefresh = millis();
  return true;
}

// The board's own report for one switch: power, pending, timers.
bool readStatus(const String &id, bool* reachable, bool* pending, String* power) {
  String resp;
  if (appCall("GET", "/api/devices/status?deviceId=" + id, "", &resp) != 200) return false;
  JsonDocument doc;
  if (deserializeJson(doc, resp)) return false;
  *reachable = doc["reachable"] | false;
  *pending = doc["pending"] | false;
  *power = doc["power"] | "";
  runningCount = 0;
  for (JsonObjectConst t : doc["timers"].as<JsonArrayConst>()) {
    if (runningCount >= 10) break;
    running[runningCount++] = { t["id"] | 0, String(t["action"] | "off"), t["remaining"] | 0L, t["repeat"] | false };
  }
  runningSyncedAt = millis();
  return true;
}


// ============================================================
// ACTIONS
// ============================================================

// Same rule as the app: wait until the board itself reports the new state.
void toggleSelected() {
  if (!switchCount) return;
  Switch &s = switches[selected];
  if (!s.online) {
    say(s.name + " is offline", C_RED);
    return;
  }

  bool want = !s.on;
  drawList(selected);

  JsonDocument req;
  req["deviceId"] = s.id;
  req["action"] = want ? "on" : "off";
  String body, resp;
  serializeJson(req, body);
  if (appCall("POST", "/api/devices/control", body, &resp) != 200 || resp.indexOf("\"success\":false") >= 0) {
    say(s.name + " didn't switch", C_RED);
    return;
  }

  unsigned long until = millis() + 10000;
  while (millis() < until) {
    bool reachable = false, pending = true;
    String power;
    if (readStatus(s.id, &reachable, &pending, &power) && reachable && !pending) {
      if (power == (want ? "on" : "off")) {
        s.on = want;
        say(s.name + (want ? " ON" : " OFF"), C_LIME, 2500);
        return;
      }
      s.on = power == "on";
      say(s.name + " didn't switch", C_RED);
      return;
    }
    M5Cardputer.update();
    delay(400);
  }
  say(s.name + ": no answer from its board", C_RED);
}

void startTimer() {
  long minutes = timerMinutes.toInt();
  if (minutes < 1 || minutes > 1440) {
    say("Minutes: 1 to 1440", C_RED);
    return;
  }
  Switch &s = switches[selected];
  say("Starting timer...", C_MUTED, 15000);
  drawTimers();

  JsonDocument req;
  req["deviceId"] = s.id;
  req["action"] = timerOn ? "on" : "off";
  req["seconds"] = minutes * 60;
  req["repeat"] = false;
  String body, resp;
  serializeJson(req, body);
  int code = appCall("POST", "/api/devices/timer", body, &resp);
  if (code == 200 && resp.indexOf("\"success\":true") >= 0) say("Timer set", C_LIME, 2500);
  else say("Timer failed", C_RED);

  bool reachable, pending;
  String power;
  readStatus(s.id, &reachable, &pending, &power);
}

void cancelTimers() {
  Switch &s = switches[selected];
  say("Cancelling...", C_MUTED, 15000);
  drawTimers();
  JsonDocument req;
  req["deviceId"] = s.id;
  String body, resp;
  serializeJson(req, body);
  int code = appCall("POST", "/api/devices/timer/clear", body, &resp);
  say(code == 200 && resp.indexOf("\"success\":true") >= 0 ? "Timers cancelled" : "Cancel failed", code == 200 ? C_LIME : C_RED);
  bool reachable, pending;
  String power;
  readStatus(s.id, &reachable, &pending, &power);
}


// ============================================================
// WI-FI
// ============================================================

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  for (int i = 0; i < WIFI_COUNT; i++) {
    D.fillScreen(C_BG);
    D.setFont(&fonts::DejaVu12);
    D.setTextDatum(middle_center);
    D.setTextColor(C_INK, C_BG);
    D.drawString("Joining Wi-Fi", W / 2, H / 2 - 10);
    D.setTextColor(C_MUTED, C_BG);
    D.drawString(WIFI_NETWORKS[i].ssid, W / 2, H / 2 + 10);

    WiFi.begin(WIFI_NETWORKS[i].ssid, WIFI_NETWORKS[i].password);
    unsigned long start = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - start < 12000) delay(250);
    if (WiFi.status() == WL_CONNECTED) return;
    WiFi.disconnect(true);
  }
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

  prefs.begin("remote", false);
  session = prefs.getString("session", "");

  connectWiFi();
  drawList();
  loadSwitches();
  drawList();
}

void loop() {
  M5Cardputer.update();

  if (WiFi.status() != WL_CONNECTED) {
    say("Wi-Fi lost, reconnecting...", C_RED, 3000);
    drawList();
    connectWiFi();
    loadSwitches();
    redraw();
  }

  if (M5Cardputer.Keyboard.isChange() && M5Cardputer.Keyboard.isPressed()) {
    Keyboard_Class::KeysState k = M5Cardputer.Keyboard.keysState();
    char c = k.word.empty() ? 0 : k.word[0];

    if (screen == LIST) {
      if (c == ';' && selected > 0) selected--;
      else if (c == '.' && selected < switchCount - 1) selected++;
      else if (k.enter) toggleSelected();
      else if (c == 'r') { say("Refreshing...", C_MUTED, 1500); drawList(); loadSwitches(); }
      else if (c == 't' && switchCount) {
        screen = TIMERS;
        timerOn = !switches[selected].on;
        timerMinutes = "10";
        runningCount = 0;
        drawTimers();
        bool reachable, pending;
        String power;
        readStatus(switches[selected].id, &reachable, &pending, &power);
      }
    } else {
      if (c == '`') { screen = LIST; loadSwitches(); }
      else if (c == 'o') timerOn = !timerOn;
      else if (c >= '0' && c <= '9' && timerMinutes.length() < 4) timerMinutes = (timerMinutes == "0" ? String("") : timerMinutes) + c;
      else if (k.del && timerMinutes.length()) timerMinutes.remove(timerMinutes.length() - 1);
      else if (k.enter) startTimer();
      else if (c == 'c') cancelTimers();
    }
    redraw();
  }

  // Keep the list fresh (another phone may have switched something).
  if (screen == LIST && millis() - lastRefresh > REFRESH_MS) {
    loadSwitches();
    redraw();
  }

  // Tick the timer countdowns and clear old messages.
  static unsigned long lastTick = 0;
  if (millis() - lastTick > 1000) {
    lastTick = millis();
    if (screen == TIMERS) drawTimers();
    else drawFooter(";. move  Enter switch  t timer  r refresh");
  }

  delay(10);
}
