// training.js — Structured training session definitions

export const TRAINING_MODES = {
    baseline: {
        id: 'baseline',
        name: 'Baseline',
        desc: '60s standard medium difficulty',
        duration: 60000,
        difficulty: 'medium',
        spawnBias: null,
    },
    left_focus: {
        id: 'left_focus',
        name: 'Left Focus',
        desc: '70% obstacles on left side',
        duration: 60000,
        difficulty: 'medium',
        spawnBias: { left: 0.7, right: 0.3 },
    },
    right_focus: {
        id: 'right_focus',
        name: 'Right Focus',
        desc: '70% obstacles on right side',
        duration: 60000,
        difficulty: 'medium',
        spawnBias: { left: 0.3, right: 0.7 },
    },
    sustained: {
        id: 'sustained',
        name: 'Sustained Attention',
        desc: '3min constant medium, no ramp',
        duration: 180000,
        difficulty: 'medium',
        noRamp: true,
    },
    adaptive_threshold: {
        id: 'adaptive_threshold',
        name: 'Adaptive Threshold',
        desc: 'Continuous ramp until failure',
        duration: null, // endless
        difficulty: 'adaptive',
    },
    speed_focus: {
        id: 'speed_focus',
        name: 'Speed Focus',
        desc: 'Only fast obstacles',
        duration: 60000,
        difficulty: 'hard',
        obstacleTypes: ['fast'],
    },
};

export function getTrainingMode(id) {
    return TRAINING_MODES[id] || null;
}

export function getTrainingList() {
    return Object.values(TRAINING_MODES);
}
