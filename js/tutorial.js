// tutorial.js — 3-step interactive onboarding

import { isTutorialComplete, setTutorialComplete } from './persistence.js';
import { unlockTutorialAchievement } from './achievements.js';

const STEPS = [
    {
        title: 'Step 1: Left Side',
        text: 'Press <span class="key">A</span> or tap the left half to dodge!',
        instruction: 'Press A to continue',
        requireKey: 'a',
    },
    {
        title: 'Step 2: Right Side',
        text: 'Press <span class="key">L</span> or tap the right half to dodge!',
        instruction: 'Press L to continue',
        requireKey: 'l',
    },
    {
        title: 'Step 3: Split Focus!',
        text: 'Now use <span class="key">A</span> and <span class="key">L</span> together.<br>Split your attention between both sides!',
        instruction: 'Press any key to start playing',
        requireKey: null, // any key
    }
];

let _currentStep = 0;
let _overlay = null;
let _onComplete = null;
let _keyHandler = null;

export function shouldShowTutorial() {
    return !isTutorialComplete();
}

export function startTutorial(onComplete) {
    _currentStep = 0;
    _onComplete = onComplete;
    _overlay = document.getElementById('tutorialOverlay');
    if (!_overlay) return;

    _overlay.classList.add('visible');
    renderStep();

    _keyHandler = (e) => {
        if (e.repeat) return;
        const step = STEPS[_currentStep];
        if (step.requireKey === null || e.key.toLowerCase() === step.requireKey) {
            _currentStep++;
            if (_currentStep >= STEPS.length) {
                completeTutorial();
            } else {
                renderStep();
            }
        }
    };
    window.addEventListener('keydown', _keyHandler);

    // Touch support
    _overlay.addEventListener('click', () => {
        _currentStep++;
        if (_currentStep >= STEPS.length) {
            completeTutorial();
        } else {
            renderStep();
        }
    });
}

function renderStep() {
    if (!_overlay) return;
    const step = STEPS[_currentStep];

    const dotsHtml = STEPS.map((_, i) =>
        `<div class="tutorial-dot ${i <= _currentStep ? 'active' : ''}"></div>`
    ).join('');

    _overlay.innerHTML = `
        <div class="tutorial-box">
            <h2 style="margin:0 0 8px; font-size:22px; color:var(--accent);">${step.title}</h2>
            <div class="tutorial-step">${step.text}</div>
            <p style="font-size:13px; color:var(--muted);">${step.instruction}</p>
            <div class="tutorial-progress">${dotsHtml}</div>
        </div>
    `;
}

function completeTutorial() {
    setTutorialComplete();
    unlockTutorialAchievement();

    if (_keyHandler) {
        window.removeEventListener('keydown', _keyHandler);
        _keyHandler = null;
    }

    if (_overlay) {
        _overlay.classList.remove('visible');
    }

    if (_onComplete) _onComplete();
}
