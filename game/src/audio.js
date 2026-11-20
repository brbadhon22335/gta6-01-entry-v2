// Synthesized sound: no audio files, everything comes from WebAudio
// oscillators and noise. Engine hum follows the driving speed; sirens
// wail while the player is wanted. Muted by default until the player
// interacts, and toggled with M.

export const EVENT_SHOT = 1;
export const EVENT_PUNCH = 2;
export const EVENT_CRASH = 4;
export const EVENT_PICKUP = 8;
export const EVENT_MISSION = 16;
export const EVENT_BUSTED = 32;
export const EVENT_WANTED = 64;
export const EVENT_COIN = 128;
export const EVENT_EXPLODE = 256;

export function createAudio() {
  let context = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let muted = false;
  let started = false;

  function ensure() {
    if (started) return;
    started = true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      context = new AC();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.35;
      master.connect(context.destination);
      engineOsc = context.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = context.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      sirenOsc = context.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 700;
      sirenGain = context.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
    } catch {
      context = null;
    }
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!context || muted) return;
    const osc = context.createOscillator();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, context.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, context.currentTime + dur);
    const gain = context.createGain();
    gain.gain.setValueAtTime(vol || 0.2, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.stop(context.currentTime + dur);
  }

  function noise(dur, vol, low) {
    if (!context || muted) return;
    const len = Math.floor(context.sampleRate * dur);
    const buffer = context.createBuffer(1, len, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = context.createBufferSource();
    src.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = low || 900;
    const gain = context.createGain();
    gain.gain.value = vol || 0.25;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start();
  }

  function jingle(notes) {
    if (!context || muted) return;
    notes.forEach(([freq, at], i) => {
      setTimeout(() => tone(freq, 0.22, 'triangle', 0.25), at * 1000);
    });
  }

  function playEvents(events) {
    if (!context) return;
    if (events & EVENT_SHOT) {
      noise(0.12, 0.3, 2400);
      tone(190, 0.1, 'square', 0.18, 70);
    }
    if (events & EVENT_PUNCH) noise(0.08, 0.22, 700);
    if (events & EVENT_CRASH) noise(0.2, 0.3, 500);
    if (events & EVENT_EXPLODE) {
      noise(0.6, 0.4, 400);
      tone(70, 0.5, 'sawtooth', 0.25, 30);
    }
    if (events & EVENT_PICKUP) tone(880, 0.12, 'sine', 0.2, 1320);
    if (events & EVENT_COIN) {
      tone(1046, 0.1, 'triangle', 0.22);
      setTimeout(() => tone(1568, 0.16, 'triangle', 0.22), 90);
    }
    if (events & EVENT_WANTED) {
      tone(440, 0.15, 'square', 0.15, 660);
      setTimeout(() => tone(660, 0.15, 'square', 0.15, 440), 160);
    }
    if (events & EVENT_MISSION) jingle([[523, 0], [659, 0.14], [784, 0.28], [1046, 0.42]]);
    if (events & EVENT_BUSTED) jingle([[392, 0], [330, 0.2], [262, 0.4], [196, 0.6]]);
  }

  function update(speed, wanted, time) {
    if (!context || muted) {
      if (engineGain) engineGain.gain.value = 0;
      if (sirenGain) sirenGain.gain.value = 0;
      return;
    }
    if (engineOsc) {
      engineOsc.frequency.value = 50 + Math.min(1, speed / 640) * 90;
      engineGain.gain.value = speed > 20 ? 0.05 : 0;
    }
    if (sirenOsc) {
      sirenGain.gain.value = wanted > 0 ? 0.035 : 0;
      sirenOsc.frequency.value = 650 + Math.sin(time * 3) * 250;
    }
  }

  function toggleMute() {
    muted = !muted;
    if (master) master.gain.value = muted ? 0 : 0.35;
    return muted;
  }

  return { ensure, playEvents, update, toggleMute, get muted() { return muted; } };
}
