/*
  Classic ESP32 CSI streamer for the standalone Pi 5 Wi-Fi sensing POC.
  This is basic CSI capture, not the full RuView pose pipeline.
*/

#include <WiFi.h>
#include <WiFiUdp.h>
#include <esp_wifi_types.h>
#include <esp_wifi.h>
#include "wifi_config.inc"

const IPAddress PI_IP(192, 168, 1, 100);
const uint16_t PI_PORT = 5005;
WiFiUDP udp;
portMUX_TYPE csiMux = portMUX_INITIALIZER_UNLOCKED;
int8_t pendingCsi[96];
volatile int pendingLength = 0;
unsigned long lastProbe = 0;

void csiCallback(void* _ctx, wifi_csi_info_t* info) {
  if (!info || !info->buf || info->len < 4) return;
  int count = info->len < sizeof(pendingCsi) ? info->len : sizeof(pendingCsi);
  portENTER_CRITICAL(&csiMux);
  memcpy(pendingCsi, info->buf, count);
  pendingLength = count;
  portEXIT_CRITICAL(&csiMux);
}

void connectWifi() {
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  for (int i = 0; i < WIFI_COUNT; i++) {
    WiFi.disconnect(true, true);
    delay(500);
    WiFi.begin(WIFI_NETWORKS[i].ssid, WIFI_NETWORKS[i].password);
    Serial.printf("Trying Wi-Fi network %d\n", i + 1);
    unsigned long started = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - started < 12000) delay(250);
    if (WiFi.status() == WL_CONNECTED) {
      Serial.printf("Wi-Fi connected: %s\n", WiFi.localIP().toString().c_str());
      return;
    }
    Serial.printf("Wi-Fi network %d failed, status=%d\n", i + 1, WiFi.status());
  }
}

void setup() {
  Serial.begin(115200);
  delay(500);
  connectWifi();
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Wi-Fi connection failed");
    return;
  }
  Serial.printf("CSI node online: %s -> %s\n", WiFi.localIP().toString().c_str(), PI_IP.toString().c_str());

  wifi_csi_config_t config = {};
  config.lltf_en = true;
  config.htltf_en = true;
  config.stbc_htltf2_en = true;
  config.ltf_merge_en = true;
  config.channel_filter_en = false;
  config.manu_scale = false;
  config.shift = false;
  esp_wifi_set_csi_config(&config);
  esp_wifi_set_csi_rx_cb(&csiCallback, nullptr);
  esp_wifi_set_csi(true);
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWifi();
  }
  int8_t data[96];
  int count = 0;
  portENTER_CRITICAL(&csiMux);
  if (pendingLength > 0) {
    count = pendingLength;
    memcpy(data, pendingCsi, count);
    pendingLength = 0;
  }
  portEXIT_CRITICAL(&csiMux);
  if (count > 1 && WiFi.status() == WL_CONNECTED) {
    char packet[700];
    int used = snprintf(packet, sizeof(packet), "CSI,%d,%d", WiFi.RSSI(), count);
    for (int i = 0; i + 1 < count && used < (int)sizeof(packet) - 8; i += 2) {
      int amplitude = abs((int)data[i]) + abs((int)data[i + 1]);
      used += snprintf(packet + used, sizeof(packet) - used, ",%d", amplitude);
    }
    udp.beginPacket(PI_IP, PI_PORT);
    udp.write((const uint8_t*)packet, used);
    udp.endPacket();
  }
  // Create ordinary Wi-Fi traffic so the receiver has packets whose CSI can be measured.
  if (WiFi.status() == WL_CONNECTED && millis() - lastProbe > 1000) {
    WiFiClient probe;
    probe.setTimeout(1);
    if (probe.connect(PI_IP, 8080)) {
      probe.print("GET /api/status HTTP/1.0\r\nHost: pi\r\nConnection: close\r\n\r\n");
      unsigned long started = millis();
      while (probe.connected() && millis() - started < 100) {
        while (probe.available()) probe.read();
      }
      probe.stop();
    }
    lastProbe = millis();
  }
  delay(100);
}
