// The game's rules and state, with no drawing and no browser in it: Rico
// on foot and in cars, traffic and pedestrians, the police and the wanted
// level, bullets and particles, pickups, and Mama Lou's five missions.
// step() advances one fixed step and returns what happened as bit flags,
// so the caller can react (sound, screens, saves) without the world
// knowing about them. Nothing here allocates after createWorld returns,
// except the small pools the world reuses.

import {
  AVENUES, BOSS, CAR, ENFORCER, MISSIONS, PICKUP_SPOTS, PLACES, PLAYER,
  POLICE, STASH_SPOTS, STEP, VIEW, WANTED, WATER_X, WORLD,
} from './config.js';
import { buildCity, inWater, onRoad, randomRoadPoint, resolveBuildings, roadAt } from './city.js';
import { createRandom, pickOne } from './random.js';

export const EVENT_SHOT = 1;
export const EVENT_PUNCH = 2;
export const EVENT_CRASH = 4;
export const EVENT_PICKUP = 8;
export const EVENT_MISSION = 16;
export const EVENT_BUSTED = 32;
export const EVENT_WANTED = 64;
export const EVENT_COIN = 128;
export const EVENT_EXPLODE = 256;

const TAU = Math.PI * 2;

function angleTo(x0, y0, x1, y1) {
  return Math.atan2(y1 - y0, x1 - x0);
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return d;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function createWorld(seed) {
  const random = createRandom(seed);
  const city = buildCity(createRandom(seed + 7));
  const state = {
    time: 0,
    seed,
    mission: 0,
    missionStep: 0,
    stepCount: 0,
    cash: 0,
    health: PLAYER.health,
    ammo: PLAYER.ammoStart,
    wanted: 0,
    wantedTimer: 0,
    shootCrimeTimer: 0,
    busted: false,
    complete: false,
    missionDone: false,
    justCompleted: null,
    camera: { x: 0, y: 0 },
    shake: 0,
    player: {
      x: PLACES.diner.x, y: PLACES.diner.y + 140, angle: -Math.PI / 2,
      speed: 0, onFoot: true, car: null, invuln: 0, fireTimer: 0,
      punchTimer: 0, moving: false,
    },
    cars: [],
    peds: [],
    bullets: [],
    parts: [],
    skids: [],
    pickups: [],
    enemies: [],
    stashes: [],
    objective: null,
  };

  function freshCar(kind, x, y, angle) {
    return {
      x, y, angle, speed: 0, kind,
      color: kind === 'police' ? '#e8ecff' : pickOne(random, ['#e8ecff', '#ffd23e', '#22e6ff', '#ff2e88', '#3dff8e', '#ff7a2e', '#8e7bff', '#c9a86a', '#5ad1ff', '#ff5a5a']),
      health: kind === 'police' ? 120 : 60,
      driver: kind === 'police' ? 'police' : 'ai',
      lane: 0, cruise: 150 + random() * 120, stuck: 0, shootTimer: 0,
      wreck: false,
    };
  }

  function freshPed(x, y) {
    return {
      x, y, angle: random() * TAU, speed: 40 + random() * 40,
      shirt: pickOne(random, ['#ff5a5a', '#ffd23e', '#3dff8e', '#22e6ff', '#ff2e88', '#e8ecff', '#ff7a2e', '#8e7bff', '#7dffce', '#ffb3d1']),
      state: 'walk', downTimer: 0, fleeX: 0, fleeY: 0,
    };
  }

  function spawnPickup(kind, x, y) {
    state.pickups.push({ x, y, kind, active: true, respawn: 0 });
  }

  function reset() {
    state.time = 0;
    state.mission = 0;
    state.missionStep = 0;
    state.stepCount = 0;
    state.cash = 0;
    state.health = PLAYER.health;
    state.ammo = PLAYER.ammoStart;
    state.wanted = 0;
    state.wantedTimer = 0;
    state.shootCrimeTimer = 0;
    state.busted = false;
    state.complete = false;
    state.missionDone = false;
    state.justCompleted = null;
    state.shake = 0;
    state.player.x = PLACES.diner.x;
    state.player.y = PLACES.diner.y + 190;
    state.player.angle = -Math.PI / 2;
    state.player.speed = 0;
    state.player.onFoot = true;
    state.player.car = null;
    state.player.invuln = 0;
    state.player.fireTimer = 0;
    state.player.punchTimer = 0;
    state.player.moving = false;
    state.cars.length = 0;
    state.peds.length = 0;
    state.bullets.length = 0;
    state.parts.length = 0;
    state.skids.length = 0;
    state.pickups.length = 0;
    state.enemies.length = 0;
    state.stashes.length = 0;
    for (let i = 0; i < 13; i++) {
      const p = randomRoadPoint(random);
      const road = roadAt(p.x, p.y);
      const car = freshCar('traffic', p.x, p.y, road && road.axis === 'x' ? (random() < 0.5 ? 0 : Math.PI) : (random() < 0.5 ? Math.PI / 2 : -Math.PI / 2));
      state.cars.push(car);
    }
    for (let i = 0; i < 18; i++) {
      const p = randomRoadPoint(random);
      state.peds.push(freshPed(p.x + (random() - 0.5) * 90, p.y + (random() - 0.5) * 90));
    }
    for (const spot of PICKUP_SPOTS) spawnPickup(spot.kind, spot.x, spot.y);
    state.camera.x = clamp(state.player.x - VIEW.width / 2, 0, WORLD.width - VIEW.width);
    state.camera.y = clamp(state.player.y - VIEW.height / 2, 0, WORLD.height - VIEW.height);
    beginStep();
  }

  function addCrime() {
    if (state.wanted < WANTED.max) {
      state.wanted += 1;
      state.wantedTimer = 0;
      return EVENT_WANTED;
    }
    state.wantedTimer = 0;
    return 0;
  }

  function burst(x, y, color, count, speed, life, size) {
    for (let i = 0; i < count; i++) {
      if (state.parts.length > 320) return;
      const a = random() * TAU;
      const s = speed * (0.3 + random() * 0.7);
      state.parts.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: life * (0.5 + random() * 0.5), maxLife: life,
        color, size: size * (0.6 + random() * 0.8), kind: 'spark',
      });
    }
  }

  function smoke(x, y, count) {
    for (let i = 0; i < count; i++) {
      if (state.parts.length > 320) return;
      state.parts.push({
        x: x + (random() - 0.5) * 20, y: y + (random() - 0.5) * 20,
        vx: (random() - 0.5) * 20, vy: -20 - random() * 30,
        life: 0.9 + random() * 0.7, maxLife: 1.6,
        color: '#8a8a9a', size: 10 + random() * 10, kind: 'smoke',
      });
    }
  }

  function explode(x, y) {
    burst(x, y, '#ffd23e', 26, 320, 0.5, 5);
    burst(x, y, '#ff7a2e', 20, 240, 0.7, 7);
    burst(x, y, '#ff4757', 14, 160, 0.9, 9);
    smoke(x, y, 10);
    state.parts.push({ x, y, vx: 0, vy: 0, life: 0.45, maxLife: 0.45, color: '#ffd23e', size: 90, kind: 'ring' });
    state.shake = Math.min(14, state.shake + 10);
  }

  function nearestCar(x, y, maxDist, kinds) {
    let best = null;
    let bestD = maxDist * maxDist;
    for (const car of state.cars) {
      if (car.wreck) continue;
      if (kinds && !kinds.includes(car.kind)) continue;
      const d = dist2(x, y, car.x, car.y);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  function enterCar(car) {
    const p = state.player;
    if (car.kind === 'police') return false;
    if (car.driver === 'ai') {
      // The driver bails out and runs.
      state.peds.push(freshPed(car.x + 40, car.y + 30));
      const fled = state.peds[state.peds.length - 1];
      fled.state = 'flee';
      fled.fleeX = car.x;
      fled.fleeY = car.y;
      car.driver = 'none';
    }
    car.driver = 'player';
    p.car = car;
    p.onFoot = false;
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    return true;
  }

  function exitCar() {
    const p = state.player;
    const car = p.car;
    if (!car) return;
    car.driver = 'none';
    car.speed = 0;
    p.car = null;
    p.onFoot = true;
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 40;
    p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 40;
    p.angle = car.angle;
    p.speed = 0;
  }

  function damagePlayer(amount) {
    const p = state.player;
    if (p.invuln > 0) return 0;
    p.invuln = 0.6;
    state.health -= amount;
    burst(p.x, p.y, '#ff4757', 8, 160, 0.4, 4);
    if (state.health <= 0) {
      state.health = 0;
      state.busted = true;
      return EVENT_BUSTED;
    }
    return 0;
  }

  function damageCar(car, amount, fromPlayer) {
    car.health -= amount;
    if (car.health > 0) return 0;
    if (car.wreck) return 0;
    car.wreck = true;
    car.driver = 'none';
    explode(car.x, car.y);
    if (car === state.player.car) {
      exitCar();
      state.player.x = car.x + 60;
      state.player.y = car.y;
      return damagePlayer(20) | EVENT_EXPLODE;
    }
    if (fromPlayer) state.cash += 25;
    return EVENT_EXPLODE;
  }

  function updatePlayer(dt, input) {
    const p = state.player;
    let events = 0;
    if (p.invuln > 0) p.invuln -= dt;
    if (p.fireTimer > 0) p.fireTimer -= dt;
    if (p.punchTimer > 0) p.punchTimer -= dt;
    if (p.onFoot) {
      let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      let dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
      const len = Math.hypot(dx, dy);
      p.moving = len > 0;
      if (len > 0) {
        dx /= len;
        dy /= len;
        const speed = input.run ? PLAYER.run : PLAYER.walk;
        p.angle = Math.atan2(dy, dx);
        p.x += dx * speed * dt;
        p.y += dy * speed * dt;
      }
      const fixed = resolveBuildings(p.x, p.y, PLAYER.radius, city.buildings);
      p.x = fixed.x;
      p.y = fixed.y;
      p.x = clamp(p.x, 20, WATER_X - 16);
      p.y = clamp(p.y, 20, WORLD.height - 20);
      if (input.punch && p.punchTimer <= 0) {
        p.punchTimer = 0.35;
        events |= EVENT_PUNCH;
        for (const e of state.enemies) {
          if (dist2(p.x, p.y, e.x, e.y) < PLAYER.punchRange * PLAYER.punchRange &&
              Math.abs(angleDiff(angleTo(p.x, p.y, e.x, e.y), p.angle)) < PLAYER.punchArc) {
            e.health -= PLAYER.punchDamage;
            burst(e.x, e.y, '#ffd23e', 6, 140, 0.3, 4);
            if (e.health <= 0) killEnemy(e);
          }
        }
        for (const ped of state.peds) {
          if (ped.state !== 'down' && dist2(p.x, p.y, ped.x, ped.y) < 46 * 46) {
            ped.state = 'down';
            ped.downTimer = 6;
            events |= addCrime();
          }
        }
      }
      if (input.shoot && p.fireTimer <= 0 && state.ammo > 0) {
        p.fireTimer = PLAYER.fireDelay;
        state.ammo -= 1;
        const a = angleTo(p.x, p.y, input.aimX, input.aimY);
        state.bullets.push({
          x: p.x + Math.cos(a) * 20, y: p.y + Math.sin(a) * 20,
          vx: Math.cos(a) * PLAYER.bulletSpeed, vy: Math.sin(a) * PLAYER.bulletSpeed,
          life: 1.1, from: 'player', damage: PLAYER.bulletDamage,
        });
        state.parts.push({ x: p.x + Math.cos(a) * 24, y: p.y + Math.sin(a) * 24, vx: 0, vy: 0, life: 0.06, maxLife: 0.06, color: '#ffe9a8', size: 16, kind: 'flash' });
        events |= EVENT_SHOT;
        if (state.shootCrimeTimer <= 0) {
          state.shootCrimeTimer = WANTED.shootCooldown;
          events |= addCrime();
        }
      }
      if (input.steal) {
        const car = nearestCar(p.x, p.y, 78, ['traffic']);
        if (car) {
          const hadDriver = car.driver === 'ai';
          if (enterCar(car) && hadDriver) events |= addCrime();
        }
      }
    } else {
      const car = p.car;
      const steer = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      if (input.up) car.speed += CAR.accel * dt;
      else if (input.down) car.speed -= (car.speed > 0 ? CAR.brake : CAR.accel * 0.5) * dt;
      else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 320 * dt);
      car.speed = clamp(car.speed, -CAR.reverse, CAR.maxSpeed);
      const turnScale = clamp(Math.abs(car.speed) / 220, 0, 1) * Math.sign(car.speed);
      car.angle += steer * CAR.turn * turnScale * dt;
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      const fixed = resolveBuildings(nx, ny, 24, city.buildings);
      if (fixed.hit && Math.abs(car.speed) > 140) {
        events |= EVENT_CRASH;
        burst(car.x, car.y, '#ffd23e', 10, 200, 0.4, 4);
        events |= damageCar(car, 8, false);
        car.speed *= -0.25;
      } else if (fixed.hit) {
        car.speed *= 0.4;
      }
      car.x = clamp(fixed.x, 20, WATER_X - 26);
      car.y = clamp(fixed.y, 20, WORLD.height - 26);
      p.x = car.x;
      p.y = car.y;
      p.angle = car.angle;
      p.speed = car.speed;
      if (Math.abs(steer) > 0 && Math.abs(car.speed) > 300 && state.skids.length < 140) {
        state.skids.push({ x: car.x - Math.cos(car.angle) * 20, y: car.y - Math.sin(car.angle) * 20, angle: car.angle, life: 4 });
      }
      for (const other of state.cars) {
        if (other === car || other.wreck) continue;
        const d2 = dist2(car.x, car.y, other.x, other.y);
        if (d2 < 48 * 48) {
          const d = Math.sqrt(d2) || 1;
          const push = (48 - d) / 2;
          const ux = (other.x - car.x) / d;
          const uy = (other.y - car.y) / d;
          other.x += ux * push;
          other.y += uy * push;
          if (Math.abs(car.speed) > 200) {
            events |= EVENT_CRASH;
            burst(car.x, car.y, '#ffd23e', 8, 180, 0.35, 4);
            events |= damageCar(other, 6, true);
            car.speed *= 0.7;
          }
        }
      }
      for (const ped of state.peds) {
        if (ped.state !== 'down' && Math.abs(car.speed) > 60 && dist2(car.x, car.y, ped.x, ped.y) < 30 * 30) {
          ped.state = 'down';
          ped.downTimer = 6;
          events |= addCrime();
          events |= EVENT_CRASH;
        }
      }
      if (input.steal) exitCar();
    }
    return events;
  }

  function killEnemy(e) {
    burst(e.x, e.y, '#ff4757', 12, 200, 0.5, 5);
    burst(e.x, e.y, '#ffd23e', 8, 160, 0.4, 4);
    const idx = state.enemies.indexOf(e);
    if (idx >= 0) state.enemies.splice(idx, 1);
    state.stepCount += 1;
    state.cash += e.kind === 'boss' ? 200 : 50;
    if (e.kind === 'boss') state.bossDead = true;
  }

  function updateTraffic(dt) {
    for (const car of state.cars) {
      if (car.kind !== 'traffic' || car.wreck || car.driver !== 'ai') continue;
      const road = roadAt(car.x, car.y);
      if (road) {
        const want = road.axis === 'x' ? (Math.cos(car.angle) >= 0 ? 0 : Math.PI) : (Math.sin(car.angle) >= 0 ? Math.PI / 2 : -Math.PI / 2);
        const diff = angleDiff(want, car.angle);
        car.angle += clamp(diff, -1.6 * dt, 1.6 * dt);
        let blocked = false;
        for (const other of state.cars) {
          if (other === car || other.wreck) continue;
          const ahead = (other.x - car.x) * Math.cos(car.angle) + (other.y - car.y) * Math.sin(car.angle);
          const side = Math.abs((other.x - car.x) * Math.sin(car.angle) - (other.y - car.y) * Math.cos(car.angle));
          if (ahead > 0 && ahead < 64 && side < 26) {
            blocked = true;
            break;
          }
        }
        const target = blocked ? 0 : car.cruise;
        car.speed += clamp(target - car.speed, -500 * dt, 320 * dt);
      } else {
        // Pushed off the road: head for the nearest avenue.
        let best = AVENUES[0];
        for (const ax of AVENUES) if (Math.abs(ax - car.x) < Math.abs(best - car.x)) best = ax;
        const want = angleTo(car.x, car.y, best, car.y);
        const diff = angleDiff(want, car.angle);
        car.angle += clamp(diff, -2 * dt, 2 * dt);
        car.speed = Math.min(car.speed + 200 * dt, 160);
      }
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      const fixed = resolveBuildings(car.x, car.y, 22, city.buildings);
      car.x = clamp(fixed.x, 20, WATER_X - 24);
      car.y = clamp(fixed.y, 20, WORLD.height - 24);
      if (random() < 0.0015) {
        const road2 = roadAt(car.x, car.y);
        if (road2) {
          const turn = road2.axis === 'x' ? (random() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (random() < 0.5 ? 0 : Math.PI);
          car.angle = turn;
        }
      }
    }
    let trafficCount = 0;
    for (const car of state.cars) if (car.kind === 'traffic' && !car.wreck) trafficCount++;
    if (trafficCount < 13 && random() < 0.02) {
      const p = randomRoadPoint(random);
      if (dist2(p.x, p.y, state.player.x, state.player.y) > 600 * 600) {
        const road = roadAt(p.x, p.y);
        state.cars.push(freshCar('traffic', p.x, p.y, road && road.axis === 'x' ? (random() < 0.5 ? 0 : Math.PI) : (random() < 0.5 ? Math.PI / 2 : -Math.PI / 2)));
      }
    }
    for (let i = state.cars.length - 1; i >= 0; i--) {
      const car = state.cars[i];
      if (car.kind === 'traffic' && car.driver === 'ai' && dist2(car.x, car.y, state.player.x, state.player.y) > 1500 * 1500) {
        state.cars.splice(i, 1);
      }
    }
  }

  function updatePeds(dt) {
    for (const ped of state.peds) {
      if (ped.state === 'down') {
        ped.downTimer -= dt;
        if (ped.downTimer <= 0) {
          ped.state = 'flee';
          ped.fleeX = state.player.x;
          ped.fleeY = state.player.y;
        }
        continue;
      }
      if (ped.state === 'flee') {
        const a = angleTo(ped.fleeX, ped.fleeY, ped.x, ped.y);
        ped.angle = a;
        ped.x += Math.cos(a) * 250 * dt;
        ped.y += Math.sin(a) * 250 * dt;
        if (dist2(ped.x, ped.y, ped.fleeX, ped.fleeY) > 500 * 500) ped.state = 'walk';
      } else {
        if (random() < 0.004) ped.angle += (random() - 0.5) * 2.4;
        ped.x += Math.cos(ped.angle) * ped.speed * dt;
        ped.y += Math.sin(ped.angle) * ped.speed * dt;
        if (onRoad(ped.x, ped.y) && random() < 0.01) ped.angle += Math.PI / 2 * (random() < 0.5 ? 1 : -1);
      }
      const fixed = resolveBuildings(ped.x, ped.y, 10, city.buildings);
      if (fixed.hit) ped.angle += Math.PI;
      ped.x = clamp(fixed.x, 20, WATER_X - 12);
      ped.y = clamp(fixed.y, 20, WORLD.height - 20);
    }
    let count = 0;
    for (const ped of state.peds) if (ped.state !== 'down') count++;
    if (count < 16 && random() < 0.03) {
      const p = randomRoadPoint(random);
      if (dist2(p.x, p.y, state.player.x, state.player.y) > 500 * 500) {
        state.peds.push(freshPed(p.x, p.y));
      }
    }
  }

  function updatePolice(dt) {
    const want = state.wanted > 0 ? Math.min(state.wanted, 4) + (state.wanted >= 4 ? 1 : 0) : 0;
    let have = 0;
    for (const car of state.cars) if (car.kind === 'police' && !car.wreck) have++;
    if (have < want) {
      for (let tries = 0; tries < 6 && have < want; tries++) {
        const p = randomRoadPoint(random);
        const d = dist2(p.x, p.y, state.player.x, state.player.y);
        if (d > 600 * 600 && d < 1100 * 1100) {
          const car = freshCar('police', p.x, p.y, angleTo(p.x, p.y, state.player.x, state.player.y));
          car.cruise = POLICE.speed + POLICE.speedPerStar * state.wanted;
          state.cars.push(car);
          have++;
        }
      }
    }
    for (const car of state.cars) {
      if (car.kind !== 'police' || car.wreck) continue;
      const p = state.player;
      const targetAngle = angleTo(car.x, car.y, p.x, p.y);
      const diff = angleDiff(targetAngle, car.angle);
      car.angle += clamp(diff, -2.4 * dt, 2.4 * dt);
      const top = POLICE.speed + POLICE.speedPerStar * state.wanted;
      car.speed = Math.min(car.speed + 500 * dt, top);
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      const fixed = resolveBuildings(car.x, car.y, 22, city.buildings);
      car.x = clamp(fixed.x, 20, WATER_X - 24);
      car.y = clamp(fixed.y, 20, WORLD.height - 24);
      const d = Math.sqrt(dist2(car.x, car.y, p.x, p.y));
      if (d < 46) {
        if (p.onFoot) {
          state.busted = true;
          return EVENT_BUSTED;
        }
        if (car.shootTimer <= 0) {
          car.shootTimer = 0.6;
          burst(car.x, car.y, '#ffd23e', 8, 180, 0.35, 4);
          state.shake = Math.min(10, state.shake + 4);
          if (p.car) damageCar(p.car, POLICE.ramDamage, false);
        }
      }
      if (car.shootTimer > 0) car.shootTimer -= dt;
      if (state.wanted >= POLICE.shootAtStars && d < POLICE.shootRange && d > 90) {
        if (car.shootTimer <= 0) {
          car.shootTimer = POLICE.shootDelay;
          const a = targetAngle + (random() - 0.5) * 0.3;
          state.bullets.push({
            x: car.x + Math.cos(a) * 28, y: car.y + Math.sin(a) * 28,
            vx: Math.cos(a) * 780, vy: Math.sin(a) * 780,
            life: 1.0, from: 'police', damage: POLICE.bulletDamage,
          });
        }
      }
    }
    if (state.wanted === 0) {
      for (let i = state.cars.length - 1; i >= 0; i--) {
        if (state.cars[i].kind === 'police') state.cars.splice(i, 1);
      }
    }
    return 0;
  }

  function updateEnemies(dt) {
    const p = state.player;
    for (const e of [...state.enemies]) {
      const d = Math.sqrt(dist2(e.x, e.y, p.x, p.y));
      if (d < 520) {
        e.angle = angleTo(e.x, e.y, p.x, p.y);
        e.x += Math.cos(e.angle) * e.speed * dt;
        e.y += Math.sin(e.angle) * e.speed * dt;
        const fixed = resolveBuildings(e.x, e.y, 12, city.buildings);
        e.x = clamp(fixed.x, 20, WATER_X - 14);
        e.y = clamp(fixed.y, 20, WORLD.height - 20);
        e.shootTimer -= dt;
        if (d < 380 && e.shootTimer <= 0) {
          e.shootTimer = e.kind === 'boss' ? BOSS.shootDelay : ENFORCER.shootDelay;
          const a = e.angle + (random() - 0.5) * 0.24;
          state.bullets.push({
            x: e.x + Math.cos(a) * 20, y: e.y + Math.sin(a) * 20,
            vx: Math.cos(a) * 700, vy: Math.sin(a) * 700,
            life: 1.0, from: 'enemy', damage: e.kind === 'boss' ? BOSS.bulletDamage : ENFORCER.bulletDamage,
          });
        }
      }
    }
  }

  function updateBullets(dt) {
    let events = 0;
    for (let i = state.bullets.length - 1; i >= 0; i--) {
      const b = state.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      let dead = b.life <= 0 || b.x < 0 || b.y < 0 || b.x > WORLD.width || b.y > WORLD.height;
      if (!dead) {
        for (const building of city.buildings) {
          if (b.x > building.x && b.x < building.x + building.w && b.y > building.y && b.y < building.y + building.h) {
            burst(b.x, b.y, '#ffd23e', 4, 120, 0.25, 3);
            dead = true;
            break;
          }
        }
      }
      if (!dead && b.from === 'player') {
        for (const e of [...state.enemies]) {
          if (dist2(b.x, b.y, e.x, e.y) < 18 * 18) {
            e.health -= b.damage;
            burst(b.x, b.y, '#ff4757', 5, 140, 0.3, 4);
            dead = true;
            if (e.health <= 0) killEnemy(e);
            break;
          }
        }
        if (!dead) {
          for (const car of state.cars) {
            if (car.wreck || car === state.player.car) continue;
            if (dist2(b.x, b.y, car.x, car.y) < 26 * 26) {
              events |= damageCar(car, b.damage, true);
              burst(b.x, b.y, '#ffd23e', 5, 140, 0.3, 4);
              dead = true;
              break;
            }
          }
        }
        if (!dead) {
          for (const ped of state.peds) {
            if (ped.state !== 'down' && dist2(b.x, b.y, ped.x, ped.y) < 14 * 14) {
              ped.state = 'down';
              ped.downTimer = 6;
              dead = true;
              break;
            }
          }
        }
      }
      if (!dead && (b.from === 'enemy' || b.from === 'police')) {
        const p = state.player;
        if (p.onFoot) {
          if (dist2(b.x, b.y, p.x, p.y) < 16 * 16) {
            events |= damagePlayer(b.damage);
            dead = true;
          }
        } else if (p.car && dist2(b.x, b.y, p.car.x, p.car.y) < 28 * 28) {
          events |= damageCar(p.car, b.damage, false);
          dead = true;
        }
      }
      if (dead) state.bullets.splice(i, 1);
    }
    return events;
  }

  function updateParticles(dt) {
    for (let i = state.parts.length - 1; i >= 0; i--) {
      const part = state.parts[i];
      part.life -= dt;
      part.x += part.vx * dt;
      part.y += part.vy * dt;
      if (part.kind === 'smoke') part.size += 14 * dt;
      if (part.life <= 0) state.parts.splice(i, 1);
    }
    for (let i = state.skids.length - 1; i >= 0; i--) {
      state.skids[i].life -= dt;
      if (state.skids[i].life <= 0) state.skids.splice(i, 1);
    }
    if (state.shake > 0) state.shake = Math.max(0, state.shake - 30 * dt);
  }

  function updatePickups(dt) {
    let events = 0;
    const p = state.player;
    for (const pickup of state.pickups) {
      if (!pickup.active) {
        pickup.respawn -= dt;
        if (pickup.respawn <= 0) pickup.active = true;
        continue;
      }
      if (dist2(p.x, p.y, pickup.x, pickup.y) > 34 * 34) continue;
      pickup.active = false;
      pickup.respawn = 20;
      if (pickup.kind === 'health') {
        state.health = Math.min(PLAYER.health, state.health + 30);
        events |= EVENT_PICKUP;
      } else if (pickup.kind === 'repair' && p.car) {
        p.car.health = Math.min(CAR.health, p.car.health + 50);
        p.car.wreck = false;
        events |= EVENT_PICKUP;
      } else if (pickup.kind === 'cash') {
        state.cash += 50;
        events |= EVENT_COIN;
      } else if (pickup.kind === 'ammo') {
        state.ammo = Math.min(PLAYER.ammoMax, state.ammo + 12);
        events |= EVENT_PICKUP;
      }
    }
    for (const stash of state.stashes) {
      if (stash.taken) continue;
      if (dist2(p.x, p.y, stash.x, stash.y) < 56 * 56) {
        stash.taken = true;
        state.stepCount += 1;
        state.cash += 100;
        burst(stash.x, stash.y, '#ffd23e', 12, 180, 0.5, 5);
        events |= EVENT_COIN;
      }
    }
    return events;
  }

  function spawnEnemies(kind, count, cx, cy) {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU + random() * 0.5;
      const r = 90 + random() * 120;
      state.enemies.push({
        x: clamp(cx + Math.cos(a) * r, 60, WORLD.width - 60),
        y: clamp(cy + Math.sin(a) * r, 60, WORLD.height - 60),
        angle: 0, health: kind === 'boss' ? BOSS.health : ENFORCER.health,
        kind, speed: kind === 'boss' ? BOSS.speed : ENFORCER.speed,
        shootTimer: 0.5 + random(),
      });
    }
  }

  function beginStep() {
    const mission = MISSIONS[state.mission];
    if (!mission) return;
    const step = mission.steps[state.missionStep];
    state.stepCount = 0;
    state.bossDead = false;
    if (state.missionStep === 0 && mission.heat) {
      state.wanted = mission.heat;
      state.wantedTimer = 0;
    }
    if (!step) {
      state.objective = null;
      return;
    }
    if (step.type === 'defeat') {
      spawnEnemies('enforcer', step.count, step.x, step.y);
      state.objective = { x: step.x, y: step.y, label: step.label };
    } else if (step.type === 'boss') {
      spawnEnemies('boss', 1, step.x ?? PLACES.strip.x, step.y ?? PLACES.strip.y);
      spawnEnemies('enforcer', 4, PLACES.strip.x, PLACES.strip.y);
      state.objective = { x: PLACES.strip.x, y: PLACES.strip.y, label: step.label };
    } else if (step.type === 'collect') {
      state.stashes.length = 0;
      for (const spot of STASH_SPOTS) state.stashes.push({ x: spot.x, y: spot.y, taken: false });
      state.objective = { x: STASH_SPOTS[0].x, y: STASH_SPOTS[0].y, label: step.label };
    } else if (step.type === 'goto') {
      state.objective = { x: step.x, y: step.y, label: step.label };
    } else {
      state.objective = null;
    }
  }

  function checkMission() {
    const mission = MISSIONS[state.mission];
    if (!mission || state.missionDone || state.complete) return 0;
    const step = mission.steps[state.missionStep];
    if (!step) return 0;
    let done = false;
    if (step.type === 'steal') done = !state.player.onFoot;
    else if (step.type === 'goto') done = dist2(state.player.x, state.player.y, step.x, step.y) < 100 * 100;
    else if (step.type === 'defeat') done = state.stepCount >= step.count;
    else if (step.type === 'loseheat') done = state.wanted === 0;
    else if (step.type === 'collect') done = state.stepCount >= step.count;
    else if (step.type === 'boss') done = state.bossDead === true;
    if (!done) return 0;
    state.missionStep += 1;
    if (state.missionStep >= mission.steps.length) {
      state.cash += mission.reward;
      state.justCompleted = mission;
      state.missionDone = true;
      return EVENT_MISSION;
    }
    beginStep();
    return 0;
  }

  function advanceMission() {
    state.missionDone = false;
    state.justCompleted = null;
    state.mission += 1;
    state.missionStep = 0;
    if (state.mission >= MISSIONS.length) {
      state.complete = true;
      return;
    }
    beginStep();
  }

  function updateCamera(dt) {
    const p = state.player;
    const tx = clamp(p.x - VIEW.width / 2, 0, WORLD.width - VIEW.width);
    const ty = clamp(p.y - VIEW.height / 2, 0, WORLD.height - VIEW.height);
    state.camera.x += (tx - state.camera.x) * Math.min(1, 6 * dt);
    state.camera.y += (ty - state.camera.y) * Math.min(1, 6 * dt);
  }

  function step(dt, input, harmless) {
    let events = 0;
    state.time += dt;
    if (harmless) {
      updateTraffic(dt);
      updatePeds(dt);
      updateParticles(dt);
      updateCamera(dt);
      return 0;
    }
    if (state.busted || state.complete) {
      updateParticles(dt);
      return 0;
    }
    if (state.shootCrimeTimer > 0) state.shootCrimeTimer -= dt;
    if (state.wanted > 0) {
      state.wantedTimer += dt;
      if (state.wantedTimer >= WANTED.decaySeconds) {
        state.wanted -= 1;
        state.wantedTimer = 0;
      }
    }
    events |= updatePlayer(dt, input);
    if (state.busted) return events | EVENT_BUSTED;
    updateTraffic(dt);
    updatePeds(dt);
    events |= updatePolice(dt);
    if (state.busted) return events | EVENT_BUSTED;
    updateEnemies(dt);
    events |= updateBullets(dt);
    if (state.busted) return events | EVENT_BUSTED;
    updateParticles(dt);
    events |= updatePickups(dt);
    events |= checkMission();
    updateCamera(dt);
    return events;
  }

  function getSave() {
    return { cash: state.cash, mission: state.mission, health: state.health };
  }

  function applySave(save) {
    reset();
    state.cash = save.cash || 0;
    state.mission = Math.min(save.mission || 0, MISSIONS.length - 1);
    state.health = save.health || PLAYER.health;
    state.missionStep = 0;
    state.missionDone = false;
    beginStep();
  }

  reset();
  return { state, city, reset, step, advanceMission, getSave, applySave };
}
