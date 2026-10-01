// Example of the board_config.h the app generates (Settings -> Boards ->
// Download code). You don't normally write this by hand.
#pragma once

const char* BOARD_ID = "esp202";
const char* BOARD_NAME = "Hall";

// Relays: how many, the ESP32 pin for each, and whether the relay module
// switches on when the pin is LOW (most modules do).
#define RELAY_COUNT 2
const uint8_t RELAY_PINS[RELAY_COUNT] = {23, 22};
#define RELAY_ACTIVE_LOW true

// Wi-Fi networks, highest priority first.
struct WifiNetwork {
  const char* ssid;
  const char* password;
};
#define WIFI_COUNT 2
const WifiNetwork WIFI_NETWORKS[WIFI_COUNT] = {
  {"Home Wi-Fi", "password"},
  {"Phone hotspot", "password"},
};

// Cloud sign-in for this board (created by the app).
const char* SUPABASE_HOST = "YOUR_PROJECT.supabase.co";
const char* SUPABASE_KEY = "sb_publishable_...";
const char* BOARD_EMAIL = "esp202@boards.home-control.app";
const char* BOARD_PASSWORD = "GENERATED";
