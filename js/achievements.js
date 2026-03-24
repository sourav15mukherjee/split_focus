// achievements.js — Achievement system with toast notifications

import { loadAchievements, saveAchievements } from './persistence.js';
import { Sound } from './sound.js';

const ACHIEVEMENT_DEFS = [
    { id: 'first_steps', name: 'First Steps', desc: 'Complete the tutorial', icon: '🎓' },
    { id: 'century', name: 'Century', desc: 'Score 100+', icon: '💯' },
    { id: 'high_roller', name: 'High Roller', desc: 'Score 500+', icon: '🏆' },
    { id: 'ambidextrous', name: 'Ambidextrous', desc: 'AAI between -0.05 and +0.05', icon: '⚖️' },
    { id: 'speed_demon', name: 'Speed Demon', desc: 'Survive to 3x speed', icon: '⚡' },
    { id: 'dodge_master', name: 'Dodge Master', desc: '100 dodges in one game', icon: '🎯' },
    { id: 'marathon', name: 'Marathon', desc: 'Survive 2+ minutes', icon: '⏱️' },
    { id: 'steady_hands', name: 'Steady Hands', desc: '<5 unnecessary swaps', icon: '🧘' },
    { id: 'quick_draw', name: 'Quick Draw', desc: 'Avg RT under 250ms', icon: '🔫' },
    { id: 'ghost_hunter', name: 'Ghost Hunter', desc: 'Dodge 10 ghost obstacles', icon: '👻' },
    { id: 'close_calls', name: 'Close Calls', desc: '10+ near misses in one game', icon: '😅' },
    { id: 'five_games', name: 'Dedicated', desc: 'Play 5 games', icon: '🎮' },
    { id: 'twenty_games', name: 'Committed', desc: 'Play 20 games', icon: '🔥' },
];

let _toastQueue = [];
let _toastShowing = false;

export function checkAchievements(metrics, sessionCount, ghostDodged) {
    const unlocked = loadAchievements();
    const newUnlocks = [];

    function tryUnlock(id) {
        if (unlocked[id]) return;
        unlocked[id] = { date: new Date().toISOString() };
        newUnlocks.push(id);
    }

    // Score
    if (metrics.score >= 100) tryUnlock('century');
    if (metrics.score >= 500) tryUnlock('high_roller');

    // Balance
    if (metrics.totalDodged >= 10 && Math.abs(metrics.aai) < 0.05) tryUnlock('ambidextrous');

    // Speed
    if (metrics.maxSpeed >= 3) tryUnlock('speed_demon');

    // Dodges
    if (metrics.totalDodged >= 100) tryUnlock('dodge_master');

    // Duration
    if (metrics.duration >= 120000) tryUnlock('marathon');

    // Efficiency
    if (metrics.totalSwaps >= 10 && metrics.unnecessarySwaps < 5) tryUnlock('steady_hands');

    // Reaction time
    const avgRT = (metrics.leftRT_avg + metrics.rightRT_avg) / 2;
    if (avgRT > 0 && avgRT < 250 && metrics.totalDodged >= 10) tryUnlock('quick_draw');

    // Ghost
    if (ghostDodged >= 10) tryUnlock('ghost_hunter');

    // Near misses
    if (metrics.totalNearMisses >= 10) tryUnlock('close_calls');

    // Games played
    if (sessionCount >= 5) tryUnlock('five_games');
    if (sessionCount >= 20) tryUnlock('twenty_games');

    if (newUnlocks.length > 0) {
        saveAchievements(unlocked);
        for (const id of newUnlocks) {
            const def = ACHIEVEMENT_DEFS.find(a => a.id === id);
            if (def) showAchievementToast(def);
        }
    }

    return newUnlocks;
}

export function unlockTutorialAchievement() {
    const unlocked = loadAchievements();
    if (!unlocked.first_steps) {
        unlocked.first_steps = { date: new Date().toISOString() };
        saveAchievements(unlocked);
        const def = ACHIEVEMENT_DEFS.find(a => a.id === 'first_steps');
        if (def) showAchievementToast(def);
    }
}

function showAchievementToast(def) {
    _toastQueue.push(def);
    if (!_toastShowing) processToastQueue();
}

function processToastQueue() {
    if (_toastQueue.length === 0) {
        _toastShowing = false;
        return;
    }

    _toastShowing = true;
    const def = _toastQueue.shift();

    // Create toast element
    let toast = document.querySelector('.achievement-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'achievement-toast';
        document.body.appendChild(toast);
    }

    toast.innerHTML = `
        <span class="ach-icon">${def.icon}</span>
        <div class="ach-text">
            <div class="ach-name">${def.name}</div>
            <div style="font-size:11px;color:var(--muted);">${def.desc}</div>
        </div>
    `;

    Sound.play('achievement');

    // Animate in
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    // Animate out after 3s
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => processToastQueue(), 400);
    }, 3000);
}

export function getAchievementList() {
    const unlocked = loadAchievements();
    return ACHIEVEMENT_DEFS.map(def => ({
        ...def,
        unlocked: !!unlocked[def.id],
        date: unlocked[def.id]?.date || null,
    }));
}
