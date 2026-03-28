// metrics.js — Cognitive metric tracking per session

export class SessionMetrics {
    constructor() {
        this.reset();
    }

    reset() {
        this.startTime = performance.now();
        this.endTime = 0;

        // Per-side swaps
        this.leftSwaps = 0;
        this.rightSwaps = 0;

        // Per-side dodges
        this.leftDodged = 0;
        this.rightDodged = 0;

        // Death
        this.deathSide = null; // 'left' | 'right' | null

        // Reaction times (ms)
        this.leftReactionTimes = [];
        this.rightReactionTimes = [];

        // Near misses
        this.leftNearMisses = 0;
        this.rightNearMisses = 0;

        // Time bins (10s intervals)
        this.timeBins = [];
        this._currentBin = null;
        this._binStart = 0;

        // Swap patterns
        this.panicSwaps = 0;       // rapid back-and-forth < 200ms
        this.unnecessarySwaps = 0; // no approaching obstacle on that side
        this._lastLeftSwapTime = 0;
        this._lastRightSwapTime = 0;

        // Speed tracking
        this.maxSpeed = 0;

        // Score
        this.score = 0;
    }

    startSession() {
        this.startTime = performance.now();
        this._startNewBin();
    }

    _startNewBin() {
        this._currentBin = {
            startTime: performance.now(),
            leftSwaps: 0,
            rightSwaps: 0,
            leftDodged: 0,
            rightDodged: 0,
            leftRTs: [],
            rightRTs: [],
            leftNearMisses: 0,
            rightNearMisses: 0,
        };
        this._binStart = performance.now();
    }

    _checkBinRollover() {
        if (!this._currentBin) this._startNewBin();
        const elapsed = performance.now() - this._binStart;
        if (elapsed >= 10000) {
            this.timeBins.push({ ...this._currentBin, duration: elapsed });
            this._startNewBin();
        }
    }

    recordSwap(side, obstacles, playerRect, laneWidth, H) {
        this._checkBinRollover();
        const now = performance.now();

        if (side === 'left') {
            this.leftSwaps++;
            if (this._currentBin) this._currentBin.leftSwaps++;

            // Check panic swap
            if (now - this._lastLeftSwapTime < 200) this.panicSwaps++;
            this._lastLeftSwapTime = now;

            // Check unnecessary swap — no obstacle approaching on left within threat zone
            const hasApproaching = obstacles.some(ob =>
                ob.isLeftSide && ob.y > 0 && ob.y < H * 0.8
            );
            if (!hasApproaching) this.unnecessarySwaps++;
        } else {
            this.rightSwaps++;
            if (this._currentBin) this._currentBin.rightSwaps++;

            if (now - this._lastRightSwapTime < 200) this.panicSwaps++;
            this._lastRightSwapTime = now;

            const hasApproaching = obstacles.some(ob =>
                !ob.isLeftSide && ob.y > 0 && ob.y < H * 0.8
            );
            if (!hasApproaching) this.unnecessarySwaps++;
        }

        // Reaction time: find nearest same-side obstacle in reaction zone (60%-90% of H)
        const reactionZoneTop = H * 0.6;
        const reactionZoneBottom = H * 0.9;
        let closest = null;
        let closestDist = Infinity;

        for (const ob of obstacles) {
            const matchSide = side === 'left' ? ob.isLeftSide : !ob.isLeftSide;
            if (matchSide && ob.y >= reactionZoneTop && ob.y <= reactionZoneBottom && ob.threatTimestamp) {
                const dist = Math.abs(ob.y - reactionZoneBottom);
                if (dist < closestDist) {
                    closestDist = dist;
                    closest = ob;
                }
            }
        }

        if (closest && closest.threatTimestamp) {
            const rt = now - closest.threatTimestamp;
            if (rt > 0 && rt < 5000) { // sanity check
                if (side === 'left') {
                    this.leftReactionTimes.push(rt);
                    if (this._currentBin) this._currentBin.leftRTs.push(rt);
                } else {
                    this.rightReactionTimes.push(rt);
                    if (this._currentBin) this._currentBin.rightRTs.push(rt);
                }
                closest.threatTimestamp = null; // consume
            }
        }
    }

    recordDodge(side) {
        this._checkBinRollover();
        if (side === 'left') {
            this.leftDodged++;
            if (this._currentBin) this._currentBin.leftDodged++;
        } else {
            this.rightDodged++;
            if (this._currentBin) this._currentBin.rightDodged++;
        }
    }

    recordNearMiss(side) {
        this._checkBinRollover();
        if (side === 'left') {
            this.leftNearMisses++;
            if (this._currentBin) this._currentBin.leftNearMisses++;
        } else {
            this.rightNearMisses++;
            if (this._currentBin) this._currentBin.rightNearMisses++;
        }
    }

    recordDeath(side) {
        this.deathSide = side;
        this.endTime = performance.now();
        // Finalize last bin
        if (this._currentBin) {
            this.timeBins.push({
                ...this._currentBin,
                duration: performance.now() - this._binStart
            });
        }
    }

    updateSpeed(speed) {
        if (speed > this.maxSpeed) this.maxSpeed = speed;
    }

    // Computed metrics
    get duration() {
        const end = this.endTime || performance.now();
        return end - this.startTime;
    }

    get totalSwaps() { return this.leftSwaps + this.rightSwaps; }
    get totalDodged() { return this.leftDodged + this.rightDodged; }
    get totalNearMisses() { return this.leftNearMisses + this.rightNearMisses; }

    _avg(arr) {
        if (arr.length === 0) return 0;
        return arr.reduce((a, b) => a + b, 0) / arr.length;
    }

    _median(arr) {
        if (arr.length === 0) return 0;
        const sorted = [...arr].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    }

    _sd(arr) {
        if (arr.length < 2) return 0;
        const mean = this._avg(arr);
        const sqDiffs = arr.map(v => (v - mean) ** 2);
        return Math.sqrt(sqDiffs.reduce((a, b) => a + b, 0) / arr.length);
    }

    get leftRT_avg() { return this._avg(this.leftReactionTimes); }
    get rightRT_avg() { return this._avg(this.rightReactionTimes); }
    get leftRT_median() { return this._median(this.leftReactionTimes); }
    get rightRT_median() { return this._median(this.rightReactionTimes); }

    // Attention Asymmetry Index: -1 (left bias) → 0 (balanced) → +1 (right bias)
    get aai() {
        const l = this.leftRT_avg;
        const r = this.rightRT_avg;
        if (l === 0 && r === 0) return 0;
        if (l === 0 || r === 0) return 0;
        return (r - l) / (r + l);
    }

    // Serialize for persistence
    toJSON() {
        return {
            date: new Date().toISOString(),
            score: this.score,
            duration: this.duration,
            totalSwaps: this.totalSwaps,
            leftSwaps: this.leftSwaps,
            rightSwaps: this.rightSwaps,
            totalDodged: this.totalDodged,
            leftDodged: this.leftDodged,
            rightDodged: this.rightDodged,
            totalNearMisses: this.totalNearMisses,
            leftRT_avg: this.leftRT_avg,
            rightRT_avg: this.rightRT_avg,
            leftRT_median: this.leftRT_median,
            rightRT_median: this.rightRT_median,
            aai: this.aai,
            leftNearMisses: this.leftNearMisses,
            rightNearMisses: this.rightNearMisses,
            deathSide: this.deathSide,
            maxSpeed: this.maxSpeed,
            panicSwaps: this.panicSwaps,
            unnecessarySwaps: this.unnecessarySwaps,
            timeBins: this.timeBins.map(b => ({
                leftSwaps: b.leftSwaps,
                rightSwaps: b.rightSwaps,
                leftDodged: b.leftDodged,
                rightDodged: b.rightDodged,
                leftRT_avg: this._avg(b.leftRTs),
                rightRT_avg: this._avg(b.rightRTs),
                leftNearMisses: b.leftNearMisses,
                rightNearMisses: b.rightNearMisses,
                duration: b.duration,
            })),
        };
    }
}
