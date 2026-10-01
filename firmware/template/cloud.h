// ============================================================
// CLOUD CONTROL (Supabase)
// ============================================================
//
// The board keeps one connection open to Supabase Realtime and is told the
// moment the app changes its row in `boards`. Nothing has to reach the
// board's IP, so the app works from any network.
//
//   app tap      -> row.desired {"1":"on"} -> this board switches the relay
//   app timer    -> row.commands [{seq, op, ...}] -> this board runs each once
//                   and lists the result in reported.acks
//   relay change -> this board writes row.reported (its /status JSON)
//   every 60 s   -> check-in (row.last_seen), so the app knows it's online
//
// All internet work runs in its own task on the other CPU core, so a slow or
// stuck connection never freezes the web server, timers or relays. The two
// sides only exchange small messages under a lock:
//   cloud task -> main loop : relays to switch, timer commands to run
//   main loop  -> cloud task: a fresh /status snapshot to report
//
// Relays restore their last state after a power cut (saved in flash), then
// follow the app once the board is back online.
//
// The sketch provides, before including this file:
//   #define CLOUD_RELAYS <n>
//   void setRelay(uint8_t relay, bool on)   (calls cloudRelayChanged)
//   bool getRelayState(uint8_t relay)
//   String getStatusJSON()                  (includes cloudAcksJSON() as "acks")
//   uint32_t cloudTimerSignature()          (changes when timers change)
//   uint32_t createTimer(relay, actionOn, seconds, repeat, &error)  (0 = failed)
//   bool cancelTimerById(uint32_t id)
//   int cancelTimersOnRelay(uint8_t relay)
// and board_config.h: SUPABASE_HOST, SUPABASE_KEY, BOARD_ID, BOARD_EMAIL,
// BOARD_PASSWORD (the app writes them: Settings -> Boards -> Download code).
//
// Libraries: WebSockets (Markus Sattler) 2.7+, ArduinoJson 7+.

#pragma once

#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <time.h>

void setRelay(uint8_t relay, bool on);
bool getRelayState(uint8_t relay);
String getStatusJSON();
uint32_t cloudTimerSignature();
uint32_t createTimer(uint8_t relay, bool actionOn, uint32_t seconds, bool repeat, const char** error);
bool cancelTimerById(uint32_t id);
int cancelTimersOnRelay(uint8_t relay);

// Certificates the board trusts for Supabase (its chain is Google Trust
// Services today; the others are there in case it changes).
static const char CLOUD_ROOT_CA[] =
  // GTS Root R1 (valid until 22 Jun 2036)
  R"PEM(-----BEGIN CERTIFICATE-----
MIIFWjCCA0KgAwIBAgIQbkepxUtHDA3sM9CJuRz04TANBgkqhkiG9w0BAQwFADBH
MQswCQYDVQQGEwJVUzEiMCAGA1UEChMZR29vZ2xlIFRydXN0IFNlcnZpY2VzIExM
QzEUMBIGA1UEAxMLR1RTIFJvb3QgUjEwHhcNMTYwNjIyMDAwMDAwWhcNMzYwNjIy
MDAwMDAwWjBHMQswCQYDVQQGEwJVUzEiMCAGA1UEChMZR29vZ2xlIFRydXN0IFNl
cnZpY2VzIExMQzEUMBIGA1UEAxMLR1RTIFJvb3QgUjEwggIiMA0GCSqGSIb3DQEB
AQUAA4ICDwAwggIKAoICAQC2EQKLHuOhd5s73L+UPreVp0A8of2C+X0yBoJx9vaM
f/vo27xqLpeXo4xL+Sv2sfnOhB2x+cWX3u+58qPpvBKJXqeqUqv4IyfLpLGcY9vX
mX7wCl7raKb0xlpHDU0QM+NOsROjyBhsS+z8CZDfnWQpJSMHobTSPS5g4M/SCYe7
zUjwTcLCeoiKu7rPWRnWr4+wB7CeMfGCwcDfLqZtbBkOtdh+JhpFAz2weaSUKK0P
fyblqAj+lug8aJRT7oM6iCsVlgmy4HqMLnXWnOunVmSPlk9orj2XwoSPwLxAwAtc
vfaHszVsrBhQf4TgTM2S0yDpM7xSma8ytSmzJSq0SPly4cpk9+aCEI3oncKKiPo4
Zor8Y/kB+Xj9e1x3+naH+uzfsQ55lVe0vSbv1gHR6xYKu44LtcXFilWr06zqkUsp
zBmkMiVOKvFlRNACzqrOSbTqn3yDsEB750Orp2yjj32JgfpMpf/VjsPOS+C12LOO
Rc92wO1AK/1TD7Cn1TsNsYqiA94xrcx36m97PtbfkSIS5r762DL8EGMUUXLeXdYW
k70paDPvOmbsB4om3xPXV2V4J95eSRQAogB/mqghtqmxlbCluQ0WEdrHbEg8QOB+
DVrNVjzRlwW5y0vtOUucxD/SVRNuJLDWcfr0wbrM7Rv1/oFB2ACYPTrIrnqYNxgF
lQIDAQABo0IwQDAOBgNVHQ8BAf8EBAMCAQYwDwYDVR0TAQH/BAUwAwEB/zAdBgNV
HQ4EFgQU5K8rJnEaK0gnhS9SZizv8IkTcT4wDQYJKoZIhvcNAQEMBQADggIBADiW
Cu49tJYeX++dnAsznyvgyv3SjgofQXSlfKqE1OXyHuY3UjKcC9FhHb8owbZEKTV1
d5iyfNm9dKyKaOOpMQkpAWBz40d8U6iQSifvS9efk+eCNs6aaAyC58/UEBZvXw6Z
XPYfcX3v73svfuo21pdwCxXu11xWajOl40k4DLh9+42FpLFZXvRq4d2h9mREruZR
gyFmxhE+885H7pwoHyXa/6xmld01D1zvICxi/ZG6qcz8WpyTgYMpl0p8WnK0OdC3
d8t5/Wk6kjftbjhlRn7pYL15iJdfOBL07q9bgsiG1eGZbYwE8na6SfZu6W0eX6Dv
J4J2QPim01hcDyxC2kLGe4g0x8HYRZvBPsVhHdljUEn2NIVq4BjFbkerQUIpm/Zg
DdIx02OYI5NaAIFItO/Nis3Jz5nu2Z6qNuFoS3FJFDYoOj0dzpqPJeaAcWErtXvM
+SUWgeExX6GjfhaknBZqlxi9dnKlC54dNuYvoS++cJEPqOba+MSSQGwlfnuzCdyy
F62ARPBopY+Udf90WuioAnwMCeKpSwughQtiue+hMZL77/ZRBIls6Kl0obsXs7X9
SQ98POyDGCBDTtWTurQ0sR8WNh8M5mQ5Fkzc4P4dyKliPUDqysU0ArSuiYgzNdws
E3PYJ/HQcu51OyLemGhmW/HGY0dVHLqlCFF1pkgl
-----END CERTIFICATE-----
)PEM"
  // GTS Root R4 (valid until 22 Jun 2036)
  R"PEM(-----BEGIN CERTIFICATE-----
MIICCjCCAZGgAwIBAgIQbkepyIuUtui7OyrYorLBmTAKBggqhkjOPQQDAzBHMQsw
CQYDVQQGEwJVUzEiMCAGA1UEChMZR29vZ2xlIFRydXN0IFNlcnZpY2VzIExMQzEU
MBIGA1UEAxMLR1RTIFJvb3QgUjQwHhcNMTYwNjIyMDAwMDAwWhcNMzYwNjIyMDAw
MDAwWjBHMQswCQYDVQQGEwJVUzEiMCAGA1UEChMZR29vZ2xlIFRydXN0IFNlcnZp
Y2VzIExMQzEUMBIGA1UEAxMLR1RTIFJvb3QgUjQwdjAQBgcqhkjOPQIBBgUrgQQA
IgNiAATzdHOnaItgrkO4NcWBMHtLSZ37wWHO5t5GvWvVYRg1rkDdc/eJkTBa6zzu
hXyiQHY7qca4R9gq55KRanPpsXI5nymfopjTX15YhmUPoYRlBtHci8nHc8iMai/l
xKvRHYqjQjBAMA4GA1UdDwEB/wQEAwIBBjAPBgNVHRMBAf8EBTADAQH/MB0GA1Ud
DgQWBBSATNbrdP9JNqPV2Py1PsVq8JQdjDAKBggqhkjOPQQDAwNnADBkAjBqUFJ0
CMRw3J5QdCHojXohw0+WbhXRIjVhLfoIN+4Zba3bssx9BzT1YBkstTTZbyACMANx
sbqjYAuG7ZoIapVon+Kz4ZNkfF6Tpt95LY2F45TPI11xzPKwTdb+mciUqXWi4w==
-----END CERTIFICATE-----
)PEM"
  // ISRG Root X1 (valid until 4 Jun 2035)
  R"PEM(-----BEGIN CERTIFICATE-----
MIIFazCCA1OgAwIBAgIRAIIQz7DSQONZRGPgu2OCiwAwDQYJKoZIhvcNAQELBQAw
TzELMAkGA1UEBhMCVVMxKTAnBgNVBAoTIEludGVybmV0IFNlY3VyaXR5IFJlc2Vh
cmNoIEdyb3VwMRUwEwYDVQQDEwxJU1JHIFJvb3QgWDEwHhcNMTUwNjA0MTEwNDM4
WhcNMzUwNjA0MTEwNDM4WjBPMQswCQYDVQQGEwJVUzEpMCcGA1UEChMgSW50ZXJu
ZXQgU2VjdXJpdHkgUmVzZWFyY2ggR3JvdXAxFTATBgNVBAMTDElTUkcgUm9vdCBY
MTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBAK3oJHP0FDfzm54rVygc
h77ct984kIxuPOZXoHj3dcKi/vVqbvYATyjb3miGbESTtrFj/RQSa78f0uoxmyF+
0TM8ukj13Xnfs7j/EvEhmkvBioZxaUpmZmyPfjxwv60pIgbz5MDmgK7iS4+3mX6U
A5/TR5d8mUgjU+g4rk8Kb4Mu0UlXjIB0ttov0DiNewNwIRt18jA8+o+u3dpjq+sW
T8KOEUt+zwvo/7V3LvSye0rgTBIlDHCNAymg4VMk7BPZ7hm/ELNKjD+Jo2FR3qyH
B5T0Y3HsLuJvW5iB4YlcNHlsdu87kGJ55tukmi8mxdAQ4Q7e2RCOFvu396j3x+UC
B5iPNgiV5+I3lg02dZ77DnKxHZu8A/lJBdiB3QW0KtZB6awBdpUKD9jf1b0SHzUv
KBds0pjBqAlkd25HN7rOrFleaJ1/ctaJxQZBKT5ZPt0m9STJEadao0xAH0ahmbWn
OlFuhjuefXKnEgV4We0+UXgVCwOPjdAvBbI+e0ocS3MFEvzG6uBQE3xDk3SzynTn
jh8BCNAw1FtxNrQHusEwMFxIt4I7mKZ9YIqioymCzLq9gwQbooMDQaHWBfEbwrbw
qHyGO0aoSCqI3Haadr8faqU9GY/rOPNk3sgrDQoo//fb4hVC1CLQJ13hef4Y53CI
rU7m2Ys6xt0nUW7/vGT1M0NPAgMBAAGjQjBAMA4GA1UdDwEB/wQEAwIBBjAPBgNV
HRMBAf8EBTADAQH/MB0GA1UdDgQWBBR5tFnme7bl5AFzgAiIyBpY9umbbjANBgkq
hkiG9w0BAQsFAAOCAgEAVR9YqbyyqFDQDLHYGmkgJykIrGF1XIpu+ILlaS/V9lZL
ubhzEFnTIZd+50xx+7LSYK05qAvqFyFWhfFQDlnrzuBZ6brJFe+GnY+EgPbk6ZGQ
3BebYhtF8GaV0nxvwuo77x/Py9auJ/GpsMiu/X1+mvoiBOv/2X/qkSsisRcOj/KK
NFtY2PwByVS5uCbMiogziUwthDyC3+6WVwW6LLv3xLfHTjuCvjHIInNzktHCgKQ5
ORAzI4JMPJ+GslWYHb4phowim57iaztXOoJwTdwJx4nLCgdNbOhdjsnvzqvHu7Ur
TkXWStAmzOVyyghqpZXjFaH3pO3JLF+l+/+sKAIuvtd7u+Nxe5AW0wdeRlN8NwdC
jNPElpzVmbUq4JUagEiuTDkHzsxHpFKVK7q4+63SM1N95R1NbdWhscdCb+ZAJzVc
oyi3B43njTOQ5yOf+1CceWxG1bQVs5ZufpsMljq4Ui0/1lvh+wjChP4kqKOJ2qxq
4RgqsahDYVvTH9w7jXbyLeiNdd8XM2w9U/t7y0Ff/9yi0GE44Za4rF2LN9d11TPA
mRGunUHBcnWEvgJBQl9nJEiU0Zsnvgc/ubhPgXRR4Xq37Z0j4r7g1SgEEzwxA57d
emyPxgcYxn/eR44/KJ4EBs+lVDR3veyJm+kXQ99b21/+jh5Xos1AnX5iItreGCc=
-----END CERTIFICATE-----
)PEM"
  // GlobalSign Root CA (valid until 28 Jan 2028)
  R"PEM(-----BEGIN CERTIFICATE-----
MIIDdTCCAl2gAwIBAgILBAAAAAABFUtaw5QwDQYJKoZIhvcNAQEFBQAwVzELMAkG
A1UEBhMCQkUxGTAXBgNVBAoTEEdsb2JhbFNpZ24gbnYtc2ExEDAOBgNVBAsTB1Jv
b3QgQ0ExGzAZBgNVBAMTEkdsb2JhbFNpZ24gUm9vdCBDQTAeFw05ODA5MDExMjAw
MDBaFw0yODAxMjgxMjAwMDBaMFcxCzAJBgNVBAYTAkJFMRkwFwYDVQQKExBHbG9i
YWxTaWduIG52LXNhMRAwDgYDVQQLEwdSb290IENBMRswGQYDVQQDExJHbG9iYWxT
aWduIFJvb3QgQ0EwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQDaDuaZ
jc6j40+Kfvvxi4Mla+pIH/EqsLmVEQS98GPR4mdmzxzdzxtIK+6NiY6arymAZavp
xy0Sy6scTHAHoT0KMM0VjU/43dSMUBUc71DuxC73/OlS8pF94G3VNTCOXkNz8kHp
1Wrjsok6Vjk4bwY8iGlbKk3Fp1S4bInMm/k8yuX9ifUSPJJ4ltbcdG6TRGHRjcdG
snUOhugZitVtbNV4FpWi6cgKOOvyJBNPc1STE4U6G7weNLWLBYy5d4ux2x8gkasJ
U26Qzns3dLlwR5EiUWMWea6xrkEmCMgZK9FGqkjWZCrXgzT/LCrBbBlDSgeF59N8
9iFo7+ryUp9/k5DPAgMBAAGjQjBAMA4GA1UdDwEB/wQEAwIBBjAPBgNVHRMBAf8E
BTADAQH/MB0GA1UdDgQWBBRge2YaRQ2XyolQL30EzTSo//z9SzANBgkqhkiG9w0B
AQUFAAOCAQEA1nPnfE920I2/7LqivjTFKDK1fPxsnCwrvQmeU79rXqoRSLblCKOz
yj1hTdNGCbM+w6DjY1Ub8rrvrTnhQ7k4o+YviiY776BQVvnGCv04zcQLcFGUl5gE
38NflNUVyRRBnMRddWQVDf9VMOyGj/8N7yy5Y0b2qvzfvGn9LhJIZJrglfCm7ymP
AbEVtQwdpf5pLGkkeB6zpxxxYu7KyJesF12KwvhHhm4qxFYxldBniYUr+WymXUad
DKqC5JlR3XC321Y9YeRq4VzW9v493kHMB65jUr9TU/Qr6cf9tveCX4XSQRjbgbME
HMUfpIBvFSDJ3gyICh3WZlXi/EjJKSZp4A==
-----END CERTIFICATE-----
)PEM";

#define CLOUD_TABLE "boards"

const unsigned long CLOUD_CHECKIN_MS = 60000;      // check-in / full report
const unsigned long CLOUD_HEARTBEAT_MS = 25000;    // Realtime needs one < 60 s
const unsigned long CLOUD_RETRY_MS = 15000;
const unsigned long CLOUD_TOKEN_MARGIN_MS = 300000; // refresh 5 min early
const unsigned long CLOUD_SNAPSHOT_MS = 10000;     // main loop refreshes /status for the task
const unsigned long CLOUD_COMMAND_MAX_AGE_S = 300; // ignore older commands
const uint16_t CLOUD_TLS_HANDSHAKE_S = 10;

// Shown in /status as "cloud". Always points at a fixed text, so either
// side can read it safely.
const char* volatile cloudState = "starting";

Preferences cloudPrefs;
SemaphoreHandle_t cloudLock = nullptr;


// ------------------------------------------------------------
// SHARED BETWEEN THE TWO SIDES (only touched while holding cloudLock)
// ------------------------------------------------------------

// Cloud task -> main loop.
int8_t cloudWant[CLOUD_RELAYS + 1];   // -1 nothing, 0 off, 1 on

struct CloudCommand {
  uint32_t seq;
  char op[13];
  uint8_t relay;
  bool actionOn;
  bool actionValid;
  uint32_t seconds;
  bool repeat;
  uint32_t id;
  bool expired;
};

#define CLOUD_QUEUE 10
CloudCommand cloudQueue[CLOUD_QUEUE];
int cloudQueueCount = 0;

// Main loop -> cloud task.
String cloudSnapStatus;
String cloudSnapDesired;      // {"1":"on"} when a local change must reach the app
bool cloudSnapHasDesired = false;
uint32_t cloudSnapVersion = 0;
bool cloudSnapUrgent = false; // something changed: report now, not at the next check-in


// ------------------------------------------------------------
// MAIN LOOP SIDE
// ------------------------------------------------------------

bool cloudApplying = false;   // switching because the app asked
bool cloudRestoring = false;  // switching back after a power cut
bool cloudReportDue = true;
bool cloudDesiredDue = false; // a local change the app hasn't heard about
unsigned long cloudLastSnapshot = 0;
uint32_t cloudLastTimerSig = 0;

struct CloudAck {
  uint32_t seq;
  bool ok;
  uint32_t id;
  const char* error;
};

#define CLOUD_ACKS 5
CloudAck cloudAcks[CLOUD_ACKS];
int cloudAckCount = 0;

// Called by setRelay whenever a relay actually changes.
void cloudRelayChanged(uint8_t relay, bool on) {

  if (!cloudRestoring) {
    String key = "r" + String(relay);
    cloudPrefs.putBool(key.c_str(), on);
  }

  cloudReportDue = true;

  // Wall switch, timer or direct /on: the app's "desired" must follow too,
  // or it would switch the relay back.
  if (!cloudApplying && !cloudRestoring) {
    cloudDesiredDue = true;
  }
}

String cloudAcksJSON() {

  String json = "[";

  for (int i = 0; i < cloudAckCount; i++) {
    const CloudAck &a = cloudAcks[i];
    if (i > 0) json += ",";
    json += "{\"seq\":" + String(a.seq) + ",\"ok\":" + (a.ok ? "true" : "false");
    if (a.ok) json += ",\"id\":" + String(a.id);
    else json += ",\"error\":\"" + String(a.error) + "\"";
    json += "}";
  }

  return json + "]";
}

void cloudAddAck(uint32_t seq, bool ok, uint32_t id, const char* error) {

  if (cloudAckCount == CLOUD_ACKS) {
    for (int i = 1; i < CLOUD_ACKS; i++) cloudAcks[i - 1] = cloudAcks[i];
    cloudAckCount--;
  }

  cloudAcks[cloudAckCount++] = { seq, ok, id, error };
  cloudReportDue = true;
}

void cloudRunCommand(const CloudCommand &c) {

  if (c.expired) {
    cloudAddAck(c.seq, false, 0, "expired");
    return;
  }

  if (strcmp(c.op, "timer") == 0) {

    const char* error = "invalid";
    uint32_t id = c.actionValid ? createTimer(c.relay, c.actionOn, c.seconds, c.repeat, &error) : 0;
    Serial.printf("[cloud] app: timer relay %u %s in %lus -> %s\n",
      c.relay, c.actionOn ? "on" : "off", (unsigned long)c.seconds, id ? "ok" : error);
    cloudAddAck(c.seq, id != 0, id, error);

  } else if (strcmp(c.op, "cancel") == 0) {

    bool found = cancelTimerById(c.id);
    Serial.printf("[cloud] app: cancel timer %lu -> %s\n", (unsigned long)c.id, found ? "ok" : "not found");
    cloudAddAck(c.seq, found, c.id, "not_found");

  } else if (strcmp(c.op, "cancel_relay") == 0) {

    int n = cancelTimersOnRelay(c.relay);
    Serial.printf("[cloud] app: cancel timers on relay %u -> %d\n", c.relay, n);
    cloudAddAck(c.seq, n >= 0, n < 0 ? 0 : n, "invalid");

  } else {

    cloudAddAck(c.seq, false, 0, "invalid");
  }
}


// ------------------------------------------------------------
// CLOUD TASK SIDE
// ------------------------------------------------------------

WebSocketsClient cloudWs;

String cloudAccessToken;
String cloudRefreshToken;
unsigned long cloudTokenAt = 0;
unsigned long cloudTokenLifeMs = 0;
unsigned long cloudNextSignInAt = 0;

bool cloudWsStarted = false;
bool cloudJoined = false;
unsigned long cloudLastJoin = 0;
unsigned long cloudLastHeartbeat = 0;
uint32_t cloudRef = 1;
uint32_t cloudJoinRef = 0;

bool cloudFetchDue = false;
unsigned long cloudNextFetchAt = 0;
unsigned long cloudLastReport = 0;
unsigned long cloudNextReportTry = 0;
uint32_t cloudSentVersion = 0;

bool cloudTimeReady = false;
unsigned long cloudTimeWaitStart = 0;

// Timer commands: the last one taken (saved in flash, so a restart doesn't
// run old ones again).
uint32_t cloudLastSeq = 0;
bool cloudSeqKnown = false;

// What the app wants for the relays -> main loop.
void cloudQueueDesired(JsonObjectConst desired) {

  xSemaphoreTake(cloudLock, portMAX_DELAY);

  for (uint8_t r = 1; r <= CLOUD_RELAYS; r++) {
    const char* power = desired[String(r)] | "";
    if (strcmp(power, "on") == 0) cloudWant[r] = 1;
    else if (strcmp(power, "off") == 0) cloudWant[r] = 0;
  }

  xSemaphoreGive(cloudLock);
}

// New timer commands -> main loop, each once.
void cloudQueueCommands(JsonArrayConst commands) {

  if (commands.isNull()) return;

  // First time (freshly flashed): don't replay what's already there.
  if (!cloudSeqKnown) {
    for (JsonObjectConst c : commands) {
      uint32_t seq = c["seq"] | 0UL;
      if (seq > cloudLastSeq) cloudLastSeq = seq;
    }
    cloudSeqKnown = true;
    cloudPrefs.putUInt("seq", cloudLastSeq);
    return;
  }

  time_t now = time(nullptr);

  for (JsonObjectConst c : commands) {

    uint32_t seq = c["seq"] | 0UL;
    if (seq <= cloudLastSeq) continue;

    CloudCommand cmd = {};
    cmd.seq = seq;
    strlcpy(cmd.op, c["op"] | "", sizeof(cmd.op));
    cmd.relay = c["relay"] | 0;
    const char* action = c["action"] | "";
    cmd.actionValid = strcmp(action, "on") == 0 || strcmp(action, "off") == 0;
    cmd.actionOn = strcmp(action, "on") == 0;
    cmd.seconds = c["seconds"] | 0UL;
    cmd.repeat = c["repeat"] | false;
    cmd.id = c["id"] | 0UL;

    // Too old: the app has already told the user it failed.
    long at = c["at"] | 0L;
    cmd.expired = now > 1700000000 && at > 0 && now - at > (long)CLOUD_COMMAND_MAX_AGE_S;

    xSemaphoreTake(cloudLock, portMAX_DELAY);
    bool queued = cloudQueueCount < CLOUD_QUEUE;
    if (queued) cloudQueue[cloudQueueCount++] = cmd;
    xSemaphoreGive(cloudLock);

    if (!queued) break;  // full: the rest is picked up on the next change or read

    cloudLastSeq = seq;
    cloudPrefs.putUInt("seq", seq);
  }
}

int cloudHttp(const char* method, const String& path, const String& body, String* response, bool withToken) {

  WiFiClientSecure client;
  client.setCACert(CLOUD_ROOT_CA);
  client.setHandshakeTimeout(CLOUD_TLS_HANDSHAKE_S);

  HTTPClient http;
  http.setConnectTimeout(8000);
  http.setTimeout(8000);

  if (!http.begin(client, String("https://") + SUPABASE_HOST + path)) {
    return -1;
  }

  http.addHeader("apikey", SUPABASE_KEY);
  http.addHeader("Content-Type", "application/json");

  if (withToken) {
    http.addHeader("Authorization", "Bearer " + cloudAccessToken);
  }

  if (strcmp(method, "PATCH") == 0) {
    http.addHeader("Prefer", "return=minimal");
  }

  int code = http.sendRequest(method, body);

  if (response) {
    *response = code > 0 ? http.getString() : "";
  }

  http.end();
  return code;
}

String cloudTopic() {
  return String("realtime:board-") + BOARD_ID;
}

void cloudSendAccessToken() {

  JsonDocument doc;
  doc["topic"] = cloudTopic();
  doc["event"] = "access_token";
  doc["payload"]["access_token"] = cloudAccessToken;
  doc["ref"] = String(cloudRef++);
  doc["join_ref"] = String(cloudJoinRef);

  String out;
  serializeJson(doc, out);
  cloudWs.sendTXT(out);
}

bool cloudSignIn() {

  bool refresh = cloudRefreshToken.length() > 0;

  JsonDocument req;

  if (refresh) {
    req["refresh_token"] = cloudRefreshToken;
  } else {
    req["email"] = BOARD_EMAIL;
    req["password"] = BOARD_PASSWORD;
  }

  String body;
  serializeJson(req, body);

  String resp;
  int code = cloudHttp(
    "POST",
    refresh ? "/auth/v1/token?grant_type=refresh_token" : "/auth/v1/token?grant_type=password",
    body,
    &resp,
    false
  );

  if (code != 200) {
    Serial.printf("[cloud] sign-in failed (%d)\n", code);
    // A dead refresh token: sign in with the password next time.
    if (refresh) cloudRefreshToken = "";
    return false;
  }

  JsonDocument filter;
  filter["access_token"] = true;
  filter["refresh_token"] = true;
  filter["expires_in"] = true;

  JsonDocument doc;
  if (deserializeJson(doc, resp, DeserializationOption::Filter(filter))) {
    return false;
  }

  cloudAccessToken = doc["access_token"].as<String>();
  cloudRefreshToken = doc["refresh_token"].as<String>();
  cloudTokenLifeMs = (unsigned long)(doc["expires_in"] | 3600) * 1000UL;
  cloudTokenAt = millis();

  Serial.println(refresh ? "[cloud] token refreshed" : "[cloud] signed in");

  if (cloudJoined) {
    cloudSendAccessToken();
  }

  return true;
}

// Reads what the app wants (anything missed while offline).
void cloudFetchDesired() {

  String resp;
  int code = cloudHttp(
    "GET",
    String("/rest/v1/" CLOUD_TABLE "?select=desired,commands&board_id=eq.") + BOARD_ID,
    "",
    &resp,
    true
  );

  if (code == 401) {
    cloudAccessToken = "";
  }

  if (code != 200) {
    Serial.printf("[cloud] read failed (%d)\n", code);
    cloudNextFetchAt = millis() + CLOUD_RETRY_MS;
    return;
  }

  JsonDocument doc;
  if (!deserializeJson(doc, resp)) {

    if (doc.as<JsonArrayConst>().size() == 0) {
      Serial.println("[cloud] no row for this board (not linked?)");
    } else {
      // A local change made while offline wins; the next report sends it.
      xSemaphoreTake(cloudLock, portMAX_DELAY);
      bool localPending = cloudSnapHasDesired;
      xSemaphoreGive(cloudLock);

      JsonObjectConst desired = doc[0]["desired"];
      if (!desired.isNull() && !localPending) cloudQueueDesired(desired);
      cloudQueueCommands(doc[0]["commands"]);
    }
  }

  cloudFetchDue = false;
}

// Writes the main loop's latest /status to the board's row. Doubles as the
// check-in.
bool cloudReport() {

  xSemaphoreTake(cloudLock, portMAX_DELAY);
  String status = cloudSnapStatus;
  bool withDesired = cloudSnapHasDesired;
  String desired = cloudSnapDesired;
  uint32_t version = cloudSnapVersion;
  xSemaphoreGive(cloudLock);

  if (status.length() == 0) {
    return false;  // main loop hasn't made one yet
  }

  String body = "{\"reported\":" + status;
  body += ",\"ip\":\"" + WiFi.localIP().toString() + "\"";
  body += ",\"rssi\":" + String(WiFi.RSSI());

  JsonDocument ssid;
  ssid.set(WiFi.SSID());
  String ssidJson;
  serializeJson(ssid, ssidJson);
  body += ",\"ssid\":" + ssidJson;

  if (withDesired) {
    body += ",\"desired\":" + desired;
  }

  body += "}";

  int code = cloudHttp(
    "PATCH",
    String("/rest/v1/" CLOUD_TABLE "?board_id=eq.") + BOARD_ID,
    body,
    nullptr,
    true
  );

  if (code == 401) {
    cloudAccessToken = "";
  }

  if (code < 200 || code >= 300) {
    Serial.printf("[cloud] report failed (%d)\n", code);
    return false;
  }

  xSemaphoreTake(cloudLock, portMAX_DELAY);
  if (cloudSnapVersion == version) {
    cloudSnapUrgent = false;
    if (withDesired) cloudSnapHasDesired = false;
  }
  xSemaphoreGive(cloudLock);

  cloudSentVersion = version;
  cloudLastReport = millis();
  return true;
}

void cloudJoin() {

  cloudLastJoin = millis();
  cloudJoinRef = cloudRef++;

  JsonDocument doc;
  doc["topic"] = cloudTopic();
  doc["event"] = "phx_join";
  doc["ref"] = String(cloudJoinRef);
  doc["join_ref"] = String(cloudJoinRef);

  JsonObject config = doc["payload"]["config"].to<JsonObject>();
  config["broadcast"]["self"] = false;
  config["presence"]["key"] = "";
  config["private"] = false;

  JsonObject change = config["postgres_changes"].to<JsonArray>().add<JsonObject>();
  change["event"] = "UPDATE";
  change["schema"] = "public";
  change["table"] = CLOUD_TABLE;
  change["filter"] = String("board_id=eq.") + BOARD_ID;

  doc["payload"]["access_token"] = cloudAccessToken;

  String out;
  serializeJson(doc, out);
  cloudWs.sendTXT(out);
}

void cloudOnMessage(const uint8_t* payload, size_t length) {

  JsonDocument filter;
  filter["topic"] = true;
  filter["event"] = true;
  filter["ref"] = true;
  filter["payload"]["status"] = true;
  filter["payload"]["message"] = true;
  filter["payload"]["response"]["reason"] = true;
  filter["payload"]["data"]["record"]["desired"] = true;
  filter["payload"]["data"]["record"]["commands"] = true;

  JsonDocument doc;
  if (deserializeJson(doc, (const char*)payload, length, DeserializationOption::Filter(filter))) {
    return;
  }

  // Heartbeat replies come on topic "phoenix".
  if (cloudTopic() != (doc["topic"] | "")) {
    return;
  }

  const char* event = doc["event"] | "";
  const char* status = doc["payload"]["status"] | "";

  if (strcmp(event, "phx_reply") == 0) {

    if (String(cloudJoinRef) != (doc["ref"] | "")) {
      return;
    }

    if (strcmp(status, "ok") == 0) {
      if (!cloudJoined) Serial.println("[cloud] listening for the app");
      cloudJoined = true;
      cloudState = "online";
      cloudFetchDue = true;
    } else {
      Serial.printf("[cloud] join refused: %s\n", (const char*)(doc["payload"]["response"]["reason"] | "?"));
      cloudJoined = false;
      cloudState = "join refused";
    }

  } else if (strcmp(event, "postgres_changes") == 0) {

    JsonObjectConst desired = doc["payload"]["data"]["record"]["desired"];
    if (!desired.isNull()) cloudQueueDesired(desired);
    cloudQueueCommands(doc["payload"]["data"]["record"]["commands"]);

  } else if (strcmp(event, "system") == 0) {

    if (strcmp(status, "ok") == 0) {
      // "Subscribed to PostgreSQL": changes from here on arrive live; read
      // once more for any made while the subscription was starting.
      cloudFetchDue = true;
    } else {
      Serial.printf("[cloud] realtime: %s\n", (const char*)(doc["payload"]["message"] | "?"));
      cloudJoined = false;
      cloudState = "realtime error";
    }

  } else if (strcmp(event, "phx_error") == 0 || strcmp(event, "phx_close") == 0) {

    // Re-joining makes Supabase close the previous copy of the channel
    // (its ref is the old join's). Only our current channel matters.
    if (String(cloudJoinRef) != (doc["ref"] | "")) {
      return;
    }

    Serial.printf("[cloud] channel %s, rejoining\n", event);
    cloudJoined = false;
    cloudState = "rejoining";
  }
}

void cloudWsEvent(WStype_t type, uint8_t* payload, size_t length) {

  switch (type) {

    case WStype_CONNECTED:
      Serial.println("[cloud] connected to Supabase");
      cloudJoined = false;
      cloudLastHeartbeat = millis();
      if (cloudAccessToken.length()) cloudJoin();
      break;

    case WStype_DISCONNECTED:
      if (cloudJoined) Serial.println("[cloud] disconnected");
      cloudJoined = false;
      cloudState = "offline";
      break;

    case WStype_TEXT:
      cloudOnMessage(payload, length);
      break;

    default:
      break;
  }
}

void cloudSendHeartbeat() {

  String out = "{\"topic\":\"phoenix\",\"event\":\"heartbeat\",\"payload\":{},\"ref\":\"";
  out += String(cloudRef++);
  out += "\"}";
  cloudWs.sendTXT(out);
}

// One pass of the cloud task.
void cloudTaskStep() {

  if (WiFi.status() != WL_CONNECTED) {
    cloudState = "no wifi";
    return;
  }

  unsigned long now = millis();

  // Wait (up to 20 s) for the clock, then go ahead anyway.
  if (!cloudTimeReady) {
    if (cloudTimeWaitStart == 0) cloudTimeWaitStart = now;
    if (time(nullptr) < 1700000000 && now - cloudTimeWaitStart < 20000) return;
    cloudTimeReady = true;
  }

  bool tokenDue =
    cloudAccessToken.length() == 0 ||
    now - cloudTokenAt + CLOUD_TOKEN_MARGIN_MS > cloudTokenLifeMs;

  if (tokenDue && (long)(now - cloudNextSignInAt) >= 0) {
    if (!cloudSignIn()) {
      cloudNextSignInAt = millis() + CLOUD_RETRY_MS;
      if (cloudAccessToken.length() == 0) cloudState = "sign-in failed";
    }
  }

  if (cloudAccessToken.length() == 0) {
    return;
  }

  if (!cloudWsStarted) {
    String path = String("/realtime/v1/websocket?apikey=") + SUPABASE_KEY + "&vsn=1.0.0";
    cloudWs.beginSslWithCA(SUPABASE_HOST, 443, path.c_str(), CLOUD_ROOT_CA, "");
    cloudWsStarted = true;
  }

  cloudWs.loop();
  now = millis();

  if (cloudWs.isConnected()) {

    if (now - cloudLastHeartbeat >= CLOUD_HEARTBEAT_MS) {
      cloudLastHeartbeat = now;
      cloudSendHeartbeat();
    }

    if (!cloudJoined && now - cloudLastJoin >= CLOUD_RETRY_MS) {
      cloudJoin();
    }
  }

  // After (re)joining, catch up on anything the app changed meanwhile.
  if (cloudFetchDue && (long)(now - cloudNextFetchAt) >= 0) {
    cloudFetchDesired();
  }

  xSemaphoreTake(cloudLock, portMAX_DELAY);
  bool urgent = cloudSnapUrgent;
  bool fresh = cloudSnapVersion != cloudSentVersion;
  xSemaphoreGive(cloudLock);

  bool reportDue = (urgent && fresh) || now - cloudLastReport >= CLOUD_CHECKIN_MS || cloudLastReport == 0;

  if (reportDue && (long)(now - cloudNextReportTry) >= 0) {
    if (!cloudReport()) cloudNextReportTry = millis() + 10000;
  }
}

void cloudTask(void*) {
  for (;;) {
    cloudTaskStep();
    vTaskDelay(pdMS_TO_TICKS(10));
  }
}


// ------------------------------------------------------------
// SETUP / LOOP (called from the sketch)
// ------------------------------------------------------------

// Call in setup() after the relay pins are set, before Wi-Fi.
void cloudBegin() {

  cloudLock = xSemaphoreCreateMutex();
  for (uint8_t r = 0; r <= CLOUD_RELAYS; r++) cloudWant[r] = -1;

  cloudPrefs.begin("relays", false);

  cloudSeqKnown = cloudPrefs.isKey("seq");
  cloudLastSeq = cloudPrefs.getUInt("seq", 0);

  // Power cut: back to the last state straight away, even without internet.
  cloudRestoring = true;

  for (uint8_t r = 1; r <= CLOUD_RELAYS; r++) {
    String key = "r" + String(r);
    if (cloudPrefs.isKey(key.c_str())) {
      setRelay(r, cloudPrefs.getBool(key.c_str(), false));
    }
  }

  cloudRestoring = false;

  // India time; certificates need a real clock.
  configTime(19800, 0, "pool.ntp.org", "time.google.com");

  cloudWs.onEvent(cloudWsEvent);
  cloudWs.setReconnectInterval(5000);
  cloudWs.enableHeartbeat(30000, 10000, 2);

  cloudLastTimerSig = cloudTimerSignature();

  // Internet work on core 0 (with Wi-Fi); the sketch's loop() stays on core 1.
  xTaskCreatePinnedToCore(cloudTask, "cloud", 16384, nullptr, 1, nullptr, 0);
}

// Call every loop(): applies what the app asked for and hands the cloud task
// a fresh /status when something changed (and every 10 s).
void cloudLoop() {

  // 1. Take what the cloud task received.
  int8_t want[CLOUD_RELAYS + 1];
  CloudCommand commands[CLOUD_QUEUE];
  int commandCount;

  xSemaphoreTake(cloudLock, portMAX_DELAY);
  for (uint8_t r = 0; r <= CLOUD_RELAYS; r++) {
    want[r] = cloudWant[r];
    cloudWant[r] = -1;
  }
  commandCount = cloudQueueCount;
  for (int i = 0; i < commandCount; i++) commands[i] = cloudQueue[i];
  cloudQueueCount = 0;
  xSemaphoreGive(cloudLock);

  // 2. Act on it.
  cloudApplying = true;
  for (uint8_t r = 1; r <= CLOUD_RELAYS; r++) {
    if (want[r] >= 0 && (want[r] == 1) != getRelayState(r)) {
      Serial.printf("[cloud] app: relay %u %s\n", r, want[r] ? "ON" : "OFF");
      setRelay(r, want[r] == 1);
    }
  }
  cloudApplying = false;

  for (int i = 0; i < commandCount; i++) cloudRunCommand(commands[i]);

  uint32_t timerSig = cloudTimerSignature();
  if (timerSig != cloudLastTimerSig) {
    cloudLastTimerSig = timerSig;
    cloudReportDue = true;
  }

  // 3. Hand the cloud task a fresh /status.
  unsigned long now = millis();
  if (!cloudReportDue && now - cloudLastSnapshot < CLOUD_SNAPSHOT_MS && cloudLastSnapshot != 0) {
    return;
  }

  String status = getStatusJSON();
  String desired;

  if (cloudDesiredDue) {
    desired = "{";
    for (uint8_t r = 1; r <= CLOUD_RELAYS; r++) {
      if (r > 1) desired += ",";
      desired += "\"" + String(r) + "\":\"" + (getRelayState(r) ? "on" : "off") + "\"";
    }
    desired += "}";
  }

  xSemaphoreTake(cloudLock, portMAX_DELAY);
  cloudSnapStatus = status;
  if (cloudDesiredDue) {
    cloudSnapDesired = desired;
    cloudSnapHasDesired = true;
  }
  if (cloudReportDue) cloudSnapUrgent = true;
  cloudSnapVersion++;
  xSemaphoreGive(cloudLock);

  cloudDesiredDue = false;
  cloudReportDue = false;
  cloudLastSnapshot = now;
}
