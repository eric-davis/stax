# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the game

ES modules require an HTTP server — opening `index.html` directly will fail due to CORS restrictions.

```bash
python -m http.server 8765
# then open http://localhost:8765
```

No build step, no npm, no dependencies.

## Architecture

Six classes wired together by `Game` in `main.js`. Data flows one way: `Engine` → `Game` → `Renderer`/`AudioManager`.

```
main.js (Game)
├── engine.js  (Engine)   — board state, collision, gravity, lock delay, T-spin detection
├── scoring.js (Scorer)   — score, level, lines, combos, B2B; owns gravity speed formula
├── renderer.js (Renderer)— all Canvas 2D drawing; no game logic
├── input.js (InputHandler)— keydown/keyup, DAS timers
├── audio.js (AudioManager)— Web Audio API synth SFX + scheduled BGM loop
└── pieces.js             — PIECES shapes, WALL_KICKS, COLORS, Bag (7-bag randomizer)
```

**Game loop:** RAF calls `engine.tick(dt)` each frame. `tick` returns a result object `{ linesCleared, clearedRows, tspinType, scoreResult, gameOver }` when a piece locks; `null` otherwise. `Game._handleResult()` dispatches sounds and visual effects based on that result.

**State machine:** `Game.state` is one of `'menu' | 'playing' | 'paused' | 'gameover'`. `InputHandler.setPaused(bool)` enables/disables DAS without detaching listeners.

**Renderer is passive:** it receives all data via `render({ state, engine, scorer, highScores, musicMuted })` each frame and never reads from or writes to other modules. Visual effects (`triggerLineClearEffect`, `triggerLevelUpEffect`) are called imperatively from `Game._handleResult()`.

**Scorer owns gravity:** `scorer.getGravityMs()` uses the guideline formula `(0.8 - (level-1)*0.007)^(level-1) * 1000`. `Engine.tick` calls it each frame so gravity automatically accelerates as level rises.

**Lock delay:** 500 ms timer that resets on any successful move or rotate while on the floor, up to 15 resets (`LOCK_RESET_MAX`). After 15 resets the piece locks immediately.

**T-spin detection** (`engine._detectTSpin()`): 3-corner rule on the T-centre cell. Returns `'full'`, `'mini'`, or `null`. Only triggers when `lastAction === 'rotate'`.

**Pieces:** Each piece has 4 rotation states stored as 4×4 string grids (`'X'` = filled, `'.'` = empty) in `PIECES`. Wall kicks use separate `WALL_KICKS.I` and `WALL_KICKS.JLSTZ` tables keyed `'from->to'`.

**Audio:** `AudioManager._init()` is lazy (first user gesture). BGM is note-by-note scheduled via Web Audio API and loops by setting a `setTimeout` ~200 ms before the melody ends. SFX names: `move`, `rotate`, `softDrop`, `hardDrop`, `lineClear`, `stax` (4-line clear), `tSpin`, `levelUp`, `gameOver`.

**High scores:** Global leaderboard backed by `api/app.py` (Flask + SQLite). `Game._loadLocalScores()` reads `localStorage` key `stax_highscores` for immediate rendering; `Game._loadScores()` fetches `./api/scores` async and overwrites on success. `Game._submitScore()` POSTs to `./api/scores` and updates from the response; falls back to localStorage-only on any error. The renderer receives whichever `this.highScores` is current — no special handling needed.

## Key constants

| Location | Constant | Value |
|---|---|---|
| `engine.js` | `LOCK_DELAY_MS` | 500 ms |
| `engine.js` | `LOCK_RESET_MAX` | 15 |
| `renderer.js` | `CELL` | 30 px |
| `renderer.js` | Canvas layout | 160 (left panel) + 300 (board) + 175 (right panel) = 635 × 640 |
| `input.js` | DAS delay / repeat (LR) | 167 ms / 33 ms |
| `input.js` | DAS delay / repeat (down) | 0 ms / 33 ms |
| `audio.js` | BGM tempo | 140 BPM |
