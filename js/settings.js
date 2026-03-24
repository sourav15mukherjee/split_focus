// settings.js — Difficulty, accessibility, preferences

import { loadSettings, saveSettings, getDefaultSettings, resetTutorial } from './persistence.js';

let _settings = null;

export function getSettings() {
    if (!_settings) _settings = loadSettings();
    return _settings;
}

export function updateSetting(key, value) {
    const s = getSettings();
    s[key] = value;
    saveSettings(s);
    _settings = s;
    applySettings();
}

export function applySettings() {
    const s = getSettings();

    // Colorblind mode
    document.body.classList.remove('cb-blue-orange', 'cb-green-purple');
    if (s.colorblind === 'blue-orange') document.body.classList.add('cb-blue-orange');
    else if (s.colorblind === 'green-purple') document.body.classList.add('cb-green-purple');

    // Reduced motion
    document.body.classList.toggle('reduced-motion', !!s.reducedMotion);

    // High contrast
    document.body.classList.toggle('high-contrast', !!s.highContrast);
}

// Difficulty presets
export const DIFFICULTY = {
    easy: {
        label: 'Easy',
        speedFormula: (t) => 1 + t * 0.06,
        spawnMin: 400,
        spawnFormula: (t) => Math.max(400, 900 - t * 30),
    },
    medium: {
        label: 'Medium',
        speedFormula: (t) => 1 + t * 0.12,
        spawnMin: 250,
        spawnFormula: (t) => Math.max(250, 900 - t * 50),
    },
    hard: {
        label: 'Hard',
        speedFormula: (t) => 1 + t * 0.18,
        spawnMin: 180,
        spawnFormula: (t) => Math.max(180, 900 - t * 65),
    },
    adaptive: {
        label: 'Adaptive',
        speedFormula: (t) => 1 + t * 0.12, // base; adjusted dynamically
        spawnMin: 200,
        spawnFormula: (t) => Math.max(200, 900 - t * 50),
    }
};

export function getDifficulty() {
    const s = getSettings();
    return DIFFICULTY[s.difficulty] || DIFFICULTY.medium;
}

export function initSettingsPanel() {
    const panel = document.getElementById('settingsPanel');
    if (!panel) return;

    const content = panel.querySelector('.settings-content');
    if (!content) return;

    const s = getSettings();

    content.innerHTML = `
        <h2 style="margin:0; font-size:20px; text-align:center;">Settings</h2>

        <div class="settings-section">
            <h3>Accessibility</h3>
            <div class="setting-row">
                <span>Color Palette</span>
                <select id="settColorblind" style="background:rgba(0,0,0,0.4);color:var(--fg);border:1px solid var(--border);border-radius:6px;padding:4px 8px;font-family:inherit;">
                    <option value="none" ${s.colorblind === 'none' ? 'selected' : ''}>Default (Cyan/Pink)</option>
                    <option value="blue-orange" ${s.colorblind === 'blue-orange' ? 'selected' : ''}>Blue/Orange</option>
                    <option value="green-purple" ${s.colorblind === 'green-purple' ? 'selected' : ''}>Green/Purple</option>
                </select>
            </div>
            <div class="setting-row">
                <span>Reduced Motion</span>
                <div id="settReducedMotion" class="toggle-switch ${s.reducedMotion ? 'on' : ''}" tabindex="0" role="switch" aria-checked="${s.reducedMotion}"></div>
            </div>
            <div class="setting-row">
                <span>High Contrast</span>
                <div id="settHighContrast" class="toggle-switch ${s.highContrast ? 'on' : ''}" tabindex="0" role="switch" aria-checked="${s.highContrast}"></div>
            </div>
        </div>

        <div class="settings-section">
            <h3>Game</h3>
            <div class="setting-row">
                <span>Replay Tutorial</span>
                <button id="settReplayTutorial" style="padding:6px 14px;">Replay</button>
            </div>
        </div>

        <button id="settClose" style="width:100%;padding:12px;font-weight:600;">Close</button>
    `;

    // Event listeners
    content.querySelector('#settColorblind').addEventListener('change', (e) => {
        updateSetting('colorblind', e.target.value);
    });

    function setupToggle(id, key) {
        const el = content.querySelector('#' + id);
        if (!el) return;
        const toggle = () => {
            const newVal = !getSettings()[key];
            updateSetting(key, newVal);
            el.classList.toggle('on', newVal);
            el.setAttribute('aria-checked', String(newVal));
        };
        el.addEventListener('click', toggle);
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
        });
    }

    setupToggle('settReducedMotion', 'reducedMotion');
    setupToggle('settHighContrast', 'highContrast');

    content.querySelector('#settReplayTutorial').addEventListener('click', () => {
        resetTutorial();
        panel.classList.remove('visible');
        // Tutorial will trigger on next game start
    });

    content.querySelector('#settClose').addEventListener('click', () => {
        panel.classList.remove('visible');
    });
}

export function showSettings() {
    const panel = document.getElementById('settingsPanel');
    if (panel) {
        initSettingsPanel();
        panel.classList.add('visible');
    }
}
