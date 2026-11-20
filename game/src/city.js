// Neon Bay itself, built once from a seed: the road grid, the blocks of
// buildings with their neon signs, the beach and water to the east, Palm
// Park, the marina and the south docks. Nothing here draws or moves; it
// only describes the city, and answers where things are and what they hit.

import {
  AVENUES, BEACH_X, CAR_COLORS, PALETTE, PLACES, ROAD_WIDTH,
  SIGN_COLORS, SIGN_NAMES, STREETS, WATER_X, WORLD,
} from './config.js';
import { pickInt, pickOne } from './random.js';

const BUILDING_COLORS = ['#2b2b4a', '#33335c', '#262640', '#3d3d68', '#2e2a4e', '#40355e'];
const ROOF_COLORS = ['#3d3d68', '#4a4a7a', '#36365e', '#524a80'];
const CONTAINER_COLORS = ['#c96a3b', '#3b7ec9', '#4caf6d', '#c9b23b', '#8e5fc9'];

function blockRanges() {
  const xs = [0, ...AVENUES.flatMap((a) => [a - ROAD_WIDTH / 2, a + ROAD_WIDTH / 2]), WORLD.width];
  const ys = [0, ...STREETS.flatMap((s) => [s - ROAD_WIDTH / 2, s + ROAD_WIDTH / 2]), WORLD.height];
  const out = [];
  for (let i = 0; i < xs.length; i += 2) {
    for (let j = 0; j < ys.length; j += 2) {
      out.push({ x0: xs[i], y0: ys[j], x1: xs[i + 1], y1: ys[j + 1] });
    }
  }
  return out;
}

function overlapsPark(b) {
  const p = PLACES.park;
  return b.x0 < p.x + p.w / 2 && b.x1 > p.x - p.w / 2 && b.y0 < p.y + p.h / 2 && b.y1 > p.y - p.h / 2;
}

function overlapsWater(b) {
  return b.x1 > BEACH_X;
}

export function buildCity(random) {
  const buildings = [];
  const trees = [];
  const lamps = [];
  const boats = [];
  const containers = [];

  for (const block of blockRanges()) {
    if (overlapsPark(block)) continue;
    const bw = block.x1 - block.x0;
    const bh = block.y1 - block.y0;
    if (bw < 140 || bh < 120) continue;
    if (overlapsWater(block)) continue;
    // The south docks block holds containers instead of buildings.
    if (block.y0 >= 1960 && block.x0 >= 1600 && block.x1 <= 2200) {
      for (let i = 0; i < 6; i++) {
        containers.push({
          x: block.x0 + 30 + (i % 3) * 150,
          y: block.y0 + 30 + Math.floor(i / 3) * 130,
          w: 120, h: 70,
          color: CONTAINER_COLORS[i % CONTAINER_COLORS.length],
        });
      }
      continue;
    }
    const count = bw > 380 && bh > 280 ? 2 + pickInt(random, 2) : 1 + pickInt(random, 2);
    for (let i = 0; i < count; i++) {
      const cols = count === 1 ? 1 : 2;
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cellW = bw / cols;
      const cellH = bh / Math.ceil(count / cols);
      const w = Math.min(cellW - 36, 120 + random() * 150);
      const h = Math.min(cellH - 36, 100 + random() * 120);
      const x = block.x0 + col * cellW + 18 + random() * Math.max(0, cellW - w - 36);
      const y = block.y0 + row * cellH + 18 + random() * Math.max(0, cellH - h - 36);
      const sign = random() < 0.62 ? {
        text: pickOne(random, SIGN_NAMES),
        color: pickOne(random, SIGN_COLORS),
      } : null;
      buildings.push({
        x, y, w, h,
        color: pickOne(random, BUILDING_COLORS),
        roof: pickOne(random, ROOF_COLORS),
        sign,
        tall: random() < 0.25,
      });
    }
  }

  // Lou's Diner and Rico's Hideout get their own signed buildings.
  // Both sit beside the road, never on it: the diner fronts avenue 400
  // from the east, the hideout sits south-east of the avenue 2200 /
  // street 1900 corner, so the roads stay drivable and the mission
  // targets (the diner door, the hideout door) stay reachable.
  buildings.push({
    x: PLACES.diner.x + 70, y: PLACES.diner.y - 55, w: 180, h: 110,
    color: '#4a2b3d', roof: '#6b3a52',
    sign: { text: "LOU'S DINER", color: PALETTE.neonPink }, tall: false,
  });
  buildings.push({
    x: PLACES.hideout.x + 130, y: PLACES.hideout.y + 100, w: 160, h: 100,
    color: '#2b3d4a', roof: '#3d5a68',
    sign: { text: 'HIDEOUT', color: PALETTE.neonCyan }, tall: false,
  });

  // Palm trees scattered through the park.
  const park = PLACES.park;
  for (let i = 0; i < 16; i++) {
    trees.push({
      x: park.x - park.w / 2 + 30 + random() * (park.w - 60),
      y: park.y - park.h / 2 + 30 + random() * (park.h - 60),
      r: 9 + random() * 5,
    });
  }

  // Street lamps at every intersection.
  for (const ax of AVENUES) {
    for (const sy of STREETS) {
      lamps.push({ x: ax - ROAD_WIDTH / 2 - 8, y: sy - ROAD_WIDTH / 2 - 8 });
      lamps.push({ x: ax + ROAD_WIDTH / 2 + 8, y: sy + ROAD_WIDTH / 2 + 8 });
    }
  }

  // Boats moored off the marina, and a couple of planks to walk out on.
  for (let i = 0; i < 4; i++) {
    boats.push({
      x: 3020 + random() * 120,
      y: 300 + i * 130 + random() * 40,
      angle: (random() - 0.5) * 0.5,
      len: 56 + random() * 26,
      color: pickOne(random, CAR_COLORS),
    });
  }

  return { buildings, trees, lamps, boats, containers, park };
}

/** True when a point is on a road (an avenue or a street band). */
export function onRoad(x, y) {
  for (const ax of AVENUES) if (Math.abs(x - ax) <= ROAD_WIDTH / 2) return true;
  for (const sy of STREETS) if (Math.abs(y - sy) <= ROAD_WIDTH / 2) return true;
  return false;
}

/**
 * The road a point sits on, if any: which way it runs and the coordinate of
 * its centre line. Traffic drives on the right, so a car picks its lane
 * from the direction it travels.
 */
export function roadAt(x, y) {
  let best = null;
  for (const ax of AVENUES) {
    const d = Math.abs(x - ax);
    if (d <= ROAD_WIDTH / 2 && (best === null || d < best.d)) best = { axis: 'y', line: ax, d };
  }
  for (const sy of STREETS) {
    const d = Math.abs(y - sy);
    if (d <= ROAD_WIDTH / 2 && (best === null || d < best.d)) best = { axis: 'x', line: sy, d };
  }
  return best;
}

/** True when a point is in the water east of the beach. */
export function inWater(x, y) {
  return x >= WATER_X && y >= 0 && y <= WORLD.height;
}

/** Push a circle out of every building it overlaps; returns true on a hit. */
export function resolveBuildings(x, y, radius, buildings) {
  let hit = null;
  for (const b of buildings) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - cx;
    const dy = y - cy;
    const dist2 = dx * dx + dy * dy;
    if (dist2 >= radius * radius) continue;
    hit = b;
    if (dist2 > 0.01) {
      const dist = Math.sqrt(dist2);
      x += (dx / dist) * (radius - dist);
      y += (dy / dist) * (radius - dist);
    } else {
      // Dead centre of a building: push out along the shortest side.
      const left = x - b.x + radius;
      const right = b.x + b.w - x + radius;
      const top = y - b.y + radius;
      const bottom = b.y + b.h - y + radius;
      const m = Math.min(left, right, top, bottom);
      if (m === left) x = b.x - radius;
      else if (m === right) x = b.x + b.w + radius;
      else if (m === top) y = b.y - radius;
      else y = b.y + b.h + radius;
    }
  }
  return { x, y, hit };
}

/** A random point on a road, for spawning traffic and pedestrians. */
export function randomRoadPoint(random) {
  if (random() < 0.5) {
    const ax = pickOne(random, AVENUES);
    return { x: ax + (random() - 0.5) * (ROAD_WIDTH - 30), y: 60 + random() * (WORLD.height - 120) };
  }
  const sy = pickOne(random, STREETS);
  return { x: 60 + random() * (WORLD.width - 220), y: sy + (random() - 0.5) * (ROAD_WIDTH - 30) };
}
