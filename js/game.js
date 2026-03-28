// ─── Split Focus: Main Game Module ───────────────────────────────────────────
// Imports all sub-modules and runs the core game loop.
// Loaded as <script type="module"> from index.html.

import { SessionMetrics } from './metrics.js';
import { populateResults } from './results.js';
import {
    getBestScore, setBestScore, loadHistory, saveHistory,
    loadSessions, saveSession, loadSettings, isTutorialComplete,
} from './persistence.js';
import { getSettings, updateSetting, applySettings, getDifficulty, showSettings, DIFFICULTY } from './settings.js';
import { Sound } from './sound.js';
import { checkAchievements, unlockTutorialAchievement, getAchievementList } from './achievements.js';
import { shouldShowTutorial, startTutorial } from './tutorial.js';
import { initDashboard, showDashboard } from './dashboard.js';
import { TRAINING_MODES, getTrainingMode, getTrainingList } from './training.js';

// ─── DOM References ──────────────────────────────────────────────────────────
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const scoreEl = document.getElementById('score');
const bestScoreEl = document.getElementById('bestScore');
const messageEl = document.getElementById('message');
const historyListEl = document.getElementById('historyList');
const pauseBtn = document.getElementById('pauseBtn');
const restartBtn = document.getElementById('restartBtn');
const muteBtn = document.getElementById('muteBtn');
const orientHintEl = document.getElementById('orientHint');

// Game-over overlay
const gameOverOverlay = document.getElementById('gameOverOverlay');
const finalScoreEl = document.getElementById('finalScore');
const finalHighEl = document.getElementById('finalHigh');
const statSwapsEl = document.getElementById('statSwaps');
const statDodgedEl = document.getElementById('statDodged');
const reviveBtn = document.getElementById('reviveBtn');
const restartOverlayBtn = document.getElementById('restartOverlayBtn');

// Enhanced results elements (may not exist in old HTML — guard with optional chaining)
const statDurationEl = document.getElementById('statDuration');
const statSpeedEl = document.getElementById('statSpeed');
const lrBreakdownEl = document.getElementById('lrBreakdown');
const aaiGaugeEl = document.getElementById('aaiGauge');
const aaiLabelEl = document.getElementById('aaiLabel');
const timelineCanvas = document.getElementById('timelineCanvas');
const insightsEl = document.getElementById('insights');

// Toolbar buttons
const settingsBtn = document.getElementById('settingsBtn');
const dashboardBtn = document.getElementById('dashboardBtn');
const trainingBtn = document.getElementById('trainingBtn');
const difficultySelect = document.getElementById('difficultySelect');

// ─── Persisted Data ──────────────────────────────────────────────────────────
let bestScore = getBestScore();
bestScoreEl.textContent = Math.floor(bestScore);

function renderHistory() {
    const hist = loadHistory();
    historyListEl.innerHTML = '';
    if (hist.length === 0) {
        const chip = document.createElement('span');
        chip.className = 'chip';
        chip.textContent = '—';
        historyListEl.appendChild(chip);
        return;
    }
    hist.forEach(s => {
        const chip = document.createElement('span');
        chip.className = 'chip';
        chip.textContent = String(s);
        historyListEl.appendChild(chip);
    });
}

function recordScore(s) {
    const hist = loadHistory();
    hist.unshift(s);
    saveHistory(hist.slice(0, 5));
    renderHistory();
}

renderHistory();

// ─── Audio ───────────────────────────────────────────────────────────────────
Sound.setMuteBtn(muteBtn);
muteBtn.addEventListener('click', (e) => {
    e.target.blur();
    Sound.init();
    Sound.toggle();
});

// ─── Viewport / Canvas Sizing ────────────────────────────────────────────────
function viewportSize() {
    const w = window.visualViewport?.width || window.innerWidth;
    const h = window.visualViewport?.height || window.innerHeight;
    return { w, h };
}

function setVhVar() {
    const { h } = viewportSize();
    document.documentElement.style.setProperty('--vh', `${h * 0.01}px`);
}

function updateOrientationHint() {
    const { w, h } = viewportSize();
    orientHintEl.style.display = (w > h && h < 520) ? 'block' : 'none';
}

let W = 500, H = 700, laneWidth = W / 4;
let resizeScheduled = false, lastCssW = 0, lastCssH = 0;

function resizeCanvasNow() {
    resizeScheduled = false;
    const rect = canvas.getBoundingClientRect();
    const cssW = Math.max(1, Math.floor(rect.width));
    const cssH = Math.max(1, Math.floor(rect.height));
    if (cssW === lastCssW && cssH === lastCssH) return;
    lastCssW = cssW; lastCssH = cssH;

    const dpr = Math.max(1, Math.min(2.5, window.devicePixelRatio || 1));
    const targetW = Math.floor(cssW * dpr);
    const targetH = Math.floor(cssH * dpr);
    if (canvas.width !== targetW) canvas.width = targetW;
    if (canvas.height !== targetH) canvas.height = targetH;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    W = cssW; H = cssH; laneWidth = W / 4;
}

function scheduleResize() {
    if (resizeScheduled) return;
    resizeScheduled = true;
    requestAnimationFrame(() => { setVhVar(); updateOrientationHint(); resizeCanvasNow(); });
}

if (window.ResizeObserver) {
    new ResizeObserver(() => scheduleResize()).observe(document.getElementById('gameContainer'));
}
window.addEventListener('resize', scheduleResize);
window.addEventListener('orientationchange', scheduleResize);
if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', scheduleResize);
    window.visualViewport.addEventListener('scroll', scheduleResize);
}
scheduleResize();

// ─── Game State ──────────────────────────────────────────────────────────────
let leftLaneIndex = 0, rightLaneIndex = 0;
let obstacles = [];
let powerUps = [];
let lastSpawnTime = 0;
let spawnInterval = 900;
let baseSpeed = 2.2;
let speedMultiplier = 1;
let running = false, paused = false, gameOver = false;
let lastTime = 0;
let score = 0;
let totalSwaps = 0, obstaclesDodged = 0;
let revivedUsed = false;
let invulnerableUntil = 0;
let shakeTime = 0;
let particles = [];
let ghostDodgedCount = 0;

// Active power-up effects
let slowMoUntil = 0;
let shieldLeft = 0, shieldRight = 0;   // expiry timestamps
let focusLensUntil = 0;
let scoreBoostUntil = 0;

// Metrics
let metrics = new SessionMetrics();

// Training session state
let activeTraining = null; // { mode, startTime, endTime }

// ─── Difficulty ──────────────────────────────────────────────────────────────
function getCurrentDifficulty() {
    if (activeTraining) {
        return DIFFICULTY[activeTraining.mode.difficulty] || DIFFICULTY.medium;
    }
    return getDifficulty();
}

// ─── Obstacle Types ──────────────────────────────────────────────────────────
// type: 'normal' | 'wide' | 'fast' | 'oscillating' | 'ghost'
function createObstacleData(isLeftSide, laneIndex, obW, obH, timeSeconds) {
    const base = {
        isLeftSide,
        laneIndex,
        x: getLaneX(isLeftSide, laneIndex) + laneWidth * 0.02,
        y: -obH - 10,
        width: obW,
        height: obH,
        type: 'normal',
        threatTagged: false,
        speed: 1,        // multiplier on base speed
        oscillatePhase: 0,
        ghostVisible: true,
        ghostTimer: 0,
    };

    // Determine obstacle type based on elapsed time
    if (timeSeconds > 60 && Math.random() < 0.08) {
        base.type = 'ghost';
        base.ghostTimer = 0;
    } else if (timeSeconds > 40 && Math.random() < 0.10) {
        base.type = 'oscillating';
        base.oscillatePhase = Math.random() * Math.PI * 2;
    } else if (timeSeconds > 25 && Math.random() < 0.12) {
        base.type = 'fast';
        base.speed = 2;
        base.width = obW * 0.7;
        base.height = obH * 0.8;
    } else if (timeSeconds > 15 && Math.random() < 0.10) {
        base.type = 'wide';
        base.width = laneWidth * 0.80 * 2; // ~80% of zone width
        base.x = getLaneX(isLeftSide, 0) + laneWidth * 0.02; // spans both lanes
        base.laneIndex = -1; // special: spans both
    }

    return base;
}

// ─── Power-Up Types ──────────────────────────────────────────────────────────
// type: 'slowmo' | 'shield' | 'focuslens' | 'scoreboost'
const POWERUP_DEFS = [
    { type: 'slowmo',     icon: '⏳', color: '#66ccff', duration: 3000 },
    { type: 'shield',     icon: '⭐', color: '#ffdd44', duration: 5000 },
    { type: 'focuslens',  icon: '👁',  color: '#88ff88', duration: 3000 },
    { type: 'scoreboost', icon: '💎', color: '#ff88ff', duration: 5000 },
];

let lastPowerUpTime = 0;
const POWERUP_MIN_INTERVAL = 5000; // min 5s between power-ups

function trySpawnPowerUp(now, timeSeconds) {
    if (timeSeconds < 5) return; // no power-ups in first 5s
    if (now - lastPowerUpTime < POWERUP_MIN_INTERVAL) return;
    if (Math.random() > 0.12) return; // ~12% chance per spawn cycle

    const def = POWERUP_DEFS[Math.floor(Math.random() * POWERUP_DEFS.length)];
    const isLeftSide = Math.random() < 0.5;
    const lane = Math.random() < 0.5 ? 0 : 1;
    const size = Math.max(18, laneWidth * 0.3);

    powerUps.push({
        ...def,
        isLeftSide,
        laneIndex: lane,
        x: getLaneX(isLeftSide, lane) + laneWidth * 0.2,
        y: -size - 10,
        width: size,
        height: size,
    });
    lastPowerUpTime = now;
}

function activatePowerUp(pu, now) {
    Sound.play('powerup');
    switch (pu.type) {
        case 'slowmo':
            slowMoUntil = now + pu.duration;
            break;
        case 'shield':
            if (pu.isLeftSide) shieldLeft = now + pu.duration;
            else shieldRight = now + pu.duration;
            break;
        case 'focuslens':
            focusLensUntil = now + pu.duration;
            break;
        case 'scoreboost':
            scoreBoostUntil = now + pu.duration;
            break;
    }
    // Particle burst at collection point
    createExplosion(pu.x + pu.width / 2, pu.y + pu.height / 2, pu.color, 8);
}

// ─── Geometry Helpers ────────────────────────────────────────────────────────
function playerRect(isLeftSide) {
    const playerY = H - Math.max(56, H * 0.08);
    const pw = laneWidth * 0.72;
    const ph = Math.max(18, H * 0.026);
    const laneIndex = isLeftSide ? leftLaneIndex : rightLaneIndex;
    return {
        x: getLaneX(isLeftSide, laneIndex) + laneWidth * 0.02,
        y: playerY, width: pw, height: ph
    };
}

function getLaneX(isLeftSide, laneIndex) {
    const globalLaneIndex = isLeftSide ? laneIndex : laneIndex + 2;
    return globalLaneIndex * laneWidth + laneWidth * 0.15;
}

function rectsOverlap(a, b) {
    return !(a.x + a.width < b.x || a.x > b.x + b.width ||
             a.y + a.height < b.y || a.y > b.y + b.height);
}

// ─── Spawning ────────────────────────────────────────────────────────────────
function spawnObstacle(now) {
    const pr = playerRect(true);
    const obW = pr.width;
    const obH = pr.height;
    const timeSeconds = score / 100;

    function pickLaneSafe(isLeftSide, proposedLane) {
        const newY = -obH - 10;
        const otherLane = 1 - proposedLane;
        let minOtherY = Infinity;
        for (const ob of obstacles) {
            if (ob.isLeftSide === isLeftSide && ob.laneIndex === otherLane) {
                if (ob.y < minOtherY) minOtherY = ob.y;
            }
        }
        const safeGap = Math.max(14, obH * 0.8);
        if (minOtherY < newY + obH + safeGap) return otherLane;
        return proposedLane;
    }

    // Check spawn bias from training mode
    const spawnBias = activeTraining?.mode?.spawnBias || null;

    [true, false].forEach(isLeftSide => {
        // Training spawn bias: skip if this side shouldn't get extra obstacles
        // spawnBias 'left' means more obstacles on left, etc.
        if (spawnBias === 'right' && isLeftSide && Math.random() < 0.4) return;
        if (spawnBias === 'left' && !isLeftSide && Math.random() < 0.4) return;

        let laneIndex = Math.random() < 0.5 ? 0 : 1;
        laneIndex = pickLaneSafe(isLeftSide, laneIndex);

        const ob = createObstacleData(isLeftSide, laneIndex, obW, obH, timeSeconds);
        obstacles.push(ob);
    });

    lastSpawnTime = now;
    trySpawnPowerUp(now, timeSeconds);
}

// ─── Near-Miss Detection ─────────────────────────────────────────────────────
function checkNearMiss(ob) {
    const side = ob.isLeftSide ? 'left' : 'right';
    const pr = playerRect(ob.isLeftSide);
    const nearThreshold = laneWidth * 0.20;

    // Obstacle just passed the player y-band without collision
    const xCenter = ob.x + ob.width / 2;
    const pxCenter = pr.x + pr.width / 2;
    const xDist = Math.abs(xCenter - pxCenter);

    if (xDist < nearThreshold + pr.width / 2) {
        metrics.recordNearMiss(side);
        Sound.play('nearmiss');
        // Visual feedback: small particle puff
        createExplosion(pxCenter, pr.y, 'rgba(255,255,100,0.6)', 4);
    }
}

// ─── Threat Tagging (for reaction time) ──────────────────────────────────────
function tagThreats() {
    const threatLine = H * 0.6;
    for (const ob of obstacles) {
        if (!ob.threatTagged && ob.y + ob.height >= threatLine) {
            ob.threatTagged = true;
            ob.threatTimestamp = performance.now();
        }
    }
}

// ─── Reset & Start ───────────────────────────────────────────────────────────
function resetGame() {
    obstacles = [];
    powerUps = [];
    leftLaneIndex = 0;
    rightLaneIndex = 0;
    spawnInterval = 900;
    baseSpeed = 2.2;
    speedMultiplier = 1;
    score = 0;
    totalSwaps = 0;
    obstaclesDodged = 0;
    ghostDodgedCount = 0;
    revivedUsed = false;
    invulnerableUntil = 0;
    particles = [];
    shakeTime = 0;
    slowMoUntil = 0;
    shieldLeft = 0; shieldRight = 0;
    focusLensUntil = 0;
    scoreBoostUntil = 0;
    lastPowerUpTime = 0;

    metrics = new SessionMetrics();
    metrics.startSession();

    scoreEl.textContent = '0';
    gameOver = false;
    paused = false;
    running = true;
    pauseBtn.textContent = 'Pause';

    gameOverOverlay.classList.remove('visible');
    gameOverOverlay.style.display = 'none';

    messageEl.textContent = '';
    lastTime = performance.now();
    lastSpawnTime = lastTime;

    Sound.init();
}

function startIfNotRunning() {
    if (!running) resetGame();
}

function togglePause() {
    if (!running) return;
    paused = !paused;
    pauseBtn.textContent = paused ? 'Resume' : 'Pause';
    messageEl.textContent = paused ? 'Paused' : '';
    lastTime = performance.now();
}

// ─── Update ──────────────────────────────────────────────────────────────────
function update(dt, now) {
    if (!running || paused) return;

    const timeSeconds = score / 100;
    const diff = getCurrentDifficulty();

    // Difficulty-driven speed & spawn
    if (diff.speedFormula) {
        speedMultiplier = diff.speedFormula(timeSeconds);
    } else {
        speedMultiplier = 1 + timeSeconds * 0.12;
    }
    if (diff.spawnFormula) {
        spawnInterval = Math.max(diff.spawnMin || 250, diff.spawnFormula(timeSeconds));
    } else {
        spawnInterval = Math.max(250, 900 - timeSeconds * 50);
    }

    // Slow-mo power-up
    let effectiveSpeedMult = speedMultiplier;
    if (now < slowMoUntil) effectiveSpeedMult *= 0.5;

    const speed = baseSpeed * effectiveSpeedMult;
    metrics.updateSpeed(effectiveSpeedMult);

    // Score
    const scoreMultiplier = (now < scoreBoostUntil) ? 2 : 1;
    score += dt * 0.1 * effectiveSpeedMult * scoreMultiplier;
    scoreEl.textContent = Math.floor(score);

    // Score ping
    const prevScore = score - dt * 0.1 * effectiveSpeedMult * scoreMultiplier;
    if (Math.floor(score / 100) > Math.floor(prevScore / 100)) {
        Sound.play('score');
    }

    if (now - lastSpawnTime > spawnInterval) spawnObstacle(now);

    // Tag threats for reaction-time tracking
    tagThreats();

    const leftPlayer = playerRect(true);
    const rightPlayer = playerRect(false);

    // Shake Decay
    if (shakeTime > 0) shakeTime -= dt;

    // Update Particles
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * dt * 0.06;
        p.y += p.vy * dt * 0.06;
        p.life -= dt;
        if (p.life <= 0) particles.splice(i, 1);
    }

    // Update Power-ups
    for (let i = powerUps.length - 1; i >= 0; i--) {
        const pu = powerUps[i];
        pu.y += speed * dt * 0.06 * 0.7; // fall slightly slower than obstacles

        // Check collection by player
        const player = pu.isLeftSide ? leftPlayer : rightPlayer;
        if (rectsOverlap(pu, player)) {
            activatePowerUp(pu, now);
            powerUps.splice(i, 1);
            continue;
        }

        // Remove if off-screen
        if (pu.y > H + 80) {
            powerUps.splice(i, 1);
        }
    }

    // Update Obstacles
    const isInvulnerable = now < invulnerableUntil;
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const ob = obstacles[i];
        const obSpeed = speed * ob.speed;
        ob.y += obSpeed * dt * 0.06;

        // Oscillating movement
        if (ob.type === 'oscillating') {
            ob.oscillatePhase += dt * 0.004;
            const sway = Math.sin(ob.oscillatePhase) * laneWidth * 0.4;
            const baseX = getLaneX(ob.isLeftSide, ob.laneIndex) + laneWidth * 0.02;
            ob.x = baseX + sway;
        }

        // Ghost visibility toggle
        if (ob.type === 'ghost') {
            ob.ghostTimer += dt;
            ob.ghostVisible = Math.sin(ob.ghostTimer * 0.005) > -0.3;
        }

        // Collision check
        if (!isInvulnerable) {
            // Ghost obstacles only collide when visible
            if (ob.type === 'ghost' && !ob.ghostVisible) {
                // no collision
            } else if (ob.isLeftSide) {
                const shielded = now < shieldLeft;
                if (rectsOverlap(ob, leftPlayer)) {
                    if (shielded) {
                        shieldLeft = 0;
                        obstacles.splice(i, 1);
                        createExplosion(leftPlayer.x + leftPlayer.width / 2, leftPlayer.y, '#ffdd44', 6);
                        continue;
                    }
                    createExplosion(leftPlayer.x + leftPlayer.width / 2, leftPlayer.y + leftPlayer.height / 2, '#55ddff');
                    metrics.recordDeath('left');
                    endGame(); return;
                }
            } else {
                const shielded = now < shieldRight;
                if (rectsOverlap(ob, rightPlayer)) {
                    if (shielded) {
                        shieldRight = 0;
                        obstacles.splice(i, 1);
                        createExplosion(rightPlayer.x + rightPlayer.width / 2, rightPlayer.y, '#ffdd44', 6);
                        continue;
                    }
                    createExplosion(rightPlayer.x + rightPlayer.width / 2, rightPlayer.y + rightPlayer.height / 2, '#ff6688');
                    metrics.recordDeath('right');
                    endGame(); return;
                }
            }
        }

        // Off-screen: dodged
        if (ob.y > H + 80) {
            // Near-miss check before removing
            checkNearMiss(ob);
            const side = ob.isLeftSide ? 'left' : 'right';
            metrics.recordDodge(side);
            obstaclesDodged++;
            if (ob.type === 'ghost') ghostDodgedCount++;
            obstacles.splice(i, 1);
        }
    }

    // Training session timeout
    if (activeTraining && activeTraining.endTime && now >= activeTraining.endTime) {
        endGame();
    }
}

// ─── End Game ────────────────────────────────────────────────────────────────
function endGame() {
    running = false;
    gameOver = true;
    paused = false;
    pauseBtn.textContent = 'Pause';

    Sound.play('crash');
    shakeTime = 500;

    const finalScore = Math.floor(score);
    recordScore(finalScore);

    if (finalScore > Math.floor(bestScore)) {
        bestScore = finalScore;
        setBestScore(bestScore);
        bestScoreEl.textContent = String(Math.floor(bestScore));
    }

    // Set score on metrics before serializing
    metrics.score = finalScore;

    // Populate basic overlay stats
    finalScoreEl.textContent = finalScore;
    finalHighEl.textContent = Math.floor(bestScore);
    statSwapsEl.textContent = totalSwaps;
    statDodgedEl.textContent = obstaclesDodged;

    // Enhanced results
    const metricsJSON = metrics.toJSON();
    populateResults(metricsJSON, {
        finalScoreEl, finalHighEl, statSwapsEl, statDodgedEl,
        statDurationEl, statSpeedEl, lrBreakdownEl, aaiGaugeEl,
        aaiLabelEl, timelineCanvas, insightsEl,
    });

    // Save full session
    saveSession({
        score: finalScore,
        best: Math.floor(bestScore),
        ...metricsJSON,
        date: new Date().toISOString(),
    });

    // Check achievements
    const sessions = loadSessions();
    const newAchievements = checkAchievements(metricsJSON, sessions.length, ghostDodgedCount);
    if (newAchievements.length > 0) {
        Sound.play('achievement');
    }

    reviveBtn.style.display = revivedUsed ? 'none' : 'flex';
    gameOverOverlay.style.display = 'flex';
    void gameOverOverlay.offsetWidth;
    gameOverOverlay.classList.add('visible');

    activeTraining = null;
}

// ─── Drawing Helpers ─────────────────────────────────────────────────────────
function roundRect(x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
}

function drawPlayer(x, y, w, h, color) {
    const r = Math.min(10, h * 0.35);
    ctx.fillStyle = color;
    roundRect(x, y, w, h, r);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    roundRect(x + w * 0.06, y + h * 0.18, w * 0.55, h * 0.18, r);
    ctx.fill();
}

function drawObstacle(ob) {
    const { x, y, width: w, height: h, type } = ob;
    const r = Math.min(10, h * 0.35);
    const baseColor = ob.isLeftSide ? 'rgba(120,220,255,0.85)' : 'rgba(255,160,190,0.88)';

    let color = baseColor;
    let alpha = 1.0;

    switch (type) {
        case 'wide':
            color = ob.isLeftSide ? 'rgba(100,180,255,0.9)' : 'rgba(255,130,160,0.9)';
            break;
        case 'fast':
            color = ob.isLeftSide ? 'rgba(150,240,255,0.95)' : 'rgba(255,100,130,0.95)';
            break;
        case 'oscillating':
            color = ob.isLeftSide ? 'rgba(100,255,220,0.85)' : 'rgba(255,180,100,0.85)';
            break;
        case 'ghost':
            alpha = ob.ghostVisible ? 0.7 : 0.15;
            color = ob.isLeftSide ? 'rgba(180,200,255,0.9)' : 'rgba(255,200,220,0.9)';
            break;
    }

    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    roundRect(x, y, w, h, r);
    ctx.fill();

    // Inner detail
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    roundRect(x + w * 0.12, y + h * 0.22, w * 0.18, h * 0.56, r);
    ctx.fill();

    // Type indicators
    if (type === 'fast') {
        // Speed lines
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x - 4, y + h * 0.3); ctx.lineTo(x - 10, y + h * 0.3);
        ctx.moveTo(x - 3, y + h * 0.6); ctx.lineTo(x - 8, y + h * 0.6);
        ctx.stroke();
    } else if (type === 'oscillating') {
        // Wavy indicator
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let px = 0; px < w; px += 3) {
            const py = y - 4 + Math.sin(px * 0.3 + ob.oscillatePhase) * 2;
            px === 0 ? ctx.moveTo(x + px, py) : ctx.lineTo(x + px, py);
        }
        ctx.stroke();
    }

    ctx.globalAlpha = 1.0;
}

function drawPowerUp(pu) {
    const { x, y, width: size, icon, color } = pu;
    const now = performance.now();

    // Pulsing glow
    const pulse = 0.5 + 0.5 * Math.sin(now * 0.005);
    ctx.shadowColor = color;
    ctx.shadowBlur = 8 + pulse * 8;

    // Background circle
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.25 + pulse * 0.15;
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2 + 2, 0, Math.PI * 2);
    ctx.fill();

    // Icon
    ctx.globalAlpha = 1;
    ctx.font = `${Math.floor(size * 0.7)}px system-ui`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, x + size / 2, y + size / 2);

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
}

function createExplosion(x, y, color, count = 12) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x, y,
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 0.5) * 8,
            life: 600 + Math.random() * 200,
            color, size: 2 + Math.random() * 3
        });
    }
}

// ─── Render ──────────────────────────────────────────────────────────────────
function render() {
    const now = performance.now();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const dpr = window.devicePixelRatio || 1;
    ctx.scale(dpr, dpr);

    // Background color shift based on speed
    const speedHeat = Math.min(1, (speedMultiplier - 1) / 3);
    const bgLeft = `rgb(${16 + speedHeat * 15}, ${16 - speedHeat * 4}, ${32 - speedHeat * 8})`;
    const bgRight = `rgb(${20 + speedHeat * 15}, ${20 - speedHeat * 4}, ${36 - speedHeat * 8})`;

    // Shake
    let shakeX = 0, shakeY = 0;
    if (shakeTime > 0) {
        const mag = (shakeTime / 500) * 10;
        shakeX = (Math.random() - 0.5) * mag;
        shakeY = (Math.random() - 0.5) * mag;
    }

    ctx.save();
    ctx.translate(shakeX, shakeY);

    ctx.fillStyle = bgLeft;
    ctx.fillRect(0, 0, W / 2, H);
    ctx.fillStyle = bgRight;
    ctx.fillRect(W / 2, 0, W / 2, H);

    // Lane dividers
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 2;
    for (let i = 1; i < 4; i++) {
        const x = i * laneWidth;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(W / 2 - 2, 0, 4, H);

    // Focus lens highlight: show safer lane
    if (now < focusLensUntil) {
        [true, false].forEach(isLeft => {
            const pr = playerRect(isLeft);
            const currentLane = isLeft ? leftLaneIndex : rightLaneIndex;
            // Count threats in each lane
            let threats0 = 0, threats1 = 0;
            for (const ob of obstacles) {
                if (ob.isLeftSide !== isLeft) continue;
                if (ob.y > pr.y - H * 0.4 && ob.y < pr.y) {
                    if (ob.laneIndex === 0) threats0++;
                    else if (ob.laneIndex === 1) threats1++;
                    else { threats0++; threats1++; } // wide
                }
            }
            const saferLane = threats0 <= threats1 ? 0 : 1;
            const saferX = getLaneX(isLeft, saferLane);
            ctx.fillStyle = 'rgba(136,255,136,0.06)';
            ctx.fillRect(saferX - laneWidth * 0.1, 0, laneWidth * 1.2, H);
        });
    }

    // Shield indicators
    if (now < shieldLeft) {
        const lp = playerRect(true);
        ctx.strokeStyle = 'rgba(255,221,68,0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(lp.x + lp.width / 2, lp.y + lp.height / 2, lp.width * 0.7, 0, Math.PI * 2);
        ctx.stroke();
    }
    if (now < shieldRight) {
        const rp = playerRect(false);
        ctx.strokeStyle = 'rgba(255,221,68,0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(rp.x + rp.width / 2, rp.y + rp.height / 2, rp.width * 0.7, 0, Math.PI * 2);
        ctx.stroke();
    }

    // Particles
    particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life / 600;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    });

    // Power-ups
    powerUps.forEach(pu => drawPowerUp(pu));

    // Players (blink if invulnerable)
    if (now < invulnerableUntil && Math.floor(now / 100) % 2 === 0) {
        // skip
    } else {
        const lp = playerRect(true);
        const rp = playerRect(false);
        drawPlayer(lp.x, lp.y, lp.width, lp.height, '#55ddff');
        drawPlayer(rp.x, rp.y, rp.width, rp.height, '#ff6688');
    }

    // Obstacles
    obstacles.forEach(ob => drawObstacle(ob));

    ctx.restore();

    // Active power-up indicators (top of canvas)
    drawActiveEffects(now);

    // Paused overlay
    if (paused) {
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.font = 'bold 28px system-ui, -apple-system, Segoe UI, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('Paused', W / 2, H / 2);
        ctx.font = '14px system-ui';
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillText('Press P or tap Pause to continue', W / 2, H / 2 + 34);
    }

    // Start prompt
    if (!running && !gameOver) {
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.font = 'bold 22px system-ui, -apple-system, Segoe UI, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('Tap left/right to start', W / 2, H / 2);
        ctx.font = '14px system-ui';
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillText('A toggles left • L toggles right • P pauses', W / 2, H / 2 + 30);
    }
}

function drawActiveEffects(now) {
    const effects = [];
    if (now < slowMoUntil) effects.push({ icon: '⏳', label: 'Slow-Mo', remaining: slowMoUntil - now });
    if (now < shieldLeft) effects.push({ icon: '⭐L', label: 'Shield L', remaining: shieldLeft - now });
    if (now < shieldRight) effects.push({ icon: '⭐R', label: 'Shield R', remaining: shieldRight - now });
    if (now < focusLensUntil) effects.push({ icon: '👁', label: 'Focus', remaining: focusLensUntil - now });
    if (now < scoreBoostUntil) effects.push({ icon: '💎', label: '2x Score', remaining: scoreBoostUntil - now });

    if (effects.length === 0) return;

    ctx.font = '11px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const startX = W / 2 - (effects.length - 1) * 35;
    effects.forEach((eff, idx) => {
        const x = startX + idx * 70;
        const barWidth = 40;
        const fraction = Math.min(1, eff.remaining / 5000);

        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillText(eff.icon, x, 6);

        // Timer bar
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(x - barWidth / 2, 22, barWidth, 3);
        ctx.fillStyle = 'rgba(255,204,85,0.6)';
        ctx.fillRect(x - barWidth / 2, 22, barWidth * fraction, 3);
    });
}

// ─── Game Loop ───────────────────────────────────────────────────────────────
function loop(now) {
    requestAnimationFrame(loop);
    const dt = (now - lastTime) || 16;
    lastTime = now;
    update(dt, now);
    render();
}

// ─── Input ───────────────────────────────────────────────────────────────────
function toggleLeft() {
    leftLaneIndex = 1 - leftLaneIndex;
    Sound.play('tap');
    if (running && !gameOver) {
        totalSwaps++;
        metrics.recordSwap('left', obstacles, playerRect, laneWidth, H);
    }
}

function toggleRight() {
    rightLaneIndex = 1 - rightLaneIndex;
    Sound.play('tap');
    if (running && !gameOver) {
        totalSwaps++;
        metrics.recordSwap('right', obstacles, playerRect, laneWidth, H);
    }
}

window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.key === 'p' || e.key === 'P') { togglePause(); return; }
    if (e.key === 'a' || e.key === 'A') {
        if (!running) startIfNotRunning(); else if (!paused) toggleLeft();
        return;
    }
    if (e.key === 'l' || e.key === 'L') {
        if (!running) startIfNotRunning(); else if (!paused) toggleRight();
        return;
    }
});

pauseBtn.addEventListener('click', () => { if (running) togglePause(); });
restartBtn.addEventListener('click', () => resetGame());

function getCanvasXFromEvent(clientX) {
    const rect = canvas.getBoundingClientRect();
    return (clientX - rect.left) * (W / rect.width);
}

function handlePointerAtClientX(clientX) {
    if (!running) { startIfNotRunning(); return; }
    if (paused) return;
    const x = getCanvasXFromEvent(clientX);
    if (x < W / 2) toggleLeft(); else toggleRight();
}

canvas.addEventListener('mousedown', (e) => handlePointerAtClientX(e.clientX));
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
        handlePointerAtClientX(e.changedTouches[i].clientX);
    }
}, { passive: false });

// ─── Revive ──────────────────────────────────────────────────────────────────
function reviveGame() {
    if (revivedUsed) return;
    revivedUsed = true;
    const playerY = H - Math.max(56, H * 0.08);
    obstacles = obstacles.filter(ob => ob.y < playerY - 300);
    powerUps = [];
    running = true;
    gameOver = false;
    invulnerableUntil = performance.now() + 2000;
    lastTime = performance.now();
    lastSpawnTime = lastTime;
    gameOverOverlay.classList.remove('visible');
    setTimeout(() => gameOverOverlay.style.display = 'none', 300);
    Sound.play('revive');
}

restartOverlayBtn.addEventListener('click', () => resetGame());
reviveBtn.addEventListener('click', () => {
    const originalText = reviveBtn.innerHTML;
    reviveBtn.disabled = true;
    reviveBtn.textContent = 'Loading Ad...';
    setTimeout(() => {
        reviveBtn.textContent = 'Ad Playing (3s)...';
        setTimeout(() => {
            reviveGame();
            reviveBtn.textContent = originalText;
            reviveBtn.disabled = false;
        }, 2500);
    }, 800);
});

// ─── Share Buttons ───────────────────────────────────────────────────────────
const btnTwitter = document.getElementById('btnTwitter');
const btnWhatsapp = document.getElementById('btnWhatsapp');
const btnCopy = document.getElementById('btnCopy');
const shareMsgEl = document.getElementById('shareMsg');

function getShareText() {
    const msgs = [
        `My brain just split in two! Scored ${Math.floor(score)} in Split Focus!`,
        `Reflex check: Failed after ${Math.floor(score)} points. Can you beat me?`,
        `I scored ${Math.floor(score)} in a dual-lane panic attack.`,
        `Dual lanes, one brain, ${Math.floor(score)} points. #SplitFocus`
    ];
    return msgs[Math.floor(Math.random() * msgs.length)];
}

btnTwitter?.addEventListener('click', () => {
    const text = getShareText();
    const url = encodeURIComponent(window.location.href);
    const fullText = encodeURIComponent(text + ' Play here: ');
    window.open(`https://twitter.com/intent/tweet?text=${fullText}&url=${url}&hashtags=SplitFocus,IndieGame`, '_blank');
});

btnWhatsapp?.addEventListener('click', () => {
    const text = getShareText();
    const url = window.location.href;
    const fullText = encodeURIComponent(`*Split Focus Challenge!*\n\n${text}\n\nPlay here: ${url}`);
    window.open(`https://wa.me/?text=${fullText}`, '_blank');
});

btnCopy?.addEventListener('click', () => {
    const text = `${getShareText()} Play here: ${window.location.href}`;
    navigator.clipboard.writeText(text).then(() => {
        shareMsgEl.textContent = 'Copied to clipboard!';
        setTimeout(() => shareMsgEl.textContent = 'Share your score', 2000);
    }).catch(() => {
        shareMsgEl.textContent = 'Copy failed';
    });
});

// ─── Settings & Dashboard Buttons ────────────────────────────────────────────
if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
        showSettings();
    });
}

if (dashboardBtn) {
    dashboardBtn.addEventListener('click', () => {
        initDashboard();
        showDashboard();
    });
}

// Training panel
if (trainingBtn) {
    trainingBtn.addEventListener('click', () => {
        showTrainingPanel();
    });
}

function showTrainingPanel() {
    const panel = document.getElementById('trainingPanel');
    if (!panel) return;
    const content = panel.querySelector('.training-content');
    if (!content) return;

    const modes = getTrainingList();
    const cardsHtml = modes.map(m => `
        <div class="training-option" data-mode="${m.id}">
            <h4>${m.name}</h4>
            <p>${m.desc}${m.duration ? ' (' + Math.round(m.duration / 1000) + 's)' : ''}</p>
        </div>
    `).join('');

    content.innerHTML = `
        <h2 style="margin:0; font-size:20px; text-align:center;">Training Modes</h2>
        <p style="font-size:12px; color:var(--muted); text-align:center; margin:0;">Structured sessions targeting specific cognitive skills</p>
        <div class="training-selector">${cardsHtml}</div>
        <button id="trainingClose" style="width:100%;padding:12px;font-weight:600;">Close</button>
    `;

    content.querySelectorAll('.training-option').forEach(card => {
        card.addEventListener('click', () => {
            const modeId = card.dataset.mode;
            panel.classList.remove('visible');
            window.startTrainingSession(modeId);
        });
    });

    content.querySelector('#trainingClose').addEventListener('click', () => {
        panel.classList.remove('visible');
    });

    panel.classList.add('visible');
}

// Difficulty selector
if (difficultySelect) {
    const settings = getSettings();
    difficultySelect.value = settings.difficulty || 'medium';
    difficultySelect.addEventListener('change', (e) => {
        updateSetting('difficulty', e.target.value);
    });
}

// ─── Training Session Start ──────────────────────────────────────────────────
// Exposed globally so training UI can call it
window.startTrainingSession = function(modeId) {
    const mode = getTrainingMode(modeId);
    if (!mode) return;
    resetGame();
    activeTraining = {
        mode,
        startTime: performance.now(),
        endTime: mode.duration ? performance.now() + mode.duration : null,
    };
    messageEl.textContent = `Training: ${mode.name}`;
};

// ─── Tutorial on First Visit ─────────────────────────────────────────────────
if (shouldShowTutorial()) {
    startTutorial(() => {
        unlockTutorialAchievement();
        messageEl.textContent = 'Tap or press A/L to start.';
    });
} else {
    messageEl.textContent = 'Tap or press A/L to start.';
}

// ─── Apply Settings ──────────────────────────────────────────────────────────
applySettings();

// ─── Start Game Loop ─────────────────────────────────────────────────────────
requestAnimationFrame((t) => {
    lastTime = t;
    lastSpawnTime = t;
    requestAnimationFrame(loop);
});
