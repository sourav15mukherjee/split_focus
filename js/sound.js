// sound.js — Synthesized audio system via Web Audio API
export const Sound = {
    ctx: null,
    muted: false,
    _muteBtn: null,

    init() {
        if (this.ctx) return;
        if (!window.AudioContext && !window.webkitAudioContext) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    },

    setMuteBtn(btn) {
        this._muteBtn = btn;
    },

    play(type) {
        if (this.muted || !this.ctx) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);

        const now = this.ctx.currentTime;

        if (type === 'tap') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.exponentialRampToValueAtTime(300, now + 0.1);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
        } else if (type === 'crash') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(100, now);
            osc.frequency.exponentialRampToValueAtTime(20, now + 0.3);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.3);
            osc.start(now);
            osc.stop(now + 0.3);
        } else if (type === 'score') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(800, now);
            gain.gain.setValueAtTime(0.05, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
        } else if (type === 'revive') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.linearRampToValueAtTime(600, now + 0.4);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.4);
            osc.start(now);
            osc.stop(now + 0.4);
        } else if (type === 'powerup') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.exponentialRampToValueAtTime(1200, now + 0.2);
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.25);
            osc.start(now);
            osc.stop(now + 0.25);
        } else if (type === 'achievement') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(523, now);
            osc.frequency.setValueAtTime(659, now + 0.12);
            osc.frequency.setValueAtTime(784, now + 0.24);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.4);
            osc.start(now);
            osc.stop(now + 0.4);
        } else if (type === 'nearmiss') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1000, now);
            osc.frequency.exponentialRampToValueAtTime(500, now + 0.08);
            gain.gain.setValueAtTime(0.04, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.08);
            osc.start(now);
            osc.stop(now + 0.08);
        }
    },

    toggle() {
        this.muted = !this.muted;
        if (this._muteBtn) {
            this._muteBtn.textContent = this.muted ? '🔇' : '🔊';
        }
    }
};
