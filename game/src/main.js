// Boot and the main loop: fixed 1/60 s simulation steps, the screen state
// machine (title, play, paused, mission complete, busted, game complete),
// save and load through localStorage, and the ?shot= staging mode that
// renders one settled frame and raises window.__shotReady for screenshots.

import { BEST_KEY, SAVE_KEY, STEP } from './config.js';
import { createWorld } from './world.js';
import { buildCity } from './city.js';
import { createRandom } from './random.js';
import {
  SCREEN_BUSTED, SCREEN_COMPLETE, SCREEN_MISSION, SCREEN_PAUSED,
  SCREEN_PLAY, SCREEN_TITLE, createRenderer,
} from './render.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const seedParam = Number.parseInt(params.get('seed') || '1', 10);
const seed = Number.isFinite(seedParam) ? seedParam : 1;
const shotName = params.get('shot') || '';

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(seed);
const city = world.city;
const renderer = createRenderer(canvas, city);
const input = createInput((cx, cy) => renderer.screenToWorld(cx, cy));
const audio = createAudio();

let screen = SCREEN_TITLE;
let muted = false;
let checkpoint = null;
let save = null;
let best = 0;

try {
  save = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
} catch {
  save = null;
}
try {
  best = Number(localStorage.getItem(BEST_KEY) || '0') || 0;
} catch {
  best = 0;
}

function announce(message) {
  if (status) status.textContent = message;
}

function storeSave() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(world.getSave()));
  } catch {
    // Storage may be unavailable; the game still runs.
  }
}

function storeBest() {
  try {
    if (world.state.cash > best) {
      best = world.state.cash;
      localStorage.setItem(BEST_KEY, String(best));
    }
  } catch {
    best = Math.max(best, world.state.cash);
  }
}

function nearestStealable() {
  const p = world.state.player;
  if (!p.onFoot) return null;
  let found = null;
  let foundD = 90;
  for (const car of world.state.cars) {
    if (car.kind !== 'traffic' || car.wreck) continue;
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d < foundD) { foundD = d; found = car; }
  }
  return found;
}

function handleActionEvents(events) {
  const audioEvents = events;
  if (events & 16) { // EVENT_MISSION
    storeSave();
    storeBest();
    checkpoint = world.getSave();
    if (world.state.complete) {
      screen = SCREEN_COMPLETE;
      announce('You own the Strip. Final cash $' + world.state.cash + '.');
    } else {
      screen = SCREEN_MISSION;
      announce('Mission complete. ' + (world.state.justCompleted ? world.state.justCompleted.name : ''));
    }
  }
  if (events & 32) { // EVENT_BUSTED
    screen = SCREEN_BUSTED;
    announce('Busted. The Neon Bay PD caught Rico.');
  }
  audio.playEvents(audioEvents);
}

function frame() {
  const now = performance.now();
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;
  accumulator += dt;
  let steps = 0;
  while (accumulator >= STEP && steps < 5) {
    accumulator -= STEP;
    steps++;
    tick();
  }
  if (steps === 5) accumulator = 0;
  renderer.draw(world.state, screen, {
    save,
    best,
    muted,
    nearCar: screen === SCREEN_PLAY ? nearestStealable() : null,
  });
  requestAnimationFrame(frame);
}

let lastTime = performance.now();
let accumulator = 0;

function tick() {
  const keys = input.state;
  if (keys.mute) {
    muted = audio.toggleMute();
    announce(muted ? 'Sound muted.' : 'Sound on.');
  }
  if (screen === SCREEN_TITLE) {
    world.step(STEP, {
      up: false, down: false, left: false, right: false, run: false,
      aimX: 0, aimY: 0, mouseDown: false,
      steal: false, punch: false, shoot: false,
    }, true);
    if (keys.confirm || keys.newGame) {
      audio.ensure();
      if (keys.newGame || !save) {
        world.reset();
        checkpoint = world.getSave();
        save = null;
        try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
      } else {
        world.applySave(save);
        checkpoint = world.getSave();
      }
      screen = SCREEN_PLAY;
      announce('Neon Bay. Mission: ' + (world.state.mission + 1));
    }
    input.clearActions();
    return;
  }
  if (screen === SCREEN_PAUSED) {
    if (keys.pause || keys.confirm) screen = SCREEN_PLAY;
    input.clearActions();
    return;
  }
  if (screen === SCREEN_MISSION) {
    if (keys.confirm) {
      world.advanceMission();
      checkpoint = world.getSave();
      storeSave();
      screen = SCREEN_PLAY;
      announce('Mission ' + (world.state.mission + 1) + ' started.');
    }
    input.clearActions();
    return;
  }
  if (screen === SCREEN_BUSTED) {
    if (keys.confirm) {
      if (checkpoint) world.applySave(checkpoint);
      else world.reset();
      screen = SCREEN_PLAY;
      announce('Back on the streets.');
    }
    input.clearActions();
    return;
  }
  if (screen === SCREEN_COMPLETE) {
    if (keys.newGame) {
      world.reset();
      checkpoint = world.getSave();
      screen = SCREEN_PLAY;
      announce('New game. Neon Bay is yours again.');
    }
    input.clearActions();
    return;
  }
  // SCREEN_PLAY
  if (keys.pause) {
    screen = SCREEN_PAUSED;
    announce('Paused.');
    input.clearActions();
    return;
  }
  if (keys.newGame) {
    world.reset();
    checkpoint = world.getSave();
    storeSave();
    announce('New game started.');
    input.clearActions();
    return;
  }
  audio.ensure();
  const p = world.state.player;
  const speed = p.car ? Math.abs(p.car.speed) : Math.hypot(p.vx || 0, p.vy || 0);
  audio.update(speed, world.state.wanted, world.state.time);
  const events = world.step(STEP, {
    up: keys.moveY < 0,
    down: keys.moveY > 0,
    left: keys.moveX < 0,
    right: keys.moveX > 0,
    run: keys.run,
    aimX: keys.aim.x,
    aimY: keys.aim.y,
    mouseDown: keys.mouseDown,
    steal: keys.steal,
    punch: keys.punch,
    shoot: keys.mouseDown,
  }, false);
  handleActionEvents(events);
  input.clearActions();
}

if (shotName) {
  // Screenshot mode: stage the scene, render it twice so the frame is
  // settled, then signal the capture tool.
  const shotScreen = stageShot(shotName, world);
  renderer.draw(world.state, shotScreen, { save, best, muted: true, nearCar: null });
  renderer.draw(world.state, shotScreen, { save, best, muted: true, nearCar: null });
  window.__shotReady = true;
  announce('Screenshot ready: ' + shotName);
} else {
  announce('Neon Bay: Street Kings. Press Space or click to start.');
  requestAnimationFrame(frame);
}
