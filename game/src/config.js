// Every tuning number, colour and place name in one place. Neon Bay is a
// 3200 by 2400 city; the camera shows a 1280 by 800 window of it, and the
// simulation always advances in fixed 1/60 s steps.

export const WORLD = { width: 3200, height: 2400 };
export const VIEW = { width: 1280, height: 800 };
export const STEP = 1 / 60;

export const ROAD_WIDTH = 120;
export const AVENUES = [400, 1000, 1600, 2200, 2800];
export const STREETS = [400, 900, 1400, 1900];
export const WATER_X = 2960;
export const BEACH_X = 2860;

export const PALETTE = {
  backdrop: '#0b0b18',
  ground: '#181828',
  road: '#232338',
  roadEdge: '#3a3a58',
  lane: '#e8c85a',
  sidewalk: '#2e2e46',
  water: '#0e3a5c',
  waterDeep: '#0a2a46',
  sand: '#c9a86a',
  park: '#12351f',
  parkTree: '#1d5c33',
  building: '#2b2b4a',
  buildingRoof: '#3d3d68',
  neonPink: '#ff2e88',
  neonCyan: '#22e6ff',
  neonYellow: '#ffd23e',
  neonGreen: '#3dff8e',
  neonOrange: '#ff7a2e',
  text: '#f2f0ff',
  muted: '#9a97b8',
  panel: '#171728',
  panelEdge: '#ff2e88',
  cash: '#ffd23e',
  health: '#3dff8e',
  danger: '#ff4757',
  player: '#ff2e88',
  police: '#e8ecff',
  star: '#ffd23e',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export const SAVE_KEY = 'neon-bay.save.v2';
export const BEST_KEY = 'neon-bay.best.v2';

export const PLACES = {
  diner: { x: 400, y: 330, label: "Lou's Diner" },
  marina: { x: 2740, y: 400, label: 'Neon Marina' },
  docks: { x: 1650, y: 2260, label: 'South Docks' },
  hideout: { x: 2250, y: 1950, label: "Rico's Hideout" },
  strip: { x: 1600, y: 1400, label: 'The Strip' },
  park: { x: 725, y: 1675, w: 450, h: 350, label: 'Palm Park' },
};

export const SIGN_NAMES = [
  'NEON MOTEL', 'TACOS', 'CASINO', 'BAR', 'HOTEL', 'PIZZA', 'CLUB NEON',
  'GYM', '24H MART', 'CINEMA', 'PALMS', 'VICE', 'DANCE', 'ARCADE',
  'DONUTS', 'ROOFTOP', 'SUSHI', 'BURGERS', 'NEON', 'HOTEL VICE',
  'LAUNDRO', 'PAWN SHOP', 'NOODLES', 'RECORDS', 'BILLIARDS',
];

export const SIGN_COLORS = ['#ff2e88', '#22e6ff', '#ffd23e', '#3dff8e', '#ff7a2e'];

export const CAR_COLORS = [
  '#e8ecff', '#ffd23e', '#22e6ff', '#ff2e88', '#3dff8e',
  '#ff7a2e', '#8e7bff', '#c9a86a', '#5ad1ff', '#ff5a5a',
];

export const PED_SHIRTS = [
  '#ff5a5a', '#ffd23e', '#3dff8e', '#22e6ff', '#ff2e88',
  '#e8ecff', '#ff7a2e', '#8e7bff', '#7dffce', '#ffb3d1',
];

export const PLAYER = {
  radius: 13,
  walk: 230,
  run: 350,
  health: 100,
  punchDamage: 34,
  punchRange: 46,
  punchArc: 1.1,
  ammoStart: 24,
  ammoMax: 60,
  bulletDamage: 20,
  bulletSpeed: 900,
  fireDelay: 0.16,
};

export const CAR = {
  accel: 880,
  brake: 1400,
  reverse: 260,
  maxSpeed: 640,
  turn: 2.7,
  health: 100,
  length: 52,
  width: 26,
};

export const POLICE = {
  speed: 560,
  speedPerStar: 22,
  ramDamage: 12,
  shootAtStars: 4,
  shootRange: 420,
  shootDelay: 0.9,
  bulletDamage: 8,
};

export const ENFORCER = { health: 60, speed: 150, shootDelay: 1.1, bulletDamage: 7 };
export const BOSS = { health: 240, speed: 170, shootDelay: 0.7, bulletDamage: 10 };

export const WANTED = {
  max: 5,
  decaySeconds: 14,
  shootCooldown: 4,
};

export const MISSIONS = [
  {
    name: 'Wheels for Lou',
    brief: "Mama Lou needs wheels. Steal any car and bring it to Lou's Diner.",
    reward: 150,
    steps: [
      { type: 'steal', label: 'Steal a car  (E)' },
      { type: 'goto', x: PLACES.diner.x, y: PLACES.diner.y, label: "Bring it to Lou's Diner" },
    ],
  },
  {
    name: 'The Package',
    brief: 'Pick up the package at the Neon Marina and run it to the South Docks. No cops.',
    reward: 300,
    steps: [
      { type: 'goto', x: PLACES.marina.x, y: PLACES.marina.y, label: 'Pick up the package at the Marina' },
      { type: 'goto', x: PLACES.docks.x, y: PLACES.docks.y, label: 'Deliver it to the South Docks' },
    ],
  },
  {
    name: 'Strip Trouble',
    brief: 'Three Coral Kings enforcers are shaking down the Strip. Put them down, lose the heat, get home.',
    reward: 500,
    steps: [
      { type: 'defeat', count: 3, x: PLACES.strip.x, y: PLACES.strip.y, label: 'Beat 3 Coral Kings enforcers on the Strip' },
      { type: 'loseheat', label: 'Lose the heat  (wanted back to 0)' },
      { type: 'goto', x: PLACES.hideout.x, y: PLACES.hideout.y, label: 'Get home to the Hideout' },
    ],
  },
  {
    name: 'Hot Money',
    brief: 'Three cash stashes are sitting unguarded. Grab them all while the heat is on and bring the money to Lou.',
    reward: 750,
    heat: 3,
    steps: [
      { type: 'collect', count: 3, label: 'Grab the 3 cash stashes' },
      { type: 'goto', x: PLACES.diner.x, y: PLACES.diner.y, label: 'Bring the money to Lou' },
    ],
  },
  {
    name: 'Take the Strip',
    brief: 'Vex, the Coral Kings boss, holds the Strip. End it tonight.',
    reward: 1500,
    steps: [
      { type: 'boss', label: 'Take down Vex and his crew on the Strip' },
    ],
  },
];

export const STASH_SPOTS = [
  { x: PLACES.park.x, y: PLACES.park.y },
  { x: PLACES.marina.x, y: PLACES.marina.y + 120 },
  { x: 1600, y: PLACES.docks.y },
];

export const PICKUP_SPOTS = [
  { kind: 'health', x: 1000, y: 900 },
  { kind: 'health', x: 2200, y: 400 },
  { kind: 'repair', x: 400, y: 1400 },
  { kind: 'repair', x: 2800, y: 1900 },
  { kind: 'cash', x: 1600, y: 400 },
  { kind: 'cash', x: 1000, y: 1900 },
  { kind: 'ammo', x: 2200, y: 900 },
  { kind: 'ammo', x: 400, y: 1900 },
];
