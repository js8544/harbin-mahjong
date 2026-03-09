# Harbin Mahjong

A playable single-player Harbin Mahjong web game built with React + TypeScript + Vite.

## Live goals

This project aims to become a polished browser-playable Harbin Mahjong experience with:

- complete local game flow
- better AI opponents
- documented rule assumptions
- automated CI and issue-driven iteration

## Current v2 features

- 1 human player vs 3 AI players
- draw / discard / chow / pong / kong / win flow
- discard-claim priority queue
- dealer rotation
- round settlement panel
- cumulative scoreboard across rounds
- seven-pairs settlement support
- event log and action prompts
- automated tests, lint, and build in CI

## Current rule assumptions

This is a playable approximation, not yet a full authoritative implementation of every Harbin local scoring variation.

- 136-tile wall
- no flower tiles
- chow only from the next player on a discard
- claim priority: win > kong > pong > chow
- standard hand supported: 4 melds + 1 pair
- seven pairs recognized in settlement
- simplified settlement bonuses:
  - base win
  - self-draw
  - dealer win
  - seven pairs
  - pure one suit
  - pung/kong-heavy hand

## Development

Use pnpm in this repository.

```bash
corepack enable
pnpm install
pnpm dev
pnpm test
pnpm lint
pnpm build
```

## CI

GitHub Actions runs lint, test, and build on pushes and pull requests.

## Roadmap

See `.github/ISSUE_TEMPLATE/`, `docs/ROADMAP.md`, and repository issues for the next iteration plan.
