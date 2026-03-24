// dashboard.js — Progress dashboard with canvas-drawn charts

import { loadSessions, exportJSON, exportCSV } from './persistence.js';
import { getAchievementList } from './achievements.js';

export function initDashboard() {
    const panel = document.getElementById('dashboardPanel');
    if (!panel) return;

    const content = panel.querySelector('.dashboard-content');
    if (!content) return;

    const sessions = loadSessions();

    content.innerHTML = `
        <h2 style="margin:0; font-size:20px; text-align:center;">Progress Dashboard</h2>

        <div class="dashboard-card">
            <h3>Personal Records</h3>
            <div class="records-grid" id="recordsGrid"></div>
        </div>

        <div class="dashboard-card">
            <h3>Score Trend</h3>
            <canvas id="chartScore"></canvas>
        </div>

        <div class="dashboard-card">
            <h3>Reaction Time Trend</h3>
            <canvas id="chartRT"></canvas>
        </div>

        <div class="dashboard-card">
            <h3>Attention Balance (AAI)</h3>
            <canvas id="chartAAI"></canvas>
        </div>

        <div class="dashboard-card">
            <h3>Achievements</h3>
            <div id="achievementGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;"></div>
        </div>

        <div class="dashboard-card">
            <h3>Export Data</h3>
            <div style="display:flex;gap:8px;">
                <button id="exportJSON" style="flex:1;">Export JSON</button>
                <button id="exportCSV" style="flex:1;">Export CSV</button>
            </div>
        </div>

        <button id="dashClose" style="width:100%;padding:12px;font-weight:600;">Close</button>
    `;

    // Records
    populateRecords(sessions);

    // Charts
    if (sessions.length > 0) {
        drawScoreChart(document.getElementById('chartScore'), sessions);
        drawRTChart(document.getElementById('chartRT'), sessions);
        drawAAIChart(document.getElementById('chartAAI'), sessions);
    }

    // Achievements
    populateAchievements();

    // Export buttons
    document.getElementById('exportJSON').addEventListener('click', exportJSON);
    document.getElementById('exportCSV').addEventListener('click', exportCSV);

    document.getElementById('dashClose').addEventListener('click', () => {
        panel.classList.remove('visible');
    });
}

function populateRecords(sessions) {
    const grid = document.getElementById('recordsGrid');
    if (!grid || sessions.length === 0) {
        if (grid) grid.innerHTML = '<p style="grid-column:span 3;color:var(--muted);font-size:13px;">No sessions yet. Play a game!</p>';
        return;
    }

    const bestScore = Math.max(...sessions.map(s => s.score || 0));
    const bestRT = Math.min(
        ...sessions.filter(s => s.leftRT_avg > 0 || s.rightRT_avg > 0)
            .map(s => Math.min(s.leftRT_avg || 9999, s.rightRT_avg || 9999))
    ) || 0;
    const bestAAI = Math.min(...sessions.filter(s => s.aai !== undefined).map(s => Math.abs(s.aai)));

    grid.innerHTML = `
        <div class="record-item">
            <div class="record-val">${Math.floor(bestScore)}</div>
            <div class="record-label">Best Score</div>
        </div>
        <div class="record-item">
            <div class="record-val">${bestRT > 0 && bestRT < 9999 ? Math.round(bestRT) + 'ms' : '—'}</div>
            <div class="record-label">Best RT</div>
        </div>
        <div class="record-item">
            <div class="record-val">${isFinite(bestAAI) ? bestAAI.toFixed(3) : '—'}</div>
            <div class="record-label">Best AAI</div>
        </div>
    `;
}

function populateAchievements() {
    const grid = document.getElementById('achievementGrid');
    if (!grid) return;

    const achievements = getAchievementList();
    grid.innerHTML = achievements.map(a => `
        <div style="padding:8px;border-radius:8px;background:rgba(0,0,0,0.2);text-align:center;opacity:${a.unlocked ? 1 : 0.3};">
            <div style="font-size:24px;">${a.icon}</div>
            <div style="font-size:11px;font-weight:600;margin-top:2px;">${a.name}</div>
            <div style="font-size:10px;color:var(--muted);">${a.desc}</div>
        </div>
    `).join('');
}

// Chart drawing utilities
function setupCanvas(canvas) {
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    return { ctx, w: rect.width, h: rect.height };
}

function drawLineChart(canvas, dataPoints, color, yMin, yMax) {
    const setup = setupCanvas(canvas);
    if (!setup || dataPoints.length === 0) return;
    const { ctx, w, h } = setup;

    const pad = { top: 10, bottom: 20, left: 5, right: 5 };
    const plotW = w - pad.left - pad.right;
    const plotH = h - pad.top - pad.bottom;

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
        const y = pad.top + (plotH / 4) * i;
        ctx.beginPath();
        ctx.moveTo(pad.left, y);
        ctx.lineTo(w - pad.right, y);
        ctx.stroke();
    }

    // Data line
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.beginPath();

    const range = yMax - yMin || 1;
    dataPoints.forEach((val, i) => {
        const x = pad.left + (i / Math.max(1, dataPoints.length - 1)) * plotW;
        const y = pad.top + plotH - ((val - yMin) / range) * plotH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Dots
    ctx.fillStyle = color;
    dataPoints.forEach((val, i) => {
        const x = pad.left + (i / Math.max(1, dataPoints.length - 1)) * plotW;
        const y = pad.top + plotH - ((val - yMin) / range) * plotH;
        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, Math.PI * 2);
        ctx.fill();
    });
}

function drawScoreChart(canvas, sessions) {
    const scores = sessions.slice().reverse().map(s => s.score || 0);
    const max = Math.max(...scores, 10);
    drawLineChart(canvas, scores, '#ffcc55', 0, max * 1.1);
}

function drawRTChart(canvas, sessions) {
    const setup = setupCanvas(canvas);
    if (!setup) return;
    const { ctx, w, h } = setup;

    const reversed = sessions.slice().reverse();
    const leftRTs = reversed.map(s => s.leftRT_avg || 0);
    const rightRTs = reversed.map(s => s.rightRT_avg || 0);
    const allRTs = [...leftRTs, ...rightRTs].filter(v => v > 0);
    if (allRTs.length === 0) return;

    const yMax = Math.max(...allRTs) * 1.1;
    const yMin = 0;
    const pad = { top: 10, bottom: 20, left: 5, right: 5 };
    const plotW = w - pad.left - pad.right;
    const plotH = h - pad.top - pad.bottom;
    const range = yMax - yMin || 1;

    // Left RT line (cyan)
    ctx.strokeStyle = 'rgba(85, 221, 255, 0.8)';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    leftRTs.forEach((val, i) => {
        if (val <= 0) return;
        const x = pad.left + (i / Math.max(1, leftRTs.length - 1)) * plotW;
        const y = pad.top + plotH - ((val - yMin) / range) * plotH;
        if (i === 0 || leftRTs[i - 1] <= 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Right RT line (pink)
    ctx.strokeStyle = 'rgba(255, 102, 136, 0.8)';
    ctx.beginPath();
    rightRTs.forEach((val, i) => {
        if (val <= 0) return;
        const x = pad.left + (i / Math.max(1, rightRTs.length - 1)) * plotW;
        const y = pad.top + plotH - ((val - yMin) / range) * plotH;
        if (i === 0 || rightRTs[i - 1] <= 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();
}

function drawAAIChart(canvas, sessions) {
    const aais = sessions.slice().reverse().map(s => s.aai || 0);
    // AAI ranges -1 to +1, but typically small
    const absMax = Math.max(0.2, ...aais.map(Math.abs));
    drawLineChart(canvas, aais, '#ffcc55', -absMax, absMax);

    // Draw center line (0)
    const setup = setupCanvas(canvas);
    if (!setup) return;
    const { ctx, w, h } = setup;
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(5, h / 2);
    ctx.lineTo(w - 5, h / 2);
    ctx.stroke();
    ctx.setLineDash([]);
}

export function showDashboard() {
    const panel = document.getElementById('dashboardPanel');
    if (panel) {
        initDashboard();
        panel.classList.add('visible');
    }
}
