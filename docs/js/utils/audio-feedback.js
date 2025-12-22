/**
 * Audio Feedback Module
 *
 * Provides audio cues for different actions:
 * - Game command sent (gentle tap)
 * - App/navigation command sent (muffled ding)
 * - Low confidence warning (gentle warble)
 * - Blocked command (soft buzz)
 * - Play pressed (rising chirp)
 * - Pause pressed (falling chirp)
 * - Mute pressed (triple tap descending)
 * - Unmute pressed (ascending chime)
 */

let audioCtx = null;

function getContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  // Resume if suspended (browser autoplay policy)
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Get master volume multiplier (0.0 - 1.0)
 * Centralized volume control for all audio feedback
 */
function getMasterVolume() {
  const saved = localStorage.getItem('iftalk_masterVolume');
  return saved ? parseInt(saved) / 100 : 1.0;
}

/**
 * Play tone for game command sent (short click)
 */
export function playCommandSent() {
  try {
    const ctx = getContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const masterVol = getMasterVolume();

    osc.connect(gain);
    gain.connect(ctx.destination);

    // Short click sound - more audible
    osc.frequency.value = 800;
    osc.type = 'sine';

    gain.gain.setValueAtTime(0.25 * masterVol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.06);
  } catch (err) {
    console.error('[Audio] Command sent tone error:', err);
  }
}

/**
 * Play tone for app/navigation command (Muted 6: Muffled ding)
 */
export function playAppCommand() {
  try {
    const ctx = getContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const masterVol = getMasterVolume();

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.frequency.value = 600;
    osc.type = 'sine';

    // Low-pass filter to muffle it
    filter.type = 'lowpass';
    filter.frequency.value = 400;

    gain.gain.setValueAtTime(0.15 * masterVol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.12);
  } catch (err) {
    // Ignore audio errors
  }
}

/**
 * Play tone for low confidence warning (gentle warble)
 */
export function playLowConfidence() {
  try {
    const ctx = getContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const masterVol = getMasterVolume();

    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.frequency.value = 200;
    lfo.frequency.value = 8;
    lfoGain.gain.value = 20;
    osc.type = 'sine';

    gain.gain.setValueAtTime(0.12 * masterVol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

    lfo.start(ctx.currentTime);
    osc.start(ctx.currentTime);
    lfo.stop(ctx.currentTime + 0.2);
    osc.stop(ctx.currentTime + 0.2);
  } catch (err) {
    // Ignore audio errors
  }
}

/** Confidence threshold (0.0 - 1.0) */
export const LOW_CONFIDENCE_THRESHOLD = 0.50;

/**
 * Play tone for blocked/failed command (loud buzz - audible during narration)
 */
export function playBlockedCommand() {
  try {
    const ctx = getContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const masterVol = getMasterVolume();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.frequency.value = 150;  // Higher frequency (more noticeable)
    osc.type = 'sawtooth';

    gain.gain.setValueAtTime(0.25 * masterVol, ctx.currentTime);  // Much louder (4x)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);  // Longer duration

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  } catch (err) {
    // Ignore audio errors
  }
}

/**
 * Play tone for play button (rising chirp)
 */
export function playPlayTone() {
  try {
    const ctx = getContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const masterVol = getMasterVolume();

    osc.connect(gain);
    gain.connect(ctx.destination);

    // Rising pitch
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.1);
    osc.type = 'sine';

    gain.gain.setValueAtTime(0.12 * masterVol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.12);
  } catch (err) {
    // Ignore audio errors
  }
}

/**
 * Play tone for pause button (falling chirp)
 */
export function playPauseTone() {
  try {
    const ctx = getContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const masterVol = getMasterVolume();

    osc.connect(gain);
    gain.connect(ctx.destination);

    // Falling pitch
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.1);
    osc.type = 'sine';

    gain.gain.setValueAtTime(0.12 * masterVol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.12);
  } catch (err) {
    // Ignore audio errors
  }
}

/**
 * Play tone for mute button (triple tap descending)
 */
export function playMuteTone() {
  try {
    const ctx = getContext();
    const masterVol = getMasterVolume();
    const freqs = [300, 250, 200];
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      const start = ctx.currentTime + i * 0.05;
      gain.gain.setValueAtTime(0.12 * masterVol, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.04);
      osc.start(start);
      osc.stop(start + 0.04);
    });
  } catch (err) {
    // Ignore audio errors
  }
}

/**
 * Play tone for unmute button (ascending chime)
 */
export function playUnmuteTone() {
  try {
    const ctx = getContext();
    const masterVol = getMasterVolume();
    // First note (lower)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.frequency.value = 660;
    osc1.type = 'sine';
    gain1.gain.setValueAtTime(0.12 * masterVol, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.15);
    // Second note (higher)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.frequency.value = 880;
    osc2.type = 'sine';
    gain2.gain.setValueAtTime(0.12 * masterVol, ctx.currentTime + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc2.start(ctx.currentTime + 0.08);
    osc2.stop(ctx.currentTime + 0.25);
  } catch (err) {
    // Ignore audio errors
  }
}
