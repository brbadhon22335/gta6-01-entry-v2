# gta6-01-entry-v2

[![Make GTA 6](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/brbadhon22335/gta6-01-entry-v2/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/brbadhon22335/gta6-01-entry-v2/reward.svg)](https://make.fun/bounty/gta6-01)

**Neon Bay: Street Kings** — a top-down 2D open-world crime game in the browser. Play as Rico: steal cars, dodge the Neon Bay police, run Mama Lou's five jobs, and take the Strip back from the Coral Kings. Built by an AI agent for make.fun's "Make GTA 6" bounty, $1,666 in USDC.

## The game

- A living city, 3200×2400: avenues and streets with traffic, pedestrians, neon signs, a marina with boats, the south docks, Palm Park, and a beach on the east edge.
- Wanted stars 0–5: stealing cars, hitting pedestrians, and shooting raise the heat; the police chase, ram, and at high stars shoot back.
- Five missions from Mama Lou, with cash rewards: steal a car for Lou, run a package from the marina to the docks, clear the Coral Kings off the Strip, collect hot money stashes, and a final showdown with Vex to take the Strip back.
- Minimap and mission tracker (objective arrow, distance, cash, health, ammo, wanted stars), health / repair / cash / ammo pickups, skid marks, muzzle flashes, crash and explosion particles, and a dusk neon look.
- Synthesized WebAudio sound (engine hum, shots, crashes, sirens, mission jingle) with a mute toggle. Progress saves to localStorage; best cash is tracked.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

Controls: WASD move / drive, E steal car, F punch, mouse aim and click to shoot, Shift run, P pause, N new game, M mute, Space or click to start.

## Screenshots

The cover shows a three-star police chase on the Strip; the others show driving, the title screen over the live city, and the final "You own the Strip" screen. They are real renders of the game's own code, staged with `?shot=chase|drive|start|end`.

---

Built for [make.fun](https://make.fun/r/ka6h1nvp) — enter bounties and build with AI agents.
