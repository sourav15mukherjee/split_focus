// persistence.js — localStorage session storage + backward compat

const BEST_KEY = 'splitFocusBestScore';
const HIST_KEY = 'splitFocusLast5';
const SESSIONS_KEY = 'splitFocusSessions';
const SETTINGS_KEY = 'splitFocusSettings';
const ACHIEVEMENTS_KEY = 'splitFocusAchievements';
const TUTORIAL_KEY = 'splitFocusTutorialComplete';

export function getBestScore() {
    return parseFloat(localStorage.getItem(BEST_KEY) || '0');
}

export function setBestScore(val) {
    localStorage.setItem(BEST_KEY, String(val));
}

export function loadHistory() {
    try {
        const raw = localStorage.getItem(HIST_KEY);
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr : [];
    } catch {
        return [];
    }
}

export function saveHistory(arr) {
    localStorage.setItem(HIST_KEY, JSON.stringify(arr.slice(0, 5)));
}

// Full session storage (last 50)
export function loadSessions() {
    try {
        const raw = localStorage.getItem(SESSIONS_KEY);
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr : [];
    } catch {
        return [];
    }
}

export function saveSession(session) {
    const sessions = loadSessions();
    sessions.unshift(session);
    // Keep last 50
    if (sessions.length > 50) sessions.length = 50;
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

// Settings
export function loadSettings() {
    try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        return raw ? JSON.parse(raw) : getDefaultSettings();
    } catch {
        return getDefaultSettings();
    }
}

export function saveSettings(settings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function getDefaultSettings() {
    return {
        difficulty: 'medium',
        colorblind: 'none',
        reducedMotion: false,
        highContrast: false,
    };
}

// Achievements
export function loadAchievements() {
    try {
        const raw = localStorage.getItem(ACHIEVEMENTS_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

export function saveAchievements(obj) {
    localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(obj));
}

// Tutorial
export function isTutorialComplete() {
    return localStorage.getItem(TUTORIAL_KEY) === 'true';
}

export function setTutorialComplete() {
    localStorage.setItem(TUTORIAL_KEY, 'true');
}

export function resetTutorial() {
    localStorage.removeItem(TUTORIAL_KEY);
}

// Data export
export function exportJSON() {
    const data = {
        sessions: loadSessions(),
        bestScore: getBestScore(),
        achievements: loadAchievements(),
        settings: loadSettings(),
        exportDate: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    downloadBlob(blob, 'split-focus-data.json');
}

export function exportCSV() {
    const sessions = loadSessions();
    if (sessions.length === 0) return;

    const headers = [
        'date', 'score', 'duration_ms', 'mode', 'difficulty',
        'left_rt_avg', 'right_rt_avg', 'aai',
        'left_dodged', 'right_dodged', 'left_swaps', 'right_swaps',
        'left_near_misses', 'right_near_misses', 'death_side',
        'max_speed'
    ];

    const rows = sessions.map(s => [
        s.date || '', Math.floor(s.score || 0), Math.floor(s.duration || 0),
        s.mode || 'free', s.difficulty || 'medium',
        (s.leftRT_avg || 0).toFixed(0), (s.rightRT_avg || 0).toFixed(0),
        (s.aai || 0).toFixed(3),
        s.leftDodged || 0, s.rightDodged || 0,
        s.leftSwaps || 0, s.rightSwaps || 0,
        s.leftNearMisses || 0, s.rightNearMisses || 0,
        s.deathSide || '', (s.maxSpeed || 0).toFixed(2)
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    downloadBlob(blob, 'split-focus-data.csv');
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
