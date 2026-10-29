# Wi-Fi sensing POC

This is a standalone dashboard for the Raspberry Pi 5. It is not connected to the Home Control app, Supabase, or the ESP32 firmware.

It currently reads the Pi's connected Wi-Fi signal using `iw dev wlan0 link` and displays:

- connection status;
- Wi-Fi network name;
- signal strength in dBm;
- frequency;
- a live signal chart;
- a basic signal-variation score.

The variation score is only a first visual experiment. It is not CSI, pose detection, or reliable occupancy detection.

## Run on the Pi

```bash
cd ~/Documents/Personal_files/projects/home-assistant/wifi-sensing-poc
python3 server.py
```

The terminal prints the local URL, for example:

```text
http://192.168.1.100:8080
```

Open that URL from another phone or computer on the same Wi-Fi.

If `iw` is missing:

```bash
sudo apt update
sudo apt install iw
```
