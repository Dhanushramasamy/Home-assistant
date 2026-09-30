#include <WiFi.h>
#include <WebServer.h>

// ============================================================
// ESP200 - TWO RELAY CONTROLLER
// Timer API v2
// ============================================================

// ============================================================
// WIFI CONFIGURATION
// ============================================================

#include "secrets.h"  // Wi-Fi names and passwords (not in git; see secrets.example.h)

// Static IP for ESP200
IPAddress local_IP(192, 168, 1, 200);
IPAddress gateway(192, 168, 1, 1);
IPAddress subnet(255, 255, 255, 0);
IPAddress primaryDNS(192, 168, 1, 1);
IPAddress secondaryDNS(8, 8, 8, 8);

// ============================================================
// HTTP SERVER
// ============================================================

WebServer server(80);

// ============================================================
// RELAY CONFIGURATION
// ============================================================

#define RELAY1_PIN 23
#define RELAY2_PIN 22

// Most relay modules are active LOW
#define RELAY_ON LOW
#define RELAY_OFF HIGH

bool relay1State = false;
bool relay2State = false;

// ============================================================
// TIMER CONFIGURATION
// ============================================================

#define MAX_TIMERS 10

struct RelayTimer {

  bool active;

  unsigned long id;

  int relay;

  // true  = ON
  // false = OFF
  bool targetState;

  // Timer duration in milliseconds
  unsigned long duration;

  // Time when timer was scheduled
  unsigned long startTime;

  // Repeat timer?
  bool repeat;
};

RelayTimer timers[MAX_TIMERS];

// IDs are unique during this ESP32 boot.
// IDs are never reused after cancellation/completion.
unsigned long nextTimerId = 1;

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
    "GET, HEAD, OPTIONS"
  );

  server.sendHeader(
    "Access-Control-Allow-Headers",
    "*"
  );

  server.sendHeader(
    "Access-Control-Allow-Private-Network",
    "true"
  );
}

// ============================================================
// JSON ERROR
// ============================================================

void sendJsonError(
  int statusCode,
  const String& error
) {

  addCORS();

  String response = "{";

  response += "\"ok\":false,";
  response += "\"error\":\"";
  response += error;
  response += "\"";

  response += "}";

  server.send(
    statusCode,
    "application/json",
    response
  );
}

// ============================================================
// RELAY CONTROL
// ============================================================

void setRelay(
  int relay,
  bool state
) {

  if (relay == 1) {

    relay1State = state;

    digitalWrite(
      RELAY1_PIN,
      state ? RELAY_ON : RELAY_OFF
    );
  }

  else if (relay == 2) {

    relay2State = state;

    digitalWrite(
      RELAY2_PIN,
      state ? RELAY_ON : RELAY_OFF
    );
  }
}

// ============================================================
// TIMER → JSON
// ============================================================

String timerToJSON(
  RelayTimer &timer
) {

  unsigned long now = millis();

  unsigned long elapsed =
    now - timer.startTime;

  unsigned long remaining = 0;

  if (elapsed < timer.duration) {

    remaining =
      timer.duration - elapsed;
  }

  String json = "{";

  json += "\"active\":true,";

  json += "\"id\":";
  json += String(timer.id);
  json += ",";

  json += "\"relay\":";
  json += String(timer.relay);
  json += ",";

  json += "\"action\":\"";

  if (timer.targetState) {
    json += "on";
  }
  else {
    json += "off";
  }

  json += "\",";

  json += "\"repeat\":";

  if (timer.repeat) {
    json += "true";
  }
  else {
    json += "false";
  }

  json += ",";

  json += "\"seconds\":";
  json += String(
    timer.duration / 1000UL
  );

  json += ",";

  json += "\"remaining\":";
  json += String(
    remaining / 1000UL
  );

  json += "}";

  return json;
}

// ============================================================
// STATUS JSON
// ============================================================

String getStatusJSON() {

  String json = "{";

  json += "\"ok\":true,";

  json += "\"device\":\"ESP200\",";

  // Timer API version
  json += "\"timerApi\":2,";

  // ----------------------------------------------------------
  // RELAYS
  // ----------------------------------------------------------

  json += "\"relays\":[";

  json += "{";
  json += "\"relay\":1,";
  json += "\"power\":\"";

  json += relay1State ? "on" : "off";

  json += "\"";
  json += "},";

  json += "{";
  json += "\"relay\":2,";
  json += "\"power\":\"";

  json += relay2State ? "on" : "off";

  json += "\"";
  json += "}";

  json += "],";

  // ----------------------------------------------------------
  // TIMERS
  // ----------------------------------------------------------

  json += "\"timers\":[";

  bool first = true;

  for (
    int i = 0;
    i < MAX_TIMERS;
    i++
  ) {

    if (!timers[i].active) {
      continue;
    }

    if (!first) {
      json += ",";
    }

    first = false;

    json += timerToJSON(
      timers[i]
    );
  }

  json += "],";

  // ----------------------------------------------------------
  // SYSTEM INFO
  // ----------------------------------------------------------

  json += "\"uptime\":";
  json += String(
    millis() / 1000UL
  );

  json += ",";

  json += "\"ip\":\"";
  json += WiFi.localIP().toString();
  json += "\",";

  json += "\"ssid\":\"";
  json += WiFi.SSID();
  json += "\",";

  json += "\"rssi\":";
  json += String(
    WiFi.RSSI()
  );

  json += "}";

  return json;
}

// ============================================================
// GET /status
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
// GET /on?relay=1
// ============================================================

void handleOn() {

  addCORS();

  if (!server.hasArg("relay")) {

    sendJsonError(
      400,
      "relay is required"
    );

    return;
  }

  int relay =
    server.arg("relay").toInt();

  if (
    relay != 1 &&
    relay != 2
  ) {

    sendJsonError(
      400,
      "relay must be 1 or 2"
    );

    return;
  }

  setRelay(
    relay,
    true
  );

  String response = "{";

  response += "\"ok\":true,";
  response += "\"relay\":";
  response += String(relay);
  response += ",";
  response += "\"power\":\"on\"";

  response += "}";

  server.send(
    200,
    "application/json",
    response
  );
}

// ============================================================
// GET /off?relay=1
// ============================================================

void handleOff() {

  addCORS();

  if (!server.hasArg("relay")) {

    sendJsonError(
      400,
      "relay is required"
    );

    return;
  }

  int relay =
    server.arg("relay").toInt();

  if (
    relay != 1 &&
    relay != 2
  ) {

    sendJsonError(
      400,
      "relay must be 1 or 2"
    );

    return;
  }

  setRelay(
    relay,
    false
  );

  String response = "{";

  response += "\"ok\":true,";
  response += "\"relay\":";
  response += String(relay);
  response += ",";
  response += "\"power\":\"off\"";

  response += "}";

  server.send(
    200,
    "application/json",
    response
  );
}

// ============================================================
// GET /toggle?relay=1
// ============================================================

void handleToggle() {

  addCORS();

  if (!server.hasArg("relay")) {

    sendJsonError(
      400,
      "relay is required"
    );

    return;
  }

  int relay =
    server.arg("relay").toInt();

  if (
    relay != 1 &&
    relay != 2
  ) {

    sendJsonError(
      400,
      "relay must be 1 or 2"
    );

    return;
  }

  bool currentState;

  if (relay == 1) {
    currentState = relay1State;
  }
  else {
    currentState = relay2State;
  }

  bool newState =
    !currentState;

  setRelay(
    relay,
    newState
  );

  String response = "{";

  response += "\"ok\":true,";
  response += "\"relay\":";
  response += String(relay);
  response += ",";

  response += "\"power\":\"";

  response += newState
    ? "on"
    : "off";

  response += "\"";

  response += "}";

  server.send(
    200,
    "application/json",
    response
  );
}

// ============================================================
// GET /timer
//
// Example:
//
// /timer?relay=1&action=off&seconds=3600
//
// Optional:
//
// &repeat=true
//
// IMPORTANT:
// Creating the timer does NOT change the relay.
// ============================================================

void handleTimer() {

  addCORS();

  // ----------------------------------------------------------
  // Relay
  // ----------------------------------------------------------

  if (!server.hasArg("relay")) {

    sendJsonError(
      400,
      "relay is required"
    );

    return;
  }

  int relay =
    server.arg("relay").toInt();

  if (
    relay != 1 &&
    relay != 2
  ) {

    sendJsonError(
      400,
      "relay must be 1 or 2"
    );

    return;
  }

  // ----------------------------------------------------------
  // Action
  // ----------------------------------------------------------

  if (!server.hasArg("action")) {

    sendJsonError(
      400,
      "action is required"
    );

    return;
  }

  String action =
    server.arg("action");

  action.toLowerCase();

  if (
    action != "on" &&
    action != "off"
  ) {

    sendJsonError(
      400,
      "action must be on or off"
    );

    return;
  }

  bool targetState =
    action == "on";

  // ----------------------------------------------------------
  // Seconds
  // ----------------------------------------------------------

  if (!server.hasArg("seconds")) {

    sendJsonError(
      400,
      "seconds is required"
    );

    return;
  }

  long seconds =
    server.arg("seconds").toInt();

  if (
    seconds < 1 ||
    seconds > 86400
  ) {

    sendJsonError(
      400,
      "seconds must be 1-86400"
    );

    return;
  }

  // ----------------------------------------------------------
  // Repeat
  // ----------------------------------------------------------

  bool repeat = false;

  if (server.hasArg("repeat")) {

    String repeatValue =
      server.arg("repeat");

    repeatValue.toLowerCase();

    if (
      repeatValue == "true" ||
      repeatValue == "1"
    ) {

      repeat = true;

    }
    else if (
      repeatValue == "false" ||
      repeatValue == "0"
    ) {

      repeat = false;

    }
    else {

      sendJsonError(
        400,
        "repeat must be true or false"
      );

      return;
    }
  }

  // ----------------------------------------------------------
  // Find empty timer slot
  // ----------------------------------------------------------

  int slot = -1;

  for (
    int i = 0;
    i < MAX_TIMERS;
    i++
  ) {

    if (!timers[i].active) {

      slot = i;

      break;
    }
  }

  // ----------------------------------------------------------
  // Maximum 10 timers
  // ----------------------------------------------------------

  if (slot == -1) {

    sendJsonError(
      409,
      "maximum 10 timers active"
    );

    return;
  }

  // ----------------------------------------------------------
  // Allocate unique ID
  // ----------------------------------------------------------

  unsigned long timerId =
    nextTimerId;

  nextTimerId++;

  // Never use zero
  if (nextTimerId == 0) {

    nextTimerId = 1;
  }

  // ----------------------------------------------------------
  // Create timer
  // ----------------------------------------------------------

  timers[slot].active = true;

  timers[slot].id =
    timerId;

  timers[slot].relay =
    relay;

  timers[slot].targetState =
    targetState;

  timers[slot].duration =
    (unsigned long)seconds * 1000UL;

  timers[slot].startTime =
    millis();

  timers[slot].repeat =
    repeat;

  // ----------------------------------------------------------
  // IMPORTANT:
  //
  // We DO NOT call setRelay() here.
  //
  // Relay stays unchanged until timer fires.
  // ----------------------------------------------------------

  String response = "{";

  response += "\"ok\":true,";

  response += "\"relay\":";
  response += String(relay);
  response += ",";

  response += "\"timer\":";

  response += timerToJSON(
    timers[slot]
  );

  response += "}";

  server.send(
    200,
    "application/json",
    response
  );
}

// ============================================================
// GET /timer/cancel?id=7
//
// OR
//
// GET /timer/cancel?relay=1
// ============================================================

void handleTimerCancel() {

  addCORS();

  // ----------------------------------------------------------
  // Cancel by ID
  // ----------------------------------------------------------

  if (server.hasArg("id")) {

    unsigned long id =
      strtoul(
        server.arg("id").c_str(),
        nullptr,
        10
      );

    if (id == 0) {

      sendJsonError(
        400,
        "invalid timer id"
      );

      return;
    }

    for (
      int i = 0;
      i < MAX_TIMERS;
      i++
    ) {

      if (
        timers[i].active &&
        timers[i].id == id
      ) {

        timers[i].active = false;

        String response = "{";

        response += "\"ok\":true,";
        response += "\"id\":";
        response += String(id);
        response += ",";
        response += "\"cancelled\":true";

        response += "}";

        server.send(
          200,
          "application/json",
          response
        );

        return;
      }
    }

    sendJsonError(
      404,
      "timer not found"
    );

    return;
  }

  // ----------------------------------------------------------
  // Cancel all timers on relay
  // ----------------------------------------------------------

  if (server.hasArg("relay")) {

    int relay =
      server.arg("relay").toInt();

    if (
      relay != 1 &&
      relay != 2
    ) {

      sendJsonError(
        400,
        "relay must be 1 or 2"
      );

      return;
    }

    int cancelled = 0;

    for (
      int i = 0;
      i < MAX_TIMERS;
      i++
    ) {

      if (
        timers[i].active &&
        timers[i].relay == relay
      ) {

        timers[i].active = false;

        cancelled++;
      }
    }

    String response = "{";

    response += "\"ok\":true,";
    response += "\"relay\":";
    response += String(relay);
    response += ",";
    response += "\"cancelled\":";
    response += String(cancelled);

    response += "}";

    server.send(
      200,
      "application/json",
      response
    );

    return;
  }

  sendJsonError(
    400,
    "id or relay is required"
  );
}

// ============================================================
// GET /timers
// ============================================================

void handleTimers() {

  addCORS();

  String response = "{";

  response += "\"ok\":true,";

  response += "\"timers\":[";

  bool first = true;

  int count = 0;

  for (
    int i = 0;
    i < MAX_TIMERS;
    i++
  ) {

    if (!timers[i].active) {
      continue;
    }

    if (!first) {
      response += ",";
    }

    first = false;

    response += timerToJSON(
      timers[i]
    );

    count++;
  }

  response += "],";

  response += "\"count\":";
  response += String(count);

  response += "}";

  server.send(
    200,
    "application/json",
    response
  );
}

// ============================================================
// GET /timer/clear
//
// /timer/clear
//
// /timer/clear?relay=1
//
// Same behavior for:
//
// /timers/clear
// /timers/clear?relay=1
// ============================================================

void handleClearTimers() {

  addCORS();

  int cleared = 0;

  // ----------------------------------------------------------
  // Clear only one relay's timers
  // ----------------------------------------------------------

  if (server.hasArg("relay")) {

    int relay =
      server.arg("relay").toInt();

    if (
      relay != 1 &&
      relay != 2
    ) {

      sendJsonError(
        400,
        "relay must be 1 or 2"
      );

      return;
    }

    for (
      int i = 0;
      i < MAX_TIMERS;
      i++
    ) {

      if (
        timers[i].active &&
        timers[i].relay == relay
      ) {

        timers[i].active = false;

        cleared++;
      }
    }

    String response = "{";

    response += "\"ok\":true,";
    response += "\"relay\":";
    response += String(relay);
    response += ",";
    response += "\"cleared\":";
    response += String(cleared);

    response += "}";

    server.send(
      200,
      "application/json",
      response
    );

    return;
  }

  // ----------------------------------------------------------
  // Clear ALL timers
  // ----------------------------------------------------------

  for (
    int i = 0;
    i < MAX_TIMERS;
    i++
  ) {

    if (timers[i].active) {

      timers[i].active = false;

      cleared++;
    }
  }

  String response = "{";

  response += "\"ok\":true,";
  response += "\"cleared\":";
  response += String(cleared);

  response += "}";

  server.send(
    200,
    "application/json",
    response
  );
}

// ============================================================
// OPTIONS → 204
// ============================================================

void handleOptions() {

  addCORS();

  server.send(
    204,
    "text/plain",
    ""
  );
}

// ============================================================
// NOT FOUND
// ============================================================

void handleNotFound() {

  // Every OPTIONS request gets 204
  if (
    server.method() == HTTP_OPTIONS
  ) {

    handleOptions();

    return;
  }

  addCORS();

  server.send(
    404,
    "application/json",
    "{\"ok\":false,\"error\":\"not found\"}"
  );
}

// ============================================================
// PROCESS TIMERS
//
// Non-blocking.
// Uses millis().
// Uses unsigned subtraction for overflow safety.
// ============================================================

void processTimers() {

  unsigned long now =
    millis();

  for (
    int i = 0;
    i < MAX_TIMERS;
    i++
  ) {

    if (!timers[i].active) {
      continue;
    }

    // --------------------------------------------------------
    // Overflow-safe time comparison
    // --------------------------------------------------------

    if (
      (unsigned long)(
        now - timers[i].startTime
      ) >= timers[i].duration
    ) {

      // ------------------------------------------------------
      // Timer fires
      // ------------------------------------------------------

      setRelay(
        timers[i].relay,
        timers[i].targetState
      );

      // ------------------------------------------------------
      // Repeat timer
      // ------------------------------------------------------

      if (timers[i].repeat) {

        // Re-arm from the previous scheduled time.
        // This prevents normal timer drift.

        timers[i].startTime +=
          timers[i].duration;

        // If loop execution was delayed enough to
        // miss multiple periods, catch the schedule up.

        while (
          (unsigned long)(
            now - timers[i].startTime
          ) >= timers[i].duration
        ) {

          timers[i].startTime +=
            timers[i].duration;
        }

      }

      // ------------------------------------------------------
      // One-shot timer
      // ------------------------------------------------------

      else {

        timers[i].active = false;
      }
    }
  }
}

// ============================================================
// WIFI CONNECTION
// ============================================================

void connectWiFi() {

  Serial.println();
  Serial.println(
    "=============================="
  );

  Serial.println(
    "ESP200 WiFi"
  );

  Serial.println(
    "=============================="
  );

  WiFi.mode(
    WIFI_STA
  );

  WiFi.setAutoReconnect(
    true
  );

  WiFi.persistent(
    true
  );

  // Keep Wi-Fi awake for responsive
  // local network control.

  WiFi.setSleep(
    false
  );

  // ----------------------------------------------------------
  // Static IP
  // ----------------------------------------------------------

  if (
    !WiFi.config(
      local_IP,
      gateway,
      subnet,
      primaryDNS,
      secondaryDNS
    )
  ) {

    Serial.println(
      "Static IP configuration failed"
    );
  }

  Serial.print(
    "Connecting to: "
  );

  Serial.println(
    WIFI_SSID
  );

  WiFi.begin(
    WIFI_SSID,
    WIFI_PASSWORD
  );

  int attempts = 0;

  while (
    WiFi.status() != WL_CONNECTED &&
    attempts < 40
  ) {

    delay(500);

    Serial.print(
      "."
    );

    attempts++;
  }

  Serial.println();

  // ----------------------------------------------------------
  // Connected
  // ----------------------------------------------------------

  if (
    WiFi.status() == WL_CONNECTED
  ) {

    Serial.println(
      "=============================="
    );

    Serial.println(
      "WiFi CONNECTED"
    );

    Serial.println(
      "=============================="
    );

    Serial.print(
      "IP Address: "
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

    Serial.print(
      "RSSI: "
    );

    Serial.println(
      WiFi.RSSI()
    );

    Serial.println(
      "=============================="
    );

  }

  else {

    Serial.println(
      "WiFi connection failed."
    );
  }
}

// ============================================================
// SETUP
// ============================================================

void setup() {

  Serial.begin(
    115200
  );

  delay(
    1000
  );

  // ----------------------------------------------------------
  // Relay pins
  // ----------------------------------------------------------

  pinMode(
    RELAY1_PIN,
    OUTPUT
  );

  pinMode(
    RELAY2_PIN,
    OUTPUT
  );

  // Start both relays OFF

  digitalWrite(
    RELAY1_PIN,
    RELAY_OFF
  );

  digitalWrite(
    RELAY2_PIN,
    RELAY_OFF
  );

  relay1State = false;
  relay2State = false;

  // ----------------------------------------------------------
  // Initialize timer table
  // ----------------------------------------------------------

  for (
    int i = 0;
    i < MAX_TIMERS;
    i++
  ) {

    timers[i].active = false;
    timers[i].id = 0;
  }

  nextTimerId = 1;

  // ----------------------------------------------------------
  // Connect Wi-Fi
  // ----------------------------------------------------------

  connectWiFi();

  // ==========================================================
  // HTTP ROUTES
  // ==========================================================

  // ----------------------------------------------------------
  // Existing relay API
  // ----------------------------------------------------------

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

  // ----------------------------------------------------------
  // Timer API v2
  // ----------------------------------------------------------

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
    handleClearTimers
  );

  server.on(
    "/timers/clear",
    HTTP_GET,
    handleClearTimers
  );

  // ----------------------------------------------------------
  // Root
  // ----------------------------------------------------------

  server.on(
    "/",
    HTTP_GET,
    handleStatus
  );

  // ==========================================================
  // OPTIONS / CORS
  // ==========================================================

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

  // ----------------------------------------------------------
  // Start HTTP server
  // ----------------------------------------------------------

  server.begin();

  Serial.println(
    "HTTP server started"
  );

  Serial.print(
    "ESP200 IP: "
  );

  Serial.println(
    WiFi.localIP()
  );

  Serial.println(
    "Timer API: 2"
  );
}

// ============================================================
// LOOP
// ============================================================

void loop() {

  // Process HTTP requests
  server.handleClient();

  // Process timers without blocking
  processTimers();

  // ----------------------------------------------------------
  // Automatic Wi-Fi reconnect
  // ----------------------------------------------------------

  if (
    WiFi.status() != WL_CONNECTED
  ) {

    static unsigned long lastReconnect = 0;

    if (
      millis() - lastReconnect > 5000
    ) {

      lastReconnect =
        millis();

      Serial.println(
        "WiFi disconnected. Reconnecting..."
      );

      WiFi.disconnect();

      WiFi.begin(
        WIFI_SSID,
        WIFI_PASSWORD
      );
    }
  }
}
