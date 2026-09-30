/**
 * Ring and ringback tones, synthesised with Web Audio so there is no sound
 * file to ship. Best effort: browsers may refuse sound before the user has
 * interacted with the page, and then the call simply rings silently.
 */
type Pattern = { frequencies: number[]; onMs: number; offMs: number; volume: number };

const INCOMING: Pattern = { frequencies: [440, 480], onMs: 1200, offMs: 1800, volume: 0.08 };
const RINGBACK: Pattern = { frequencies: [425], onMs: 1000, offMs: 3000, volume: 0.04 };

let context: AudioContext | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let active: OscillatorNode[] = [];

function beep(ctx: AudioContext, pattern: Pattern) {
  const gain = ctx.createGain();
  gain.gain.value = pattern.volume;
  gain.connect(ctx.destination);
  active = pattern.frequencies.map((frequency) => {
    const osc = ctx.createOscillator();
    osc.frequency.value = frequency;
    osc.connect(gain);
    osc.start();
    osc.stop(ctx.currentTime + pattern.onMs / 1000);
    return osc;
  });
}

function play(pattern: Pattern) {
  stopRingtone();
  const Ctx = typeof window !== "undefined" ? (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) : undefined;
  if (!Ctx) return;
  try {
    context ??= new Ctx();
    void context.resume().catch(() => undefined);
    const loop = () => {
      if (!context) return;
      beep(context, pattern);
      timer = setTimeout(loop, pattern.onMs + pattern.offMs);
    };
    loop();
  } catch {
    /* no sound available; the on-screen call UI is enough */
  }
}

export const playIncomingRingtone = () => play(INCOMING);
export const playRingback = () => play(RINGBACK);

export function stopRingtone() {
  clearTimeout(timer);
  timer = undefined;
  for (const osc of active) {
    try {
      osc.stop();
    } catch {
      /* already stopped */
    }
  }
  active = [];
}
