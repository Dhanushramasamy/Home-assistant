/*
  ESP201 - Eroad Bedroom
  =========================================

  Wi-Fi Priority:

  1. Pixel hotspot
     DHCP (the hotspot picks a new range each time)

  2. Home Wi-Fi
     SSID    : Dhanush-Wifi-2.4G
     DHCP

  3. Airtel Office
     IP      : 192.168.1.201
     Gateway : 192.168.1.1

  Relay:
     GPIO23
     Active LOW

  Timer API v2

  Cloud control (cloud.h): switched through Supabase from any network.
  Relays restore their last state after a power cut.
*/

#include <WiFi.h>
#include <WebServer.h>


// ============================================================
// WIFI 1 - PIXEL
// ============================================================

#include "secrets.h"  // Wi-Fi names and passwords (not in git; see secrets.example.h)

#define CLOUD_RELAYS 1
#include "cloud.h"


// ============================================================
// WIFI 2 - HOME
// ============================================================



// ============================================================
// WIFI 3 - AIRTEL OFFICE
// ============================================================


IPAddress AIRTEL_IP(192, 168, 1, 201);
IPAddress AIRTEL_GATEWAY(192, 168, 1, 1);
IPAddress AIRTEL_SUBNET(255, 255, 255, 0);
IPAddress AIRTEL_DNS(192, 168, 1, 1);


// ============================================================
// RELAY
// ============================================================

#define RELAY1_PIN 23

#define RELAY_ON LOW
#define RELAY_OFF HIGH

bool relay1State = false;


// ============================================================
// WEB SERVER
// ============================================================

WebServer server(80);


// ============================================================
// TIMER
// ============================================================

#define MAX_TIMERS 10

struct TimerData {

  bool active;

  uint32_t id;

  uint8_t relay;

  bool actionOn;

  bool repeat;

  uint32_t seconds;

  unsigned long scheduledAt;

  unsigned long durationMs;
};

TimerData timers[MAX_TIMERS];

uint32_t nextTimerId = 1;


// ============================================================
// WIFI STATE
// ============================================================

String currentNetwork = "";

unsigned long lastReconnectAttempt = 0;

const unsigned long RECONNECT_INTERVAL = 10000;


// ============================================================
// RELAY CONTROL
// ============================================================

void setRelay(uint8_t relay, bool on) {

  if (relay == 1) {

    bool changed = relay1State != on;

    relay1State = on;

    digitalWrite(
      RELAY1_PIN,
      on ? RELAY_ON : RELAY_OFF
    );

    if (changed) {
      cloudRelayChanged(relay, on);
    }
  }
}


bool getRelayState(uint8_t relay) {

  if (relay == 1) {
    return relay1State;
  }

  return false;
}


// ============================================================
// TIMER HELPERS
// ============================================================

void clearTimerSlot(int index) {

  timers[index].active = false;
  timers[index].id = 0;
  timers[index].relay = 0;
  timers[index].actionOn = false;
  timers[index].repeat = false;
  timers[index].seconds = 0;
  timers[index].scheduledAt = 0;
  timers[index].durationMs = 0;
}


void initializeTimers() {

  for (int i = 0; i < MAX_TIMERS; i++) {
    clearTimerSlot(i);
  }
}


int findFreeTimer() {

  for (int i = 0; i < MAX_TIMERS; i++) {

    if (!timers[i].active) {
      return i;
    }
  }

  return -1;
}


int findTimerById(uint32_t id) {

  for (int i = 0; i < MAX_TIMERS; i++) {

    if (
      timers[i].active &&
      timers[i].id == id
    ) {
      return i;
    }
  }

  return -1;
}


int countActiveTimers() {

  int count = 0;

  for (int i = 0; i < MAX_TIMERS; i++) {

    if (timers[i].active) {
      count++;
    }
  }

  return count;
}


uint32_t generateTimerId() {

  uint32_t id = nextTimerId++;

  if (nextTimerId == 0) {
    nextTimerId = 1;
  }

  return id;
}


// Changes whenever a timer is created, cancelled or finishes, so the cloud
// report goes out straight away.
uint32_t cloudTimerSignature() {

  return nextTimerId * 16 + countActiveTimers();
}


// Timer commands from the cloud (cloud.h). Same rules as /timer.
// Returns the new timer's id, or 0 with *error set.
uint32_t createTimer(uint8_t relay, bool actionOn, uint32_t seconds, bool repeat, const char** error) {

  if (relay != 1 || seconds < 1 || seconds > 86400) {
    *error = "invalid";
    return 0;
  }

  int slot = findFreeTimer();

  if (slot == -1) {
    *error = "limit";
    return 0;
  }

  TimerData &t = timers[slot];
  t.active = true;
  t.id = generateTimerId();
  t.relay = relay;
  t.actionOn = actionOn;
  t.repeat = repeat;
  t.seconds = seconds;
  t.durationMs = seconds * 1000UL;
  t.scheduledAt = millis();

  return t.id;
}


bool cancelTimerById(uint32_t id) {

  int index = findTimerById(id);

  if (index == -1) {
    return false;
  }

  clearTimerSlot(index);
  return true;
}


// Returns how many were cancelled, or -1 for an unknown relay.
int cancelTimersOnRelay(uint8_t relay) {

  if (relay != 1) {
    return -1;
  }

  int cancelled = 0;

  for (int i = 0; i < MAX_TIMERS; i++) {
    if (timers[i].active && timers[i].relay == relay) {
      clearTimerSlot(i);
      cancelled++;
    }
  }

  return cancelled;
}


// ============================================================
// TIMER JSON
// ============================================================

String timerToJSON(int index) {

  TimerData &t = timers[index];

  unsigned long now = millis();

  unsigned long elapsed =
    (unsigned long)(now - t.scheduledAt);

  uint32_t remaining = 0;

  if (elapsed < t.durationMs) {

    unsigned long remainingMs =
      t.durationMs - elapsed;

    remaining =
      (remainingMs + 999) / 1000;
  }

  String json = "{";

  json += "\"active\":";
  json += t.active ? "true" : "false";

  json += ",\"id\":";
  json += String(t.id);

  json += ",\"relay\":";
  json += String(t.relay);

  json += ",\"action\":\"";
  json += t.actionOn ? "on" : "off";
  json += "\"";

  json += ",\"repeat\":";
  json += t.repeat ? "true" : "false";

  json += ",\"seconds\":";
  json += String(t.seconds);

  json += ",\"remaining\":";
  json += String(remaining);

  json += "}";

  return json;
}


// ============================================================
// STATUS
// ============================================================

String getStatusJSON() {

  String json = "{";

  json += "\"ok\":true";

  json += ",\"timerApi\":2";

  json += ",\"device\":\"";
  json += BOARD_ID;
  json += "\"";

  json += ",\"relay1\":";
  json += relay1State ? "true" : "false";

  json += ",\"relays\":[{\"relay\":1,\"power\":\"";
  json += relay1State ? "on" : "off";
  json += "\"}]";

  json += ",\"timers\":[";

  bool first = true;

  for (int i = 0; i < MAX_TIMERS; i++) {

    if (timers[i].active) {

      if (!first) {
        json += ",";
      }

      json += timerToJSON(i);

      first = false;
    }
  }

  json += "]";

  json += ",\"uptime\":";
  json += String(millis() / 1000);

  json += ",\"ip\":\"";
  json += WiFi.localIP().toString();
  json += "\"";

  json += ",\"ssid\":\"";
  json += WiFi.SSID();
  json += "\"";

  json += ",\"rssi\":";
  json += String(WiFi.RSSI());

  json += ",\"network\":\"";
  json += currentNetwork;
  json += "\"";

  json += ",\"cloud\":\"";
  json += cloudState;
  json += "\"";

  json += ",\"acks\":";
  json += cloudAcksJSON();

  json += "}";

  return json;
}


// ============================================================
// CORS
// ============================================================

void addCORS() {

  server.sendHeader(
    "Access-Control-Allow-Origin",
    "*"
  );

  server.sendHeader(
    "Access-Control-Allow-Methods",
    "GET, OPTIONS"
  );

  server.sendHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );
}


void handleOptions() {

  addCORS();

  server.send(
    204,
    "text/plain",
    ""
  );
}


// ============================================================
// ROOT
// ============================================================

void handleRoot() {

  addCORS();

  String response;

  response += "ESP201 Eroad Bedroom\n";
  response += "Timer API v2\n";
  response += "Network: ";
  response += currentNetwork;
  response += "\n";
  response += "SSID: ";
  response += WiFi.SSID();
  response += "\n";
  response += "IP: ";
  response += WiFi.localIP().toString();
  response += "\n";
  response += "Relay: ";
  response += relay1State ? "ON" : "OFF";
  response += "\n";

  server.send(
    200,
    "text/plain",
    response
  );
}


// ============================================================
// STATUS
// ============================================================

void handleStatus() {

  addCORS();

  server.send(
    200,
    "application/json",
    getStatusJSON()
  );
}


// ============================================================
// ON
// ============================================================

void handleOn() {

  addCORS();

  if (!server.hasArg("relay")) {

    server.send(
      400,
      "application/json",
      "{\"ok\":false,\"error\":\"relay required\"}"
    );

    return;
  }

  int relay =
    server.arg("relay").toInt();

  if (relay != 1) {

    server.send(
      400,
      "application/json",
      "{\"ok\":false,\"error\":\"invalid relay\"}"
    );

    return;
  }

  setRelay(relay, true);

  String json = "{";

  json += "\"ok\":true";
  json += ",\"relay\":";
  json += String(relay);
  json += ",\"state\":\"on\"";

  json += "}";

  server.send(
    200,
    "application/json",
    json
  );
}


// ============================================================
// OFF
// ============================================================

void handleOff() {

  addCORS();

  if (!server.hasArg("relay")) {

    server.send(
      400,
      "application/json",
      "{\"ok\":false,\"error\":\"relay required\"}"
    );

    return;
  }

  int relay =
    server.arg("relay").toInt();

  if (relay != 1) {

    server.send(
      400,
      "application/json",
      "{\"ok\":false,\"error\":\"invalid relay\"}"
    );

    return;
  }

  setRelay(relay, false);

  String json = "{";

  json += "\"ok\":true";
  json += ",\"relay\":";
  json += String(relay);
  json += ",\"state\":\"off\"";

  json += "}";

  server.send(
    200,
    "application/json",
    json
  );
}


// ============================================================
// TOGGLE
// ============================================================

void handleToggle() {

  addCORS();

  if (!server.hasArg("relay")) {

    server.send(
      400,
      "application/json",
      "{\"ok\":false,\"error\":\"relay required\"}"
    );

    return;
  }

  int relay =
    server.arg("relay").toInt();

  if (relay != 1) {

    server.send(
      400,
      "application/json",
      "{\"ok\":false,\"error\":\"invalid relay\"}"
    );

    return;
  }

  bool newState =
    !getRelayState(relay);

  setRelay(
    relay,
    newState
  );

  String json = "{";

  json += "\"ok\":true";
  json += ",\"relay\":";
  json += String(relay);
  json += ",\"state\":\"";
  json += newState ? "on" : "off";
  json += "\"";

  json += "}";

  server.send(
    200,
    "application/json",
    json
  );
}


// ============================================================
// CREATE TIMER
// ============================================================

void handleTimer() {

  addCORS();

  if (
    !server.hasArg("relay") ||
    !server.hasArg("action") ||
    !server.hasArg("seconds")
  ) {

    server.send(
      400,
      "application/json",
      "{\"ok\":false,\"error\":\"relay, action and seconds required\"}"
    );

    return;
  }

  int relay =
    server.arg("relay").toInt();

  if (relay != 1) {

    server.send(
      400,
      "application/json",
      "{\"ok\":false,\"error\":\"invalid relay\"}"
    );

    return;
  }

  String action =
    server.arg("action");

  action.toLowerCase();

  bool actionOn;

  if (action == "on") {

    actionOn = true;

  } else if (action == "off") {

    actionOn = false;

  } else {

    server.send(
      400,
      "application/json",
      "{\"ok\":false,\"error\":\"action must be on or off\"}"
    );

    return;
  }

  unsigned long seconds =
    server.arg("seconds").toInt();

  if (
    seconds < 1 ||
    seconds > 86400
  ) {

    server.send(
      400,
      "application/json",
      "{\"ok\":false,\"error\":\"seconds must be between 1 and 86400\"}"
    );

    return;
  }

  bool repeat = false;

  if (server.hasArg("repeat")) {

    String repeatArg =
      server.arg("repeat");

    repeatArg.toLowerCase();

    if (
      repeatArg == "true" ||
      repeatArg == "1"
    ) {
      repeat = true;
    }
  }

  int slot =
    findFreeTimer();

  if (slot == -1) {

    server.send(
      409,
      "application/json",
      "{\"ok\":false,\"error\":\"maximum 10 timers active\"}"
    );

    return;
  }

  TimerData &t =
    timers[slot];

  t.active = true;

  t.id =
    generateTimerId();

  t.relay =
    relay;

  t.actionOn =
    actionOn;

  t.repeat =
    repeat;

  t.seconds =
    seconds;

  t.durationMs =
    seconds * 1000UL;

  t.scheduledAt =
    millis();

  String json = "{";

  json += "\"ok\":true";
  json += ",\"relay\":";
  json += String(relay);
  json += ",\"timer\":";
  json += timerToJSON(slot);

  json += "}";

  server.send(
    200,
    "application/json",
    json
  );
}


// ============================================================
// CANCEL TIMER
// ============================================================

void handleTimerCancel() {

  addCORS();

  if (server.hasArg("id")) {

    uint32_t id =
      server.arg("id").toInt();

    int index =
      findTimerById(id);

    if (index == -1) {

      server.send(
        404,
        "application/json",
        "{\"ok\":false,\"error\":\"timer not found\"}"
      );

      return;
    }

    clearTimerSlot(index);

    String json = "{";

    json += "\"ok\":true";
    json += ",\"cancelled\":";
    json += String(id);

    json += "}";

    server.send(
      200,
      "application/json",
      json
    );

    return;
  }


  if (server.hasArg("relay")) {

    int relay =
      server.arg("relay").toInt();

    if (relay != 1) {

      server.send(
        400,
        "application/json",
        "{\"ok\":false,\"error\":\"invalid relay\"}"
      );

      return;
    }

    int cancelled = 0;

    for (int i = 0; i < MAX_TIMERS; i++) {

      if (
        timers[i].active &&
        timers[i].relay == relay
      ) {

        clearTimerSlot(i);

        cancelled++;
      }
    }

    String json = "{";

    json += "\"ok\":true";
    json += ",\"relay\":";
    json += String(relay);
    json += ",\"cancelled\":";
    json += String(cancelled);

    json += "}";

    server.send(
      200,
      "application/json",
      json
    );

    return;
  }

  server.send(
    400,
    "application/json",
    "{\"ok\":false,\"error\":\"id or relay required\"}"
  );
}


// ============================================================
// LIST TIMERS
// ============================================================

void handleTimers() {

  addCORS();

  String json = "{";

  json += "\"ok\":true";
  json += ",\"timers\":[";

  bool first = true;

  for (int i = 0; i < MAX_TIMERS; i++) {

    if (timers[i].active) {

      if (!first) {
        json += ",";
      }

      json += timerToJSON(i);

      first = false;
    }
  }

  json += "]";

  json += ",\"count\":";
  json += String(countActiveTimers());

  json += "}";

  server.send(
    200,
    "application/json",
    json
  );
}


// ============================================================
// CLEAR TIMERS
// ============================================================

void handleTimerClear() {

  addCORS();

  if (server.hasArg("relay")) {

    int relay =
      server.arg("relay").toInt();

    if (relay != 1) {

      server.send(
        400,
        "application/json",
        "{\"ok\":false,\"error\":\"invalid relay\"}"
      );

      return;
    }

    int cleared = 0;

    for (int i = 0; i < MAX_TIMERS; i++) {

      if (
        timers[i].active &&
        timers[i].relay == relay
      ) {

        clearTimerSlot(i);

        cleared++;
      }
    }

    String json = "{";

    json += "\"ok\":true";
    json += ",\"relay\":";
    json += String(relay);
    json += ",\"cleared\":";
    json += String(cleared);

    json += "}";

    server.send(
      200,
      "application/json",
      json
    );

    return;
  }


  int cleared = 0;

  for (int i = 0; i < MAX_TIMERS; i++) {

    if (timers[i].active) {

      clearTimerSlot(i);

      cleared++;
    }
  }

  String json = "{";

  json += "\"ok\":true";
  json += ",\"cleared\":";
  json += String(cleared);

  json += "}";

  server.send(
    200,
    "application/json",
    json
  );
}


// ============================================================
// 404
// ============================================================

void handleNotFound() {

  addCORS();

  server.send(
    404,
    "application/json",
    "{\"ok\":false,\"error\":\"endpoint not found\"}"
  );
}


// ============================================================
// CONNECT TO PIXEL
// ============================================================

bool connectPixel() {

  Serial.println();
  Serial.println(
    "================================"
  );

  Serial.println(
    "Trying PRIORITY 1: PIXEL"
  );

  Serial.println(
    "================================"
  );

  WiFi.disconnect(false, false);

  delay(500);


  // DHCP: the hotspot's address range changes every time it starts.
  WiFi.config(
    INADDR_NONE,
    INADDR_NONE,
    INADDR_NONE
  );


  WiFi.begin(
    PIXEL_SSID,
    PIXEL_PASSWORD
  );


  unsigned long start =
    millis();


  while (
    WiFi.status() != WL_CONNECTED &&
    millis() - start < 15000
  ) {

    delay(500);

    Serial.print(".");
  }

  Serial.println();


  if (
    WiFi.status() ==
    WL_CONNECTED
  ) {

    currentNetwork =
      "PIXEL";

    Serial.println(
      "CONNECTED TO PIXEL"
    );

    Serial.print(
      "IP: "
    );

    Serial.println(
      WiFi.localIP()
    );

    return true;
  }


  Serial.println(
    "Pixel connection failed."
  );

  return false;
}


// ============================================================
// CONNECT TO HOME
// ============================================================

bool connectHome() {

  Serial.println();
  Serial.println(
    "================================"
  );

  Serial.println(
    "Trying PRIORITY 2: HOME"
  );

  Serial.println(
    "================================"
  );


  WiFi.disconnect(false, false);

  delay(500);


  // HOME uses DHCP
  WiFi.config(
    INADDR_NONE,
    INADDR_NONE,
    INADDR_NONE
  );


  WiFi.begin(
    HOME_SSID,
    HOME_PASSWORD
  );


  unsigned long start =
    millis();


  while (
    WiFi.status() != WL_CONNECTED &&
    millis() - start < 15000
  ) {

    delay(500);

    Serial.print(".");
  }

  Serial.println();


  if (
    WiFi.status() ==
    WL_CONNECTED
  ) {

    currentNetwork =
      "HOME";

    Serial.println(
      "CONNECTED TO HOME"
    );

    Serial.print(
      "IP: "
    );

    Serial.println(
      WiFi.localIP()
    );

    Serial.print(
      "Gateway: "
    );

    Serial.println(
      WiFi.gatewayIP()
    );

    return true;
  }


  Serial.println(
    "Home connection failed."
  );

  return false;
}


// ============================================================
// CONNECT TO AIRTEL
// ============================================================

bool connectAirtel() {

  Serial.println();
  Serial.println(
    "================================"
  );

  Serial.println(
    "Trying PRIORITY 3: AIRTEL"
  );

  Serial.println(
    "================================"
  );


  WiFi.disconnect(false, false);

  delay(500);


  if (
    !WiFi.config(
      AIRTEL_IP,
      AIRTEL_GATEWAY,
      AIRTEL_SUBNET,
      AIRTEL_DNS
    )
  ) {

    Serial.println(
      "Airtel WiFi.config failed"
    );
  }


  WiFi.begin(
    AIRTEL_SSID,
    AIRTEL_PASSWORD
  );


  unsigned long start =
    millis();


  while (
    WiFi.status() != WL_CONNECTED &&
    millis() - start < 15000
  ) {

    delay(500);

    Serial.print(".");
  }

  Serial.println();


  if (
    WiFi.status() ==
    WL_CONNECTED
  ) {

    currentNetwork =
      "AIRTEL";

    Serial.println(
      "CONNECTED TO AIRTEL"
    );

    Serial.print(
      "IP: "
    );

    Serial.println(
      WiFi.localIP()
    );

    return true;
  }


  Serial.println(
    "Airtel connection failed."
  );

  return false;
}


// ============================================================
// WIFI PRIORITY CONTROLLER
// ============================================================

bool connectWiFi() {

  Serial.println();
  Serial.println(
    "################################"
  );

  Serial.println(
    "ESP201 Wi-Fi Priority"
  );

  Serial.println(
    "1. Pixel"
  );

  Serial.println(
    "2. Home"
  );

  Serial.println(
    "3. Airtel"
  );

  Serial.println(
    "################################"
  );


  // ----------------------------------------------------------
  // 1. PIXEL
  // ----------------------------------------------------------

  if (connectPixel()) {
    return true;
  }


  // ----------------------------------------------------------
  // 2. HOME
  // ----------------------------------------------------------

  if (connectHome()) {
    return true;
  }


  // ----------------------------------------------------------
  // 3. AIRTEL
  // ----------------------------------------------------------

  if (connectAirtel()) {
    return true;
  }


  Serial.println();
  Serial.println(
    "FAILED: No Wi-Fi network available"
  );

  return false;
}


// ============================================================
// PROCESS TIMERS
// ============================================================

void processTimers() {

  unsigned long now =
    millis();


  for (int i = 0; i < MAX_TIMERS; i++) {

    if (!timers[i].active) {
      continue;
    }


    TimerData &t =
      timers[i];


    unsigned long elapsed =
      (unsigned long)(
        now - t.scheduledAt
      );


    if (
      elapsed >=
      t.durationMs
    ) {

      Serial.println();
      Serial.println(
        "Timer expired"
      );

      Serial.print(
        "ID: "
      );

      Serial.println(
        t.id
      );

      Serial.print(
        "Relay: "
      );

      Serial.println(
        t.relay
      );

      Serial.print(
        "Action: "
      );

      Serial.println(
        t.actionOn ? "ON" : "OFF"
      );


      setRelay(
        t.relay,
        t.actionOn
      );


      // ------------------------------------------------------
      // REPEAT TIMER
      // ------------------------------------------------------

      if (t.repeat) {

        unsigned long periodsElapsed =
          elapsed /
          t.durationMs;

        if (periodsElapsed == 0) {
          periodsElapsed = 1;
        }

        t.scheduledAt +=
          periodsElapsed *
          t.durationMs;

      }


      // ------------------------------------------------------
      // ONE SHOT
      // ------------------------------------------------------

      else {

        clearTimerSlot(i);
      }
    }
  }
}


// ============================================================
// ROUTES
// ============================================================

void setupRoutes() {

  server.on(
    "/",
    HTTP_GET,
    handleRoot
  );

  server.on(
    "/status",
    HTTP_GET,
    handleStatus
  );

  server.on(
    "/on",
    HTTP_GET,
    handleOn
  );

  server.on(
    "/off",
    HTTP_GET,
    handleOff
  );

  server.on(
    "/toggle",
    HTTP_GET,
    handleToggle
  );

  server.on(
    "/timer",
    HTTP_GET,
    handleTimer
  );

  server.on(
    "/timer/cancel",
    HTTP_GET,
    handleTimerCancel
  );

  server.on(
    "/timers",
    HTTP_GET,
    handleTimers
  );

  server.on(
    "/timer/clear",
    HTTP_GET,
    handleTimerClear
  );

  server.on(
    "/timers/clear",
    HTTP_GET,
    handleTimerClear
  );


  server.on(
    "/",
    HTTP_OPTIONS,
    handleOptions
  );

  server.on(
    "/status",
    HTTP_OPTIONS,
    handleOptions
  );

  server.on(
    "/on",
    HTTP_OPTIONS,
    handleOptions
  );

  server.on(
    "/off",
    HTTP_OPTIONS,
    handleOptions
  );

  server.on(
    "/toggle",
    HTTP_OPTIONS,
    handleOptions
  );

  server.on(
    "/timer",
    HTTP_OPTIONS,
    handleOptions
  );

  server.on(
    "/timer/cancel",
    HTTP_OPTIONS,
    handleOptions
  );

  server.on(
    "/timers",
    HTTP_OPTIONS,
    handleOptions
  );

  server.on(
    "/timer/clear",
    HTTP_OPTIONS,
    handleOptions
  );

  server.on(
    "/timers/clear",
    HTTP_OPTIONS,
    handleOptions
  );


  server.onNotFound(
    handleNotFound
  );
}


// ============================================================
// SETUP
// ============================================================

void setup() {

  Serial.begin(115200);

  delay(1000);


  Serial.println();
  Serial.println(
    "========================================"
  );

  Serial.println(
    "ESP201 - EROAD BEDROOM"
  );

  Serial.println(
    "TIMER API v2"
  );

  Serial.println(
    "3 NETWORK WIFI"
  );

  Serial.println(
    "Pixel -> Home -> Airtel"
  );

  Serial.println(
    "========================================"
  );


  // ----------------------------------------------------------
  // RELAY
  // ----------------------------------------------------------

  pinMode(
    RELAY1_PIN,
    OUTPUT
  );

  digitalWrite(
    RELAY1_PIN,
    RELAY_OFF
  );

  relay1State = false;


  // ----------------------------------------------------------
  // TIMERS
  // ----------------------------------------------------------

  initializeTimers();


  // ----------------------------------------------------------
  // CLOUD (restores the relay's last state)
  // ----------------------------------------------------------

  cloudBegin();


  // ----------------------------------------------------------
  // WIFI
  // ----------------------------------------------------------

  WiFi.mode(
    WIFI_STA
  );

  WiFi.setAutoReconnect(
    true
  );

  WiFi.persistent(
    false
  );

  WiFi.setSleep(
    false
  );


  // ----------------------------------------------------------
  // CONNECT
  // ----------------------------------------------------------

  connectWiFi();


  // ----------------------------------------------------------
  // SERVER
  // ----------------------------------------------------------

  setupRoutes();

  server.begin();


  Serial.println();
  Serial.println(
    "HTTP server started"
  );

  Serial.print(
    "Network: "
  );

  Serial.println(
    currentNetwork
  );

  Serial.print(
    "IP: "
  );

  Serial.println(
    WiFi.localIP()
  );

  Serial.println();
}


// ============================================================
// LOOP
// ============================================================

void loop() {

  server.handleClient();


  processTimers();


  cloudLoop();


  // ----------------------------------------------------------
  // WIFI RECONNECT
  // ----------------------------------------------------------

  if (
    WiFi.status() != WL_CONNECTED
  ) {

    unsigned long now =
      millis();


    if (
      now - lastReconnectAttempt >=
      RECONNECT_INTERVAL
    ) {

      lastReconnectAttempt =
        now;

      Serial.println();
      Serial.println(
        "Wi-Fi disconnected."
      );

      Serial.println(
        "Trying networks again..."
      );


      // Always starts:
      // Pixel -> Home -> Airtel

      connectWiFi();
    }
  }


  delay(1);
}
