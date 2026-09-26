"use client";

/**
 * Switch feedback: a soft, short "tock" (like a premium wall switch) plus a
 * haptic tap. Made with the Web Audio API, so there is no audio file.
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

function playTock(turningOn: boolean) {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  const out = ac.createGain();
  out.gain.value = 0.55; // overall level: present but quiet
  out.connect(ac.destination);

  // Low "thock": the body of the switch.
  const body = ac.createOscillator();
  const bodyGain = ac.createGain();
  body.type = "sine";
  body.frequency.setValueAtTime(turningOn ? 210 : 170, t);
  body.frequency.exponentialRampToValueAtTime(turningOn ? 120 : 95, t + 0.035);
  bodyGain.gain.setValueAtTime(0.0001, t);
  bodyGain.gain.exponentialRampToValueAtTime(0.35, t + 0.002);
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  body.connect(bodyGain).connect(out);
  body.start(t);
  body.stop(t + 0.06);

  // Crisp contact "tick": a few milliseconds of band-passed noise.
  const len = Math.floor(ac.sampleRate * 0.006);
  const buffer = ac.createBuffer(1, len, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  const tick = ac.createBufferSource();
  tick.buffer = buffer;
  const band = ac.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = turningOn ? 3400 : 2600;
  band.Q.value = 1.2;
  const tickGain = ac.createGain();
  tickGain.gain.value = 0.22;
  tick.connect(band).connect(tickGain).connect(out);
  tick.start(t);
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
