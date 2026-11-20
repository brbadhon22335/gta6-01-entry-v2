// Drawing only: the city, its cars and people, the effects, the HUD with
// its minimap and mission tracker, and the menu screens. The camera shows
// a 1280 by 800 window of the world, scaled to fit the browser window.
// Dusk light: warm dark streets, neon signs that glow, headlight cones,
// long soft shadows under the buildings.

import {
  AVENUES, CAR, MISSIONS, PALETTE, PLACES, ROAD_WIDTH, STREETS,
  VIEW, WATER_X, WORLD,
} from './config.js';
import { inWater } from './city.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_MISSION = 'mission';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_COMPLETE = 'complete';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const MINIMAP = { x: VIEW.width - 210, y: VIEW.height - 170, w: 190, h: 150 };

function starPoints(cx, cy, r, points = 5) {
  const out = [];
  for (let i = 0; i < points * 2; i++) {
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    out.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  return out;
}

export function createRenderer(canvas, city) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW.width, height / VIEW.height);
    view.x = (width - VIEW.width * view.scale) / 2;
    view.y = (height - VIEW.height * view.scale) / 2;
  }

  function text(value, x, y, size, color, align = 'left', bold = false) {
    const key = `${size}:${bold ? 1 : 0}`;
    if (!fonts.has(key)) fonts.set(key, `${bold ? '700 ' : ''}${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  function glowText(value, x, y, size, color, align = 'center') {
    context.save();
    context.shadowColor = color;
    context.shadowBlur = 16;
    text(value, x, y, size, color, align, true);
    context.restore();
    text(value, x, y, size, '#ffffff', align, true);
  }

  function inView(x, y, margin = 80) {
    const cam = lastCamera;
    return x > cam.x - margin && x < cam.x + VIEW.width + margin && y > cam.y - margin && y < cam.y + VIEW.height + margin;
  }

  let lastCamera = { x: 0, y: 0 };

  function drawGround() {
    context.fillStyle = PALETTE.ground;
    context.fillRect(0, 0, WORLD.width, WORLD.height);
    // Water and beach along the east edge.
    context.fillStyle = PALETTE.sand;
    context.fillRect(2860, 0, WATER_X - 2860, WORLD.height);
    context.fillStyle = PALETTE.water;
    context.fillRect(WATER_X, 0, WORLD.width - WATER_X, WORLD.height);
    context.fillStyle = PALETTE.waterDeep;
    for (let y = 40; y < WORLD.height; y += 130) {
      context.fillRect(WATER_X + 30, y, 120, 6);
      context.fillRect(WATER_X + 150, y + 65, 90, 5);
    }
    // Palm Park.
    const park = PLACES.park;
    context.fillStyle = PALETTE.park;
    context.fillRect(park.x - park.w / 2, park.y - park.h / 2, park.w, park.h);
    context.strokeStyle = '#2a7a44';
    context.lineWidth = 4;
    context.strokeRect(park.x - park.w / 2, park.y - park.h / 2, park.w, park.h);
  }

  function drawRoads() {
    context.fillStyle = PALETTE.road;
    for (const ax of AVENUES) context.fillRect(ax - ROAD_WIDTH / 2, 0, ROAD_WIDTH, WORLD.height);
    for (const sy of STREETS) context.fillRect(0, sy - ROAD_WIDTH / 2, WORLD.width, ROAD_WIDTH);
    context.fillStyle = PALETTE.sidewalk;
    for (const ax of AVENUES) {
      context.fillRect(ax - ROAD_WIDTH / 2, 0, 8, WORLD.height);
      context.fillRect(ax + ROAD_WIDTH / 2 - 8, 0, 8, WORLD.height);
    }
    for (const sy of STREETS) {
      context.fillRect(0, sy - ROAD_WIDTH / 2, WORLD.width, 8);
      context.fillRect(0, sy + ROAD_WIDTH / 2 - 8, WORLD.width, 8);
    }
    // Lane dashes.
    context.fillStyle = PALETTE.lane;
    for (const ax of AVENUES) {
      for (let y = 0; y < WORLD.height; y += 90) context.fillRect(ax - 2, y, 4, 44);
    }
    for (const sy of STREETS) {
      for (let x = 0; x < WORLD.width; x += 90) context.fillRect(x, sy - 2, 44, 4);
    }
    // Crosswalks at intersections.
    context.fillStyle = 'rgba(232,236,255,0.55)';
    for (const ax of AVENUES) {
      for (const sy of STREETS) {
        for (let i = -3; i <= 3; i++) {
          context.fillRect(ax + i * 16 - 5, sy - ROAD_WIDTH / 2 + 10, 10, 26);
          context.fillRect(ax + i * 16 - 5, sy + ROAD_WIDTH / 2 - 36, 10, 26);
        }
      }
    }
  }

  function drawCity() {
    drawGround();
    drawRoads();
    // Marina planks and boats.
    context.fillStyle = '#6b4a2b';
    context.fillRect(2820, 360, 150, 14);
    context.fillRect(2820, 520, 150, 14);
    for (const boat of city.boats) {
      if (!inView(boat.x, boat.y, 120)) continue;
      context.save();
      context.translate(boat.x, boat.y);
      context.rotate(boat.angle);
      context.fillStyle = boat.color;
      context.beginPath();
      context.moveTo(-boat.len / 2, 0);
      context.lineTo(boat.len / 2, -12);
      context.lineTo(boat.len / 2, 12);
      context.closePath();
      context.fill();
      context.fillStyle = '#e8ecff';
      context.fillRect(-8, -7, 16, 14);
      context.restore();
    }
    // Containers at the docks.
    for (const c of city.containers) {
      context.fillStyle = c.color;
      context.fillRect(c.x, c.y, c.w, c.h);
      context.strokeStyle = 'rgba(0,0,0,0.4)';
      context.lineWidth = 2;
      context.strokeRect(c.x, c.y, c.w, c.h);
    }
    // Buildings: soft dusk shadow, roof, lit windows, neon sign.
    for (const b of city.buildings) {
      if (!inView(b.x + b.w / 2, b.y + b.h / 2, 160)) continue;
      context.fillStyle = 'rgba(0,0,0,0.35)';
      context.fillRect(b.x + 14, b.y + 18, b.w, b.h);
      context.fillStyle = b.color;
      context.fillRect(b.x, b.y, b.w, b.h);
      context.fillStyle = b.roof;
      context.fillRect(b.x + 8, b.y + 8, b.w - 16, b.h - 16);
      context.fillStyle = 'rgba(255,210,62,0.75)';
      const cols = Math.floor(b.w / 34);
      const rows = Math.floor(b.h / 40);
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          if ((i * 7 + j * 13 + b.x) % 3 === 0) {
            context.fillRect(b.x + 14 + i * 34, b.y + 16 + j * 40, 12, 16);
          }
        }
      }
      if (b.sign) {
        const cx = b.x + b.w / 2;
        const cy = b.y + 26;
        context.save();
        context.shadowColor = b.sign.color;
        context.shadowBlur = 14;
        text(b.sign.text, cx, cy, Math.min(24, Math.max(13, b.w / (b.sign.text.length * 0.72))), b.sign.color, 'center', true);
        context.restore();
      }
    }
    // Palm trees.
    for (const t of city.trees) {
      if (!inView(t.x, t.y, 60)) continue;
      context.strokeStyle = '#6b4a2b';
      context.lineWidth = 4;
      context.beginPath();
      context.moveTo(t.x, t.y);
      context.lineTo(t.x + 4, t.y - 16);
      context.stroke();
      context.fillStyle = PALETTE.parkTree;
      context.beginPath();
      context.arc(t.x + 4, t.y - 20, t.r, 0, Math.PI * 2);
      context.fill();
    }
    // Street lamps glow.
    for (const lamp of city.lamps) {
      if (!inView(lamp.x, lamp.y, 40)) continue;
      context.fillStyle = 'rgba(255,210,62,0.9)';
      context.beginPath();
      context.arc(lamp.x, lamp.y, 4, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawCarShape(car, isPlayer) {
    context.save();
    context.translate(car.x, car.y);
    context.rotate(car.angle);
    if (car.wreck) context.globalAlpha = 0.85;
    context.fillStyle = 'rgba(0,0,0,0.4)';
    context.fillRect(-24, -10, 52, 28);
    context.fillStyle = car.wreck ? '#1a1a1a' : car.color;
    context.beginPath();
    context.roundRect(-26, -13, 52, 26, 7);
    context.fill();
    context.fillStyle = car.wreck ? '#222' : '#0e1a2e';
    context.beginPath();
    context.roundRect(-8, -10, 18, 20, 4);
    context.fill();
    if (car.kind === 'police') {
      context.fillStyle = '#0b0b18';
      context.fillRect(-26, -13, 52, 8);
      context.fillStyle = '#ff4757';
      context.fillRect(-6, -15, 6, 5);
      context.fillStyle = '#22e6ff';
      context.fillRect(2, -15, 6, 5);
    }
    if (isPlayer) {
      context.strokeStyle = PALETTE.neonPink;
      context.lineWidth = 2;
      context.beginPath();
      context.roundRect(-26, -13, 52, 26, 7);
      context.stroke();
    }
    context.restore();
    // Headlight cone at dusk.
    if (!car.wreck && car.speed > 30) {
      context.save();
      context.translate(car.x, car.y);
      context.rotate(car.angle);
      const grad = context.createLinearGradient(26, 0, 150, 0);
      grad.addColorStop(0, 'rgba(255,240,180,0.20)');
      grad.addColorStop(1, 'rgba(255,240,180,0)');
      context.fillStyle = grad;
      context.beginPath();
      context.moveTo(26, -8);
      context.lineTo(150, -42);
      context.lineTo(150, 42);
      context.lineTo(26, 8);
      context.closePath();
      context.fill();
      context.restore();
    }
  }

  function drawPed(ped) {
    if (ped.state === 'down') {
      context.fillStyle = ped.shirt;
      context.beginPath();
      context.ellipse(ped.x, ped.y, 12, 6, ped.angle, 0, Math.PI * 2);
      context.fill();
      return;
    }
    context.fillStyle = '#1a1a24';
    context.beginPath();
    context.arc(ped.x, ped.y, 9, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = ped.shirt;
    context.beginPath();
    context.arc(ped.x, ped.y, 7, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#e8c9a8';
    context.beginPath();
    context.arc(ped.x + Math.cos(ped.angle) * 4, ped.y + Math.sin(ped.angle) * 4, 4, 0, Math.PI * 2);
    context.fill();
  }

  function drawEnemy(e) {
    context.fillStyle = e.kind === 'boss' ? '#7a1010' : '#3d1020';
    context.beginPath();
    context.arc(e.x, e.y, e.kind === 'boss' ? 17 : 13, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = e.kind === 'boss' ? '#ff4757' : '#ff7a2e';
    context.beginPath();
    context.arc(e.x, e.y, e.kind === 'boss' ? 13 : 10, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#0b0b18';
    context.fillRect(e.x - 12, e.y - 22, 24, 4);
    context.fillStyle = '#ff4757';
    context.fillRect(e.x - 12, e.y - 22, 24 * Math.max(0, e.health / (e.kind === 'boss' ? 240 : 60)), 4);
    if (e.kind === 'boss') {
      text('VEX', e.x, e.y - 28, 13, '#ff4757', 'center', true);
    }
  }

  function drawPlayer(state) {
    const p = state.player;
    if (p.onFoot) {
      if (p.invuln > 0 && Math.floor(p.invuln * 10) % 2 === 0) return;
      context.save();
      context.translate(p.x, p.y);
      context.rotate(p.angle);
      context.fillStyle = 'rgba(0,0,0,0.4)';
      context.beginPath();
      context.ellipse(2, 4, 13, 9, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.player;
      context.beginPath();
      context.arc(0, 0, 12, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#f2f0ff';
      context.beginPath();
      context.arc(6, 0, 5, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#0b0b18';
      context.fillRect(8, -3, 10, 6);
      context.restore();
    }
  }

  function drawWorld(state) {
    drawCity();
    for (const skid of state.skids) {
      context.strokeStyle = `rgba(10,10,20,${Math.min(0.5, skid.life / 8)})`;
      context.lineWidth = 5;
      context.beginPath();
      context.moveTo(skid.x - Math.cos(skid.angle) * 14, skid.y - Math.sin(skid.angle) * 14);
      context.lineTo(skid.x + Math.cos(skid.angle) * 14, skid.y + Math.sin(skid.angle) * 14);
      context.stroke();
    }
    for (const pickup of state.pickups) {
      if (!pickup.active || !inView(pickup.x, pickup.y, 40)) continue;
      const bob = Math.sin(state.time * 3 + pickup.x) * 3;
      context.fillStyle = pickup.kind === 'health' ? '#3dff8e' : pickup.kind === 'repair' ? '#22e6ff' : pickup.kind === 'cash' ? '#ffd23e' : '#ff7a2e';
      context.beginPath();
      context.arc(pickup.x, pickup.y + bob, 11, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#0b0b18';
      text(pickup.kind === 'health' ? '+' : pickup.kind === 'repair' ? 'R' : pickup.kind === 'cash' ? '$' : 'A', pickup.x, pickup.y + bob + 5, 14, '#0b0b18', 'center', true);
    }
    for (const stash of state.stashes) {
      if (stash.taken || !inView(stash.x, stash.y, 40)) continue;
      context.fillStyle = '#ffd23e';
      context.beginPath();
      context.arc(stash.x, stash.y, 13, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#0b0b18';
      text('$', stash.x, stash.y + 5, 15, '#0b0b18', 'center', true);
    }
    for (const ped of state.peds) if (inView(ped.x, ped.y, 40)) drawPed(ped);
    for (const enemy of state.enemies) if (inView(enemy.x, enemy.y, 60)) drawEnemy(enemy);
    for (const car of state.cars) if (inView(car.x, car.y, 80)) drawCarShape(car, car === state.player.car);
    drawPlayer(state);
    for (const b of state.bullets) {
      context.strokeStyle = '#ffe9a8';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
      context.lineTo(b.x, b.y);
      context.stroke();
    }
    for (const part of state.parts) {
      const a = Math.max(0, part.life / part.maxLife);
      if (part.kind === 'smoke') {
        context.fillStyle = `rgba(138,138,154,${a * 0.5})`;
        context.beginPath();
        context.arc(part.x, part.y, part.size, 0, Math.PI * 2);
        context.fill();
      } else if (part.kind === 'ring') {
        context.strokeStyle = `rgba(255,210,62,${a})`;
        context.lineWidth = 5;
        context.beginPath();
        context.arc(part.x, part.y, part.size * (1 - a) + 10, 0, Math.PI * 2);
        context.stroke();
      } else if (part.kind === 'flash') {
        context.fillStyle = `rgba(255,233,168,${a})`;
        context.beginPath();
        context.arc(part.x, part.y, part.size * a, 0, Math.PI * 2);
        context.fill();
      } else {
        context.fillStyle = part.color;
        context.globalAlpha = a;
        context.fillRect(part.x - part.size / 2, part.y - part.size / 2, part.size, part.size);
        context.globalAlpha = 1;
      }
    }
  }

  function drawMinimap(state) {
    const { x, y, w, h } = MINIMAP;
    const sx = w / WORLD.width;
    const sy = h / WORLD.height;
    context.fillStyle = 'rgba(11,11,24,0.88)';
    context.fillRect(x - 6, y - 6, w + 12, h + 12);
    context.strokeStyle = PALETTE.neonPink;
    context.lineWidth = 2;
    context.strokeRect(x - 6, y - 6, w + 12, h + 12);
    context.fillStyle = '#0e3a5c';
    context.fillRect(x + 2860 * sx, y, (WORLD.width - 2860) * sx, h);
    context.strokeStyle = '#3a3a58';
    context.lineWidth = 2;
    for (const ax of AVENUES) {
      context.beginPath();
      context.moveTo(x + ax * sx, y);
      context.lineTo(x + ax * sx, y + h);
      context.stroke();
    }
    for (const sy2 of STREETS) {
      context.beginPath();
      context.moveTo(x, y + sy2 * sy);
      context.lineTo(x + w, y + sy2 * sy);
      context.stroke();
    }
    context.fillStyle = '#1d5c33';
    const park = PLACES.park;
    context.fillRect(x + (park.x - park.w / 2) * sx, y + (park.y - park.h / 2) * sy, park.w * sx, park.h * sy);
    for (const car of state.cars) {
      if (car.kind !== 'police') continue;
      context.fillStyle = '#ff4757';
      context.beginPath();
      context.arc(x + car.x * sx, y + car.y * sy, 3, 0, Math.PI * 2);
      context.fill();
    }
    if (state.objective) {
      const ox = x + state.objective.x * sx;
      const oy = y + state.objective.y * sy;
      const pulse = 3 + Math.sin(state.time * 5) * 1.5;
      context.fillStyle = '#ffd23e';
      context.beginPath();
      context.arc(ox, oy, pulse + 2, 0, Math.PI * 2);
      context.fill();
    }
    const p = state.player;
    context.fillStyle = '#ff2e88';
    context.beginPath();
    context.arc(x + p.x * sx, y + p.y * sy, 4, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#ffffff';
    context.lineWidth = 1;
    context.beginPath();
    context.arc(x + p.x * sx, y + p.y * sy, 4, 0, Math.PI * 2);
    context.stroke();
    text('NEON BAY', x + w / 2, y - 12, 11, PALETTE.muted, 'center', true);
  }

  function drawHud(state, extra, screen) {
    const p = state.player;
    const mission = MISSIONS[state.mission];
    context.fillStyle = 'rgba(11,11,24,0.92)';
    context.fillRect(0, 0, VIEW.width, 64);
    text(`$${state.cash}`, 24, 42, 30, PALETTE.cash, 'left', true);
    context.fillStyle = '#232338';
    context.fillRect(170, 20, 150, 18);
    context.fillStyle = state.health > 30 ? PALETTE.health : PALETTE.danger;
    context.fillRect(170, 20, 150 * Math.max(0, state.health / 100), 18);
    text('HP', 170, 56, 13, PALETTE.muted, 'left', true);
    text(`AMMO ${state.ammo}`, 340, 42, 20, PALETTE.text, 'left', true);
    if (mission) {
      text(mission.name, VIEW.width / 2, 34, 22, PALETTE.text, 'center', true);
      if (state.objective) {
        const d = Math.round(Math.hypot(state.objective.x - p.x, state.objective.y - p.y));
        text(`${state.objective.label}  •  ${d}m`, VIEW.width / 2, 58, 15, PALETTE.neonYellow, 'center');
      }
    }
    for (let i = 0; i < 5; i++) {
      const pts = starPoints(VIEW.width - 40 - i * 34, 34, 13);
      context.beginPath();
      context.moveTo(pts[0][0], pts[0][1]);
      for (const [px, py] of pts.slice(1)) context.lineTo(px, py);
      context.closePath();
      context.fillStyle = i < state.wanted ? PALETTE.star : '#3a3a58';
      context.fill();
    }
    if (extra.muted) text('MUTED (M)', VIEW.width - 24, 88, 13, PALETTE.muted, 'right');
    if (screen === SCREEN_PLAY && !p.onFoot && p.car) {
      text(`${Math.round(Math.abs(p.car.speed) * 0.16)} mph`, 24, VIEW.height - 190, 22, PALETTE.text, 'left', true);
    }
    // Objective arrow at the screen edge when the target is off-screen.
    if (screen === SCREEN_PLAY && state.objective && !state.complete) {
      const cam = state.camera;
      const ox = state.objective.x - cam.x;
      const oy = state.objective.y - cam.y;
      if (ox < 0 || oy < 0 || ox > VIEW.width || oy > VIEW.height) {
        const cx = VIEW.width / 2;
        const cy = VIEW.height / 2;
        const a = Math.atan2(oy - cy, ox - cx);
        const ex = cx + Math.cos(a) * 300;
        const ey = cy + Math.sin(a) * 200;
        context.save();
        context.translate(ex, ey);
        context.rotate(a);
        context.fillStyle = PALETTE.neonYellow;
        context.beginPath();
        context.moveTo(16, 0);
        context.lineTo(-10, -11);
        context.lineTo(-10, 11);
        context.closePath();
        context.fill();
        context.restore();
      } else {
        context.fillStyle = 'rgba(255,210,62,0.9)';
        context.beginPath();
        context.arc(ox, oy, 6 + Math.sin(state.time * 5) * 2, 0, Math.PI * 2);
        context.fill();
      }
    }
    drawMinimap(state);
    const nearCar = extra.nearCar;
    if (screen === SCREEN_PLAY && nearCar) text('E — Steal car', VIEW.width / 2, VIEW.height - 200, 20, PALETTE.neonYellow, 'center', true);
    else if (screen === SCREEN_PLAY && p.onFoot) text('WASD move   Shift run   F punch   Click shoot   E steal car   P pause', VIEW.width / 2, VIEW.height - 200, 14, PALETTE.muted, 'center');
  }

  function drawPanel(title, lines, prompt, accent) {
    const width = 640;
    const height = 150 + lines.length * 34;
    const x = (VIEW.width - width) / 2;
    const y = (VIEW.height - height) / 2;
    context.fillStyle = 'rgba(11,11,24,0.92)';
    context.fillRect(x, y, width, height);
    context.strokeStyle = accent || PALETTE.panelEdge;
    context.lineWidth = 3;
    context.strokeRect(x, y, width, height);
    context.textBaseline = 'alphabetic';
    glowText(title, VIEW.width / 2, y + 72, 44, accent || PALETTE.neonPink);
    for (let i = 0; i < lines.length; i++) {
      text(lines[i], VIEW.width / 2, y + 118 + i * 34, 20, PALETTE.muted, 'center');
    }
    text(prompt, VIEW.width / 2, y + height - 30, 20, PALETTE.cash, 'center', true);
  }

  function drawTitle(state, extra) {
    context.fillStyle = 'rgba(11,11,24,0.55)';
    context.fillRect(0, 0, VIEW.width, VIEW.height);
    glowText('NEON BAY', VIEW.width / 2, 250, 92, PALETTE.neonPink);
    glowText('STREET KINGS', VIEW.width / 2, 320, 52, PALETTE.neonCyan);
    text('An open-world crime story in the city that never sleeps.', VIEW.width / 2, 368, 20, PALETTE.text, 'center');
    text('Steal cars. Dodge the Neon Bay police. Run Mama Lou\'s jobs and take the Strip back from the Coral Kings.', VIEW.width / 2, 398, 17, PALETTE.muted, 'center');
    text('WASD move / drive    E steal car    F punch    Mouse aim, click shoot    Shift run    P pause    M mute', VIEW.width / 2, 470, 16, PALETTE.muted, 'center');
    if (extra.save) {
      text(`Continue — $${extra.save.cash}   •   Mission ${extra.save.mission + 1}: ${MISSIONS[extra.save.mission].name}`, VIEW.width / 2, 520, 18, PALETTE.neonYellow, 'center', true);
    }
    if (extra.best > 0) text(`Best cash: $${extra.best}`, VIEW.width / 2, 552, 18, PALETTE.muted, 'center');
    text('Press Space or click to start', VIEW.width / 2, 620, 24, PALETTE.cash, 'center', true);
  }

  function draw(state, screen, extra) {
    lastCamera = state.camera;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const shakeX = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    const shakeY = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    context.setTransform(view.scale, 0, 0, view.scale, view.x - state.camera.x * view.scale + shakeX * view.scale, view.y - state.camera.y * view.scale + shakeY * view.scale);
    drawWorld(state);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    // Dusk vignette.
    const grad = context.createRadialGradient(VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.35, VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.75);
    grad.addColorStop(0, 'rgba(11,11,24,0)');
    grad.addColorStop(1, 'rgba(11,11,24,0.42)');
    context.fillStyle = grad;
    context.fillRect(0, 0, VIEW.width, VIEW.height);
    if (screen === SCREEN_TITLE) {
      drawTitle(state, extra);
      return;
    }
    drawHud(state, extra, screen);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The city waits for you.', 'WASD move / drive    E steal car    F punch    Click shoot'], 'Press P to resume', PALETTE.neonCyan);
    } else if (screen === SCREEN_MISSION) {
      const m = state.justCompleted;
      const next = MISSIONS[state.mission + 1];
      drawPanel('MISSION COMPLETE', [
        m ? `${m.name}  —  +$${m.reward}` : '',
        `Cash: $${state.cash}`,
        next ? `Next: ${next.name}` : 'The Strip is yours.',
      ], 'Press Space to continue', PALETTE.neonGreen);
    } else if (screen === SCREEN_BUSTED) {
      drawPanel('BUSTED', [
        'The Neon Bay PD caught Rico.',
        `Cash kept: $${state.cash}`,
        'The Coral Kings are laughing tonight.',
      ], 'Press Space to retry this mission', PALETTE.danger);
    } else if (screen === SCREEN_COMPLETE) {
      drawPanel('YOU OWN THE STRIP', [
        'Vex is down. The Coral Kings are finished.',
        `Final cash: $${state.cash}`,
        extra.best > 0 ? `Best cash: $${extra.best}` : '',
      ], 'Press N for a new game', PALETTE.neonYellow);
    }
  }

  function screenToWorld(cx, cy) {
    const rect = canvas.getBoundingClientRect();
    const px = (cx - rect.left) * (canvas.width / rect.width);
    const py = (cy - rect.top) * (canvas.height / rect.height);
    const vx = (px - view.x) / view.scale;
    const vy = (py - view.y) / view.scale;
    return { x: vx + lastCamera.x, y: vy + lastCamera.y };
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, screenToWorld };
}
