import type { SoundId } from './db';

export const SOUNDS: { id: SoundId; label: string }[] = [
  { id: 'pulse', label: 'Pulse' },
  { id: 'rise', label: 'Rise' },
  { id: 'bell', label: 'Bell' },
  { id: 'digital', label: 'Digital' },
];

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx ??= new AC();
  return ctx;
}

/** iOS only lets audio start inside a user gesture; call this from the first tap. */
export function unlockAudio(): void {
  const c = audio();
  if (!c || c.state === 'running') return;
  void c.resume();
  const src = c.createBufferSource();
  src.buffer = c.createBuffer(1, 1, 22050);
  src.connect(c.destination);
  src.start(0);
}

function tone(c: AudioContext, at: number, freq: number, dur: number, type: OscillatorType, gain = 0.25) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(c.destination);
  o.start(at);
  o.stop(at + dur + 0.05);
}

function pattern(c: AudioContext, id: SoundId, t: number): number {
  switch (id) {
    case 'pulse':
      [0, 0.18, 0.36].forEach((d) => tone(c, t + d, 880, 0.12, 'sine', 0.3));
      return 1.1;
    case 'rise':
      [523, 659, 784, 1047].forEach((f, i) => tone(c, t + i * 0.16, f, 0.22, 'triangle'));
      return 1.3;
    case 'bell':
      tone(c, t, 660, 1.4, 'sine', 0.3);
      tone(c, t, 1320, 0.9, 'sine', 0.08);
      return 1.6;
    case 'digital':
      [0, 0.1, 0.2, 0.3].forEach((d) => tone(c, t + d, 1200, 0.06, 'square', 0.12));
      return 0.9;
  }
}

/** Plays a sound on loop until the returned stop function runs. */
export function loopSound(id: SoundId): () => void {
  const c = audio();
  if (!c) return () => {};
  void c.resume();
  let stopped = false;
  let next = c.currentTime + 0.05;
  const tick = () => {
    if (stopped) return;
    while (next < c.currentTime + 1.5) next += pattern(c, id, next);
  };
  tick();
  const iv = window.setInterval(tick, 400);
  return () => {
    stopped = true;
    window.clearInterval(iv);
  };
}

export function previewSound(id: SoundId): void {
  const c = audio();
  if (!c) return;
  void c.resume();
  pattern(c, id, c.currentTime + 0.05);
}

export function chime(): void {
  const c = audio();
  if (!c || c.state !== 'running') return;
  [784, 1047].forEach((f, i) => tone(c, c.currentTime + i * 0.12, f, 0.25, 'sine', 0.2));
}
