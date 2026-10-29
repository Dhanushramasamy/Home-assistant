#!/usr/bin/env python3
"""Standalone Wi-Fi signal dashboard for the Raspberry Pi 5.

This folder is intentionally independent from the Home Control app.
"""

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
import re
import socket
import threading
import subprocess
import time


ROOT = Path(__file__).parent
HTML = (ROOT / "dashboard.html").read_text(encoding="utf-8")
CSI_PORT = 5005
CSI_STATE = {
    "packets": 0,
    "lastPacket": 0,
    "rssi": None,
    "amplitude": 0,
    "variance": 0,
}
CSI_LOCK = threading.Lock()


def command(*args):
    try:
        result = subprocess.run(
            args, capture_output=True, text=True, timeout=2, check=False
        )
        return result.stdout.strip()
    except (OSError, subprocess.SubprocessError):
        return ""


def local_ip():
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.connect(("1.1.1.1", 80))
        return sock.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        sock.close()


def wifi_status():
    # `iw dev wlan0 link` works without root and is available on Raspberry Pi OS.
    iw = "/usr/sbin/iw"
    raw = command(iw, "dev", "wlan0", "link")
    if not raw:
        raw = command(iw, "dev", "wlan1", "link")

    ssid = "Not available"
    signal = None
    frequency = None
    state = "disconnected"

    if "Connected to" in raw:
        state = "connected"
    ssid_match = re.search(r"\n\s*SSID:\s*(.+)", raw)
    signal_match = re.search(r"\n\s*signal:\s*(-?[0-9.]+) dBm", raw)
    freq_match = re.search(r"\n\t?freq: ([0-9]+)", raw)
    if ssid_match:
        ssid = ssid_match.group(1).strip()
    if signal_match:
        signal = float(signal_match.group(1))
    if freq_match:
        frequency = int(freq_match.group(1))

    return {
        "time": int(time.time() * 1000),
        "state": state,
        "ssid": ssid,
        "signalDbm": signal,
        "frequencyMHz": frequency,
        "interface": "wlan0 or wlan1",
        "ip": local_ip(),
        "source": "iw dev wlan link",
        "csi": csi_snapshot(),
    }


def csi_snapshot():
    with CSI_LOCK:
        return dict(CSI_STATE)


def csi_listener():
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.bind(("0.0.0.0", CSI_PORT))
    while True:
        payload, _address = sock.recvfrom(2048)
        try:
            fields = payload.decode("ascii", errors="ignore").strip().split(",")
            if len(fields) < 5 or fields[0] != "CSI":
                continue
            rssi = float(fields[1])
            values = [abs(float(value)) for value in fields[3:] if value]
            if not values:
                continue
            average = sum(values) / len(values)
            variance = sum((value - average) ** 2 for value in values) / len(values)
            with CSI_LOCK:
                CSI_STATE.update({
                    "packets": CSI_STATE["packets"] + 1,
                    "lastPacket": int(time.time() * 1000),
                    "rssi": rssi,
                    "amplitude": round(average, 2),
                    "variance": round(variance, 2),
                })
        except (ValueError, UnicodeError):
            continue


class Handler(BaseHTTPRequestHandler):
    def send_text(self, body, content_type):
        encoded = body.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(encoded)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(encoded)

    def do_GET(self):  # noqa: N802
        if self.path == "/":
            self.send_text(HTML, "text/html; charset=utf-8")
            return
        if self.path == "/api/status":
            self.send_text(json.dumps(wifi_status()), "application/json")
            return
        self.send_error(404)

    def log_message(self, *_args):
        return


def main():
    port = 8080
    threading.Thread(target=csi_listener, daemon=True).start()
    server = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    print(f"Wi-Fi sensing POC running at http://{local_ip()}:{port}")
    print("Press Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
