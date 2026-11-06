const { ipcRenderer } = require('electron');

/**
 * Global Keyboard Audio Engine for Type Review
 * Ported from src/io/sound-packs.ts for system-wide mechanical typing sounds.
 */

const SOUND_PACKS = {
  mechvibe: {
    kind: 'synth',
    sounds: {
      default: { noise: { durationMs: 50, filter: 'bandpass', freq: 3000, q: 1.5, peak: 0.4 }, osc: { type: 'sine', freq: 90, durationMs: 60, peak: 0.15 } },
      tab:     { noise: { durationMs: 60, filter: 'bandpass', freq: 2400, q: 1.5, peak: 0.45 }, osc: { type: 'sine', freq: 75, durationMs: 70, peak: 0.18 } },
      enter:   { noise: { durationMs: 70, filter: 'bandpass', freq: 2200, q: 2.0, peak: 0.5 }, osc: { type: 'sine', freq: 70, durationMs: 90, peak: 0.22 } },
      esc:     { noise: { durationMs: 40, filter: 'bandpass', freq: 3500, q: 1.5, peak: 0.35 } },
      space:   { noise: { durationMs: 70, filter: 'bandpass', freq: 1800, q: 1.0, peak: 0.45 }, osc: { type: 'sine', freq: 60, durationMs: 95, peak: 0.22 } },
    },
    release: { gain: 0.34, duration: 0.55, brightness: 1.3, resonance: 0 },
  },
  soft: {
    kind: 'synth',
    sounds: {
      default: { noise: { durationMs: 35, filter: 'lowpass', freq: 1200, q: 1, peak: 0.25 } },
      tab:     { noise: { durationMs: 40, filter: 'lowpass', freq: 1000, q: 1, peak: 0.28 } },
      enter:   { noise: { durationMs: 50, filter: 'lowpass', freq: 800,  q: 1, peak: 0.32 } },
      esc:     { noise: { durationMs: 25, filter: 'lowpass', freq: 1500, q: 1, peak: 0.22 } },
      space:   { noise: { durationMs: 50, filter: 'lowpass', freq: 900,  q: 1, peak: 0.32 } },
    },
    release: { gain: 0.42, duration: 0.6, brightness: 1.25, resonance: 0 },
  },
  thock: {
    kind: 'synth',
    sounds: {
      default: { noise: { durationMs: 55, filter: 'bandpass', freq: 1100, q: 1.2, peak: 0.38 }, osc: { type: 'sine', freq: 60, durationMs: 95,  peak: 0.26 } },
      tab:     { noise: { durationMs: 62, filter: 'bandpass', freq: 1000, q: 1.2, peak: 0.38 }, osc: { type: 'sine', freq: 56, durationMs: 100, peak: 0.26 } },
      enter:   { noise: { durationMs: 75, filter: 'bandpass', freq: 900,  q: 1.3, peak: 0.44 }, osc: { type: 'sine', freq: 50, durationMs: 120, peak: 0.30 } },
      esc:     { noise: { durationMs: 42, filter: 'bandpass', freq: 1400, q: 1.2, peak: 0.30 }, osc: { type: 'sine', freq: 72, durationMs: 60,  peak: 0.18 } },
      space:   { noise: { durationMs: 80, filter: 'bandpass', freq: 820,  q: 1.0, peak: 0.44 }, osc: { type: 'sine', freq: 45, durationMs: 130, peak: 0.32 } },
    },
    release: { gain: 0.3, duration: 0.5, brightness: 1.5, resonance: 0.12 },
  },
  clicky: {
    kind: 'synth',
    sounds: {
      default: { noise: { durationMs: 38, filter: 'bandpass', freq: 4200, q: 2.6, peak: 0.40 }, osc: { type: 'sine', freq: 1800, durationMs: 55, peak: 0.09 } },
      tab:     { noise: { durationMs: 44, filter: 'bandpass', freq: 3900, q: 2.6, peak: 0.42 }, osc: { type: 'sine', freq: 1650, durationMs: 60, peak: 0.10 } },
      enter:   { noise: { durationMs: 52, filter: 'bandpass', freq: 3600, q: 2.8, peak: 0.46 }, osc: { type: 'sine', freq: 1450, durationMs: 70, peak: 0.11 } },
      esc:     { noise: { durationMs: 28, filter: 'bandpass', freq: 5000, q: 2.4, peak: 0.34 }, osc: { type: 'sine', freq: 2200, durationMs: 34, peak: 0.07 } },
      space:   { noise: { durationMs: 55, filter: 'bandpass', freq: 3000, q: 1.8, peak: 0.44 }, osc: { type: 'sine', freq: 1150, durationMs: 65, peak: 0.09 } },
    },
    release: { gain: 0.45, duration: 0.6, brightness: 1.15, resonance: 0.45 },
  },
  laptop: {
    kind: 'synth',
    sounds: {
      default: { noise: { durationMs: 24, filter: 'bandpass', freq: 4800, q: 1.3, peak: 0.32 }, osc: { type: 'sine', freq: 140, durationMs: 28, peak: 0.07 } },
      tab:     { noise: { durationMs: 28, filter: 'bandpass', freq: 4500, q: 1.3, peak: 0.32 }, osc: { type: 'sine', freq: 130, durationMs: 32, peak: 0.07 } },
      enter:   { noise: { durationMs: 34, filter: 'bandpass', freq: 3900, q: 1.2, peak: 0.35 }, osc: { type: 'sine', freq: 115, durationMs: 40, peak: 0.09 } },
      esc:     { noise: { durationMs: 18, filter: 'bandpass', freq: 5600, q: 1.3, peak: 0.26 }, osc: { type: 'sine', freq: 165, durationMs: 20, peak: 0.05 } },
      space:   { noise: { durationMs: 40, filter: 'bandpass', freq: 2900, q: 1.0, peak: 0.36 }, osc: { type: 'sine', freq: 105, durationMs: 48, peak: 0.10 } },
    },
    release: { gain: 0.38, duration: 0.55, brightness: 1.2, resonance: 0 },
  },
  typewriter: {
    kind: 'sprite',
    url: '/sounds/typewriter.ogg',
    sliceMs: { default: 80, tab: 95, space: 110, enter: 130, esc: 65 },
  },
  off: {
    kind: 'off',
  },
};

let audioCtx = null;
let masterGain = null;
let activePackName = 'typewriter';
let currentVolume = 1.0;
let typewriterBuffer = null;
let typewriterPeakOffsets = [];

function initAudio() {
  if (audioCtx) return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  audioCtx = new AudioContextClass();
  masterGain = audioCtx.createGain();
  masterGain.gain.setValueAtTime(currentVolume, audioCtx.currentTime);
  masterGain.connect(audioCtx.destination);
  loadTypewriterSprite();
}

function loadTypewriterSprite() {
  if (typewriterBuffer || !audioCtx) return;
  fetch('/sounds/typewriter.ogg')
    .then((r) => r.arrayBuffer())
    .then((bytes) => audioCtx.decodeAudioData(bytes))
    .then((buffer) => {
      typewriterBuffer = buffer;
      typewriterPeakOffsets = findPeakOffsets(buffer);
    })
    .catch((err) => console.warn('Could not load typewriter sprite:', err));
}

function findPeakOffsets(buffer) {
  const data = buffer.getChannelData(0);
  const sr = buffer.sampleRate;
  const minGapSamples = Math.max(1, Math.floor((100 / 1000) * sr));
  const preRollSamples = Math.floor(0.002 * sr);
  const offsets = [];
  let lastPeakIdx = -minGapSamples;
  for (let i = 0; i < data.length; i++) {
    const sample = data[i];
    if (Math.abs(sample) >= 0.3 && i - lastPeakIdx >= minGapSamples) {
      offsets.push(Math.max(0, (i - preRollSamples) / sr));
      lastPeakIdx = i;
    }
  }
  return offsets;
}

function getDestination(pan = 0) {
  if (!audioCtx || !masterGain) return null;
  if (pan === 0 || typeof audioCtx.createStereoPanner !== 'function') {
    return masterGain;
  }
  const panner = audioCtx.createStereoPanner();
  panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), audioCtx.currentTime);
  panner.connect(masterGain);
  return panner;
}

function makeNoiseBuffer(ctx, durationMs) {
  const length = Math.max(1, Math.floor((ctx.sampleRate * durationMs) / 1000));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

function playNoise(dest, cfg, now) {
  const src = audioCtx.createBufferSource();
  src.buffer = makeNoiseBuffer(audioCtx, cfg.durationMs);
  const filter = audioCtx.createBiquadFilter();
  filter.type = cfg.filter;
  filter.frequency.value = cfg.freq;
  filter.Q.value = cfg.q;
  const gain = audioCtx.createGain();
  const end = now + cfg.durationMs / 1000;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(cfg.peak, now + 0.001);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  src.connect(filter).connect(gain).connect(dest);
  src.start(now);
  src.stop(end + 0.02);
}

function playOsc(dest, cfg, now) {
  const osc = audioCtx.createOscillator();
  osc.type = cfg.type;
  osc.frequency.value = cfg.freq;
  const gain = audioCtx.createGain();
  const end = now + cfg.durationMs / 1000;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(cfg.peak, now + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  osc.connect(gain).connect(dest);
  osc.start(now);
  osc.stop(end + 0.02);
}

function playKeySound(category = 'default', pan = 0, stroke = 'press') {
  if (activePackName === 'off') return;
  initAudio();
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  const pack = SOUND_PACKS[activePackName];
  if (!pack || pack.kind === 'off') return;

  const dest = getDestination(pan);
  const now = audioCtx.currentTime;

  if (pack.kind === 'synth') {
    const pressed = pack.sounds[category] || pack.sounds.default;
    if (stroke === 'release' && !pack.release) return;

    let config = pressed;
    if (stroke === 'release' && pack.release) {
      const rel = pack.release;
      config = {
        noise: pressed.noise && {
          ...pressed.noise,
          durationMs: pressed.noise.durationMs * rel.duration,
          freq: pressed.noise.freq * rel.brightness,
          peak: pressed.noise.peak * rel.gain,
        },
        osc: rel.resonance > 0 && pressed.osc && {
          ...pressed.osc,
          durationMs: pressed.osc.durationMs * rel.duration,
          peak: pressed.osc.peak * rel.gain * rel.resonance,
        },
      };
    }

    if (config.noise) playNoise(dest, config.noise, now);
    if (config.osc) playOsc(dest, config.osc, now);
  } else if (pack.kind === 'sprite' && typewriterBuffer) {
    if (stroke === 'release') return;
    const sliceMs = pack.sliceMs[category] || pack.sliceMs.default;
    const sliceSec = Math.min(sliceMs / 1000, typewriterBuffer.duration);
    const offset =
      typewriterPeakOffsets.length > 0
        ? typewriterPeakOffsets[Math.floor(Math.random() * typewriterPeakOffsets.length)]
        : 0;

    const src = audioCtx.createBufferSource();
    src.buffer = typewriterBuffer;
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, now + 0.0015);
    gain.gain.setValueAtTime(1, now + Math.max(0, sliceSec - 0.008));
    gain.gain.linearRampToValueAtTime(0, now + sliceSec);
    src.connect(gain).connect(dest);
    src.start(now, offset, sliceSec);
  }
}

// ── Two-way Synchronization with In-App Settings & System Tray ────

function syncFromAppLocalStorage() {
  try {
    const pack = localStorage.getItem('type-review:sound-pack') || 'typewriter';
    const volRaw = localStorage.getItem('type-review:sound-volume');
    const vol = volRaw !== null ? parseFloat(volRaw) : 1.0;

    activePackName = pack;
    currentVolume = Number.isFinite(vol) ? Math.max(0, Math.min(1, vol)) : 1.0;

    if (masterGain && audioCtx) {
      masterGain.gain.setValueAtTime(currentVolume, audioCtx.currentTime);
    }
    if (activePackName === 'typewriter') {
      loadTypewriterSprite();
    }

    ipcRenderer.send('sync-sound-settings', {
      soundPack: activePackName,
      volume: currentVolume,
    });
  } catch (err) {
    console.error('Failed to sync from localStorage:', err);
  }
}

// Global key pressed outside the window
ipcRenderer.on('play-key', (_event, { category, pan, stroke }) => {
  playKeySound(category, pan, stroke);
});

// Changed from System Tray Menu -> update localStorage & trigger SolidJS UI refresh
ipcRenderer.on('set-sound-from-tray', (_event, { soundPack, volume }) => {
  try {
    if (soundPack !== undefined) {
      activePackName = soundPack;
      localStorage.setItem('type-review:sound-pack', soundPack);
    }
    if (volume !== undefined) {
      currentVolume = volume;
      localStorage.setItem('type-review:sound-volume', String(volume));
      if (masterGain && audioCtx) {
        masterGain.gain.setValueAtTime(currentVolume, audioCtx.currentTime);
      }
    }
    if (activePackName === 'typewriter') {
      loadTypewriterSprite();
    }
    // Notify SolidJS reactive components in the web UI
    window.dispatchEvent(new CustomEvent('type-review:sound-sync'));
  } catch (err) {
    console.error('Failed to apply settings from tray:', err);
  }
});

// When user changes sound in the App UI (Topbar or Settings dialog)
window.addEventListener('type-review:sound-changed', (e) => {
  const { name, volume } = e.detail || {};
  if (name !== undefined) activePackName = name;
  if (volume !== undefined) {
    currentVolume = volume;
    if (masterGain && audioCtx) {
      masterGain.gain.setValueAtTime(currentVolume, audioCtx.currentTime);
    }
  }
  if (activePackName === 'typewriter') {
    loadTypewriterSprite();
  }
  ipcRenderer.send('sync-sound-settings', {
    soundPack: activePackName,
    volume: currentVolume,
  });
});

window.addEventListener('DOMContentLoaded', () => {
  initAudio();
  syncFromAppLocalStorage();
});
