// Copy to secrets.h and fill in. secrets.h is git-ignored.
#pragma once

// Wi-Fi networks, tried in this order.
struct WifiNet {
  const char* ssid;
  const char* password;
};
#define WIFI_COUNT 2
const WifiNet WIFI_NETWORKS[WIFI_COUNT] = {
  {"Home Wi-Fi", "password"},
  {"Office Wi-Fi", "password"},
};

// The Home Control app and the user the Cardputer signs in as.
// Use a normal (non-admin) user that has access to the switches it should control.
const char* APP_HOST = "prp-home-assistant.vercel.app";
const char* APP_USER = "cardputer";
const char* APP_PASSWORD = "password";
