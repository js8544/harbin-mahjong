# Harbin Mahjong

A local single-player Harbin Mahjong web game with 3 AI opponents, built with React + TypeScript + Vite.

## Features

- Full playable browser UI
- Start round / restart session interaction
- Draw / discard / claim action flow
- Meld support: chow, pong, kong
- Self-draw and discard-win detection
- 3 simple AI opponents
- Event log, wall counter, turn counter, round state
- Unit tests for core rule logic
- GitHub Actions CI for lint, test, and build

## Harbin rule assumptions

Harbin Mahjong has local rule variations, so this project implements a documented playable approximation:

- Standard winning structure: 4 melds + 1 pair
- No flower tiles
- 136-tile wall
- Chow allowed only by the next player on a discard
- Claim priority: win > kong > pong > chow
- Simplified flat win model; no detailed fan scoring yet

These assumptions are encoded in the game engine and can be evolved in later iterations.

## Tech stack

- React 19
- TypeScript
- Vite
- Vitest
- ESLint

## Scripts

```bash
npm install
npm run dev
npm run test
npm run build
npm run lint
```

## Project structure

- `src/game/tiles.ts` — tile generation, labels, ordering
- `src/game/rules.ts` — hand evaluation and claim rules
- `src/game/engine.ts` — turn flow and round state transitions
- `src/game/ai.ts` — simple local AI logic
- `src/App.tsx` — game UI

## Current status

This repository already contains a working v1 prototype with a playable interface and automated checks. Future iterations can improve:

- More faithful Harbin-specific scoring and restrictions
- Better AI strategy
- Sound, animations, and mobile polish
- Round progression, dealer rotation, and score settlement
