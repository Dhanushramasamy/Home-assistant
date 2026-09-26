"use client";

/**
 * Switch feedback: a clear mechanical click (two-stage "cli-click" for ON, a
 * single lower click for OFF) plus a haptic tap. Made with the Web Audio API,
 * so there is no audio file.
 *
 * Haptics:
 * - Android (and other browsers with the Vibration API): a short pulse.
 * - iPhone (iOS 18+): Safari has no Vibration API, but tapping a native
 *   switch control gives a system haptic, so we toggle a hidden one.
 */
let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  ctx ??= new AudioCtx();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** One mechanical click at time `t`: contact tick + bright resonance + small body. */
function click(ac: AudioContext, out: AudioNode, t: number, pitch: number, level: number) {
  // 1. Contact tick: ~4 ms of high-passed noise with a very fast decay.
  const len = Math.floor(ac.sampleRate * 0.004);
  const buffer = ac.createBuffer(1, len, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4);
  const tick = ac.createBufferSource();
  tick.buffer = buffer;
  const hp = ac.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 1800;
  const tickGain = ac.createGain();
  tickGain.gain.value = 0.9 * level;
  tick.connect(hp).connect(tickGain).connect(out);
  tick.start(t);

  // 2. Resonance: a short, bright ring that makes the click clear and "clean".
  const ring = ac.createOscillator();
  const ringGain = ac.createGain();
  ring.type = "sine";
  ring.frequency.setValueAtTime(pitch, t);
  ring.frequency.exponentialRampToValueAtTime(pitch * 0.82, t + 0.03);
  ringGain.gain.setValueAtTime(0.0001, t);
  ringGain.gain.exponentialRampToValueAtTime(0.32 * level, t + 0.001);
  ringGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
  ring.connect(ringGain).connect(out);
  ring.start(t);
  ring.stop(t + 0.04);

  // 3. Body: a little low-mid weight so it doesn't sound thin.
  const body = ac.createOscillator();
  const bodyGain = ac.createGain();
  body.type = "triangle";
  body.frequency.setValueAtTime(pitch / 4, t);
  body.frequency.exponentialRampToValueAtTime(pitch / 8, t + 0.025);
  bodyGain.gain.setValueAtTime(0.0001, t);
  bodyGain.gain.exponentialRampToValueAtTime(0.28 * level, t + 0.002);
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
  body.connect(bodyGain).connect(out);
  body.start(t);
  body.stop(t + 0.035);
}

function playTock(turningOn: boolean) {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + 0.005;

  // Keep it clear and loud enough without clipping on phone speakers.
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -10;
  comp.knee.value = 6;
  comp.ratio.value = 4;
  comp.attack.value = 0.001;
  comp.release.value = 0.05;
  const master = ac.createGain();
  master.gain.value = 0.9;
  master.connect(comp).connect(ac.destination);

  if (turningOn) {
    // ON: press + latch, a crisp two-stage "cli-click".
    click(ac, master, t, 2600, 0.75);
    click(ac, master, t + 0.018, 3100, 1);
  } else {
    // OFF: a single, slightly lower "clock".
    click(ac, master, t, 2100, 1);
  }
}

let iosSwitchLabel: HTMLLabelElement | null = null;

function haptic() {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate(18);
    return;
  }
  // iOS 18+: toggling a native <input type="checkbox" switch> fires a system haptic.
  if (typeof document === "undefined") return;
  if (!iosSwitchLabel) {
    const label = document.createElement("label");
    label.setAttribute("aria-hidden", "true");
    label.style.cssText = "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden;left:-9999px";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("switch", "");
    input.tabIndex = -1;
    label.appendChild(input);
    document.body.appendChild(label);
    iosSwitchLabel = label;
  }
  iosSwitchLabel.click();
}

/** Call from the click handler of a power switch. */
export function playSwitchClick(turningOn: boolean) {
  try {
    playTock(turningOn);
  } catch {
    // Sound is a nice-to-have; never break the toggle.
  }
  try {
    haptic();
  } catch {}
}
