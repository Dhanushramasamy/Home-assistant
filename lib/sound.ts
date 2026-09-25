"use client";

/**
 * Short switch "click" made with the Web Audio API (no audio file), plus a
 * tiny vibration on devices that support it (Android). Turning on is a little
 * brighter than turning off.
 */
let ctx: AudioContext | null = null;

export function playSwitchClick(turningOn: boolean) {
  try {
    if (typeof window === "undefined") return;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    ctx ??= new AudioCtx();
    if (ctx.state === "suspended") void ctx.resume();

    const t = ctx.currentTime;

    // Body of the click: a fast-falling tone.
    const osc = ctx.createOscillator();
    const tone = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(turningOn ? 1900 : 1300, t);
    osc.frequency.exponentialRampToValueAtTime(turningOn ? 950 : 650, t + 0.04);
    tone.gain.setValueAtTime(0.0001, t);
    tone.gain.exponentialRampToValueAtTime(0.22, t + 0.004);
    tone.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    osc.connect(tone).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.07);

    // Snap of the click: a very short filtered noise burst.
    const len = Math.floor(ctx.sampleRate * 0.015);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 2500;
    const snap = ctx.createGain();
    snap.gain.value = 0.18;
    noise.connect(filter).connect(snap).connect(ctx.destination);
    noise.start(t);

    navigator.vibrate?.(10);
  } catch {
    // Sound is a nice-to-have; never break the toggle.
  }
}
