# Split Focus: Comprehensive Improvement Plan

## Current State

Single-file HTML5 canvas game (`index.html`, ~1259 lines) deployed on itch.io. Dual-zone dodge game testing divided attention. Has: progressive difficulty, basic stats (score/swaps/dodged), last-5 history, revive system, share buttons, responsive mobile support. Missing: meaningful cognitive metrics, result depth, gameplay variety, longitudinal tracking, structured training.

## Architecture Evolution

Move from single `index.html` to a clean multi-file web app (still fully playable in browser, deployable to itch.io or any static host):

```
split_focus/
├── index.html          (shell + layout)
├── css/
│   └── style.css       (all styles)
├── js/
│   ├── game.js         (core game loop, rendering, physics)
│   ├── metrics.js      (cognitive metric tracking)
│   ├── results.js      (results screen, charts, insights)
│   ├── persistence.js  (localStorage / IndexedDB session storage)
│   ├── training.js     (structured training sessions)
│   ├── dashboard.js    (progress dashboard, trends)
│   ├── achievements.js (achievement system)
│   ├── settings.js     (difficulty, accessibility, preferences)
│   ├── sound.js        (audio system)
│   └── tutorial.js     (onboarding flow)
└── GAME_MECHANICS.md   (updated documentation)
```

No build step required — plain ES modules (`<script type="module">`). Can add a backend later for leaderboards/norms without restructuring the frontend.

---

## What's Already Built (committed & merged to master)

The following modules are **done** and sitting in the repo:

- `css/style.css` — Full stylesheet with accessibility, colorblind palettes, dashboard, tutorial, achievements UI
- `js/metrics.js` — Per-side cognitive tracking (reaction times, AAI, time bins, near-miss, swap patterns)
- `js/results.js` — Enhanced results screen with L/R breakdown, AAI gauge, timeline chart, auto-generated insights
- `js/persistence.js` — Session storage (50 sessions), settings, achievements, JSON/CSV data export
- `js/settings.js` — Difficulty presets (Easy/Medium/Hard/Adaptive), accessibility settings panel
- `js/sound.js` — Audio system extracted as ES module with new sound types (powerup, achievement, nearmiss)
- `js/achievements.js` — 13 achievements with toast notifications
- `js/tutorial.js` — 3-step interactive onboarding flow
- `js/dashboard.js` — Progress dashboard with score/RT/AAI trend charts, records, export buttons
- `js/training.js` — Structured training session definitions (baseline, left/right focus, sustained, etc.)

## What Still Needs to Be Done

### CRITICAL: Wire Everything Together
1. **`js/game.js`** — Main game loop that imports all modules and replaces the inline `<script>` in index.html. Must include:
   - Core game loop (update/render at 60fps)
   - New obstacle types (wide, fast, oscillating, ghost)
   - Power-ups (slow-mo, shield, focus lens, score boost)
   - Near-miss detection
   - Threat timestamp tagging for reaction time tracking
   - Adaptive difficulty mode
   - Training session integration
   - All metrics recording hooks

2. **Updated `index.html`** — Convert from monolithic 1,260-line file to thin shell:
   - Strip inline `<style>` → load `css/style.css`
   - Strip inline `<script>` → load `<script type="module" src="js/game.js">`
   - Add new HTML elements: settings panel, dashboard panel, tutorial overlay, difficulty selector, stats/settings buttons
   - Keep existing HTML structure for game canvas, overlay, share buttons

---

## Phase 1: Metrics Foundation (DONE — in js/metrics.js)

### 1.1 Per-Side Performance Tracking
- Split `totalSwaps` → `leftSwaps` / `rightSwaps`
- Split `obstaclesDodged` → `leftDodged` / `rightDodged`
- Record `deathSide` on collision

### 1.2 Reaction Time Tracking
- Tag obstacles with `threatTimestamp` when crossing 60% canvas height
- On each swap, find nearest same-side obstacle in reaction zone, compute RT
- Maintain `leftReactionTimes[]` and `rightReactionTimes[]`
- Compute mean, median, SD at game end

### 1.3 Near-Miss Detection
- When obstacle passes player y-band without collision, check x-proximity
- Flag as near-miss if within ~20% lane width
- Track per-side

### 1.4 Attention Asymmetry Index (AAI)
- `AAI = (rightRT_avg - leftRT_avg) / (rightRT_avg + leftRT_avg)`
- Range: -1 (left bias) → 0 (balanced) → +1 (right bias)

### 1.5 Time-Binned Performance
- 10-second bins with per-bin swaps, dodges, RTs, near-misses

### 1.6 Swap Efficiency & Input Patterns
- Unnecessary swaps, panic swaps tracking

---

## Phase 2: Results Screen & Persistence (DONE — in js/results.js, js/persistence.js)

### 2.1 Enhanced Results Screen
- Section A: Score Summary (score, best, duration, speed)
- Section B: Left vs Right Breakdown (side-by-side bars, AAI gauge)
- Section C: Performance Timeline (mini sparkline per-bin)
- Section D: Cognitive Insights (auto-generated text)

### 2.2 Structured Session History
- Last 50 sessions in localStorage with full metrics snapshot
- Backward compat with existing `splitFocusBestScore` / `splitFocusLast5`

### 2.3 Data Export (DONE — in js/persistence.js)
- JSON and CSV export via Blob + download

---

## Phase 3: Gameplay Improvements (NEEDS game.js)

### 3.1 Difficulty Modes
| Mode | Speed Multiplier | Spawn Min | Notes |
|------|-----------------|-----------|-------|
| Easy | 1 + t×0.06 | 400ms | Wider safe gaps |
| Medium | 1 + t×0.12 | 250ms | Current default |
| Hard | 1 + t×0.18 | 180ms | Cluster spawning |
| Adaptive | Dynamic | Dynamic | Adjusts based on rolling dodge/miss window |

Settings module already has `DIFFICULTY` presets defined.

### 3.2 Tutorial / Onboarding (DONE — in js/tutorial.js)
- 3-step interactive tutorial
- localStorage flag to skip on return

### 3.3 New Obstacle Types (NEEDS game.js)
- **Wide obstacle:** ~80% zone width, forces specific lane. After 15s.
- **Fast obstacle:** 2x fall speed, smaller size. After 25s.
- **Oscillating obstacle:** Sways between lanes during fall. After 40s.
- **Ghost obstacle:** Semi-transparent, phases in/out. After 60s.
- Visual distinction via color, shape, glow in `drawObstacle()`

### 3.4 Power-Ups (NEEDS game.js)
- **Slow-Mo (hourglass):** 50% speed for 3s
- **Shield (star):** 1-hit invulnerability on one side for 5s
- **Focus Lens (eye):** Highlights safer lane briefly
- **Score Boost (diamond):** 2x score for 5s
- 5-10% spawn chance

### 3.5 Visual & Audio Polish (NEEDS game.js)
- Lane switch trail, near-miss feedback, obstacle warnings
- Background color temperature shift with speed
- Particle variety per obstacle type

---

## Phase 4: Training, Engagement & Accessibility

### 4.1 Structured Training Sessions (DONE — definitions in js/training.js, NEEDS game.js integration)
- Baseline, Left Focus, Right Focus, Sustained Attention, Adaptive Threshold, Speed Focus

### 4.2 Progress Dashboard (DONE — in js/dashboard.js)
- Score/RT/AAI trend charts, personal records, achievement gallery

### 4.3 Achievement System (DONE — in js/achievements.js)
13 achievements covering cognitive targets (balanced attention, processing speed, sustained attention, etc.)

### 4.4 Daily Challenge (NEEDS game.js)
- Seeded PRNG from date, same obstacle sequence for all players

### 4.5 Accessibility (DONE — in css/style.css + js/settings.js)
- Colorblind modes (blue/orange, green/purple)
- Reduced motion, high contrast
- Settings panel with toggles

---

## Phase 5: Backend & Social (Future — not started)
- Leaderboards, user accounts, clinician portal, multiplayer
- Not in scope for current implementation

---

## Implementation Priority for game.js

When building game.js, integrate in this order:
1. Port existing game loop from index.html inline script
2. Import and wire up metrics.js (record swaps, dodges, deaths per-side)
3. Add threat timestamp tagging for reaction time tracking
4. Add near-miss detection in obstacle update loop
5. Integrate difficulty modes from settings.js
6. Add new obstacle types (wide, fast, oscillating, ghost)
7. Add power-up spawning and collection
8. Wire up results.js for enhanced game-over screen
9. Wire up tutorial.js for first-visit onboarding
10. Wire up training.js for structured sessions
11. Wire up achievements.js for post-game checks
