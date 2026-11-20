// Screenshot staging: each shot sets the world up in a lively state and
// steps the simulation forward, so the capture shows the game mid-action.
// The main loop calls stageShot once, then renders twice and sets
// window.__shotReady so the screenshot tool knows the frame is settled.

import { MISSIONS, PLACES } from './config.js';

const STEP = 1 / 60;

function blankInput() {
  return {
    up: false, down: false, left: false, right: false, run: false,
    aimX: 0, aimY: 0, mouseDown: false,
    steal: false, punch: false, shoot: false,
  };
}

function putPlayerInCar(world, x, y, angle, speed) {
  const state = world.state;
  let best = null;
  let bestD = Infinity;
  for (const car of state.cars) {
    if (car.kind !== 'traffic') continue;
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestD) { bestD = d; best = car; }
  }
  if (!best) return;
  state.player.car = best;
  best.driver = 'player';
  state.player.onFoot = false;
  state.player.x = best.x;
  state.player.y = best.y;
  state.player.angle = angle;
  best.angle = angle;
  best.x = x;
  best.y = y;
  best.speed = speed || 0;
  state.camera.x = x - 640;
  state.camera.y = y - 400;
}

export function stageShot(name, world) {
  const state = world.state;
  if (name === 'drive') {
    world.applySave({ cash: 150, mission: 1, health: 100 });
    putPlayerInCar(world, 1600, 1750, -Math.PI / 2, 0);
    const input = blankInput();
    input.up = true;
    for (let i = 0; i < 45; i++) world.step(STEP, input, false);
    return 'play';
  }
  if (name === 'chase') {
    world.applySave({ cash: 450, mission: 2, health: 100 });
    putPlayerInCar(world, 1600, 1800, -Math.PI / 2, 350);
    state.wanted = 3;
    state.wantedTimer = 0;
    const input = blankInput();
    input.up = true;
    for (let i = 0; i < 70; i++) {
      world.step(STEP, input, false);
      if (state.busted) break;
    }
    return 'play';
  }
  if (name === 'end') {
    world.applySave({ cash: 3200, mission: 4, health: 90 });
    state.complete = true;
    state.mission = 5;
    world.step(STEP, blankInput(), true);
    return 'complete';
  }
  // 'start' and anything else: a live city behind the title screen.
  world.reset();
  for (let i = 0; i < 150; i++) world.step(STEP, blankInput(), true);
  return 'title';
}

export { MISSIONS, PLACES };
