Build a complete single-page Harbin Mahjong web game in this repository.

Hard requirements:
- Use a modern web stack suitable for GitHub-hosted source control and CI. Prefer Vite + React + TypeScript.
- Implement a polished playable UI with full interaction: start game, draw, discard, turn indicator, hand display, meld area, basic action prompts, round/wall counters, game log, restart.
- Implement a clear Harbin Mahjong rules engine approximation with documented assumptions when exact local variations are ambiguous.
- Include AI opponents for local single-player play.
- Include tests for core rule logic.
- Include GitHub Actions CI for install, build, and test.
- Include a README documenting gameplay, assumptions, architecture, and development scripts.
- Keep everything runnable locally with npm install && npm run build && npm test.
- Make incremental commits as meaningful milestones.

Process requirements:
- Work autonomously in a Ralph-style loop mindset: inspect repo state, make progress, verify, and continue until the repository reaches a solid v1.
- If some Harbin rule details are ambiguous, choose reasonable documented defaults rather than blocking.
- Do not ask for confirmation during implementation.
- At the end, leave the repo in a clean committed state on the default branch.
