// results.js — Enhanced results screen with L/R breakdown, AAI, timeline, insights

export function populateResults(metrics, elements) {
    const {
        finalScoreEl, finalHighEl, statSwapsEl, statDodgedEl,
        statDurationEl, statSpeedEl,
        lrBreakdownEl, aaiGaugeEl, aaiLabelEl,
        timelineCanvas, insightsEl
    } = elements;

    const score = Math.floor(metrics.score);
    const duration = metrics.duration;

    // Section A — score summary
    if (finalScoreEl) finalScoreEl.textContent = score;
    if (statSwapsEl) statSwapsEl.textContent = metrics.totalSwaps;
    if (statDodgedEl) statDodgedEl.textContent = metrics.totalDodged;
    if (statDurationEl) statDurationEl.textContent = formatDuration(duration);
    if (statSpeedEl) statSpeedEl.textContent = metrics.maxSpeed.toFixed(1) + 'x';

    // Section B — L/R breakdown
    if (lrBreakdownEl) {
        lrBreakdownEl.innerHTML = `
            <div class="lr-side left">
                <h4>Left</h4>
                <div class="lr-row"><span class="lbl">Dodged</span><span class="val">${metrics.leftDodged}</span></div>
                <div class="lr-row"><span class="lbl">Swaps</span><span class="val">${metrics.leftSwaps}</span></div>
                <div class="lr-row"><span class="lbl">Avg RT</span><span class="val">${metrics.leftRT_avg > 0 ? Math.round(metrics.leftRT_avg) + 'ms' : '—'}</span></div>
                <div class="lr-row"><span class="lbl">Near Miss</span><span class="val">${metrics.leftNearMisses}</span></div>
                ${metrics.deathSide === 'left' ? '<div class="lr-row" style="color:#ff6666"><span class="lbl">Death</span><span class="val">Here</span></div>' : ''}
            </div>
            <div class="lr-side right">
                <h4>Right</h4>
                <div class="lr-row"><span class="lbl">Dodged</span><span class="val">${metrics.rightDodged}</span></div>
                <div class="lr-row"><span class="lbl">Swaps</span><span class="val">${metrics.rightSwaps}</span></div>
                <div class="lr-row"><span class="lbl">Avg RT</span><span class="val">${metrics.rightRT_avg > 0 ? Math.round(metrics.rightRT_avg) + 'ms' : '—'}</span></div>
                <div class="lr-row"><span class="lbl">Near Miss</span><span class="val">${metrics.rightNearMisses}</span></div>
                ${metrics.deathSide === 'right' ? '<div class="lr-row" style="color:#ff6666"><span class="lbl">Death</span><span class="val">Here</span></div>' : ''}
            </div>`;
    }

    // AAI gauge
    if (aaiGaugeEl) {
        const aai = metrics.aai;
        // Map AAI (-1 to +1) → percentage (0% to 100%)
        const pct = ((aai + 1) / 2) * 100;
        const fill = aaiGaugeEl.querySelector('.aai-fill');
        if (fill) {
            fill.style.left = `calc(${pct}% - 4px)`;
        }
    }
    if (aaiLabelEl) {
        const aai = metrics.aai;
        let label = 'Balanced';
        if (aai < -0.15) label = 'Left-biased';
        else if (aai < -0.05) label = 'Slightly left';
        else if (aai > 0.15) label = 'Right-biased';
        else if (aai > 0.05) label = 'Slightly right';
        aaiLabelEl.textContent = `AAI: ${aai.toFixed(3)} — ${label}`;
    }

    // Section C — Timeline
    if (timelineCanvas && metrics.timeBins.length > 0) {
        drawTimeline(timelineCanvas, metrics);
    }

    // Section D — Insights
    if (insightsEl) {
        insightsEl.innerHTML = generateInsights(metrics).map(i =>
            `<div class="insight-item">${i}</div>`
        ).join('');
    }
}

function drawTimeline(canvas, metrics) {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const bins = metrics.timeBins;
    if (bins.length === 0) return;

    const binW = w / bins.length;
    const maxDodge = Math.max(1, ...bins.map(b => b.leftDodged + b.rightDodged));

    bins.forEach((bin, i) => {
        const x = i * binW;
        const leftH = (bin.leftDodged / maxDodge) * (h * 0.45);
        const rightH = (bin.rightDodged / maxDodge) * (h * 0.45);

        // Left (top half, cyan)
        ctx.fillStyle = 'rgba(85, 221, 255, 0.6)';
        ctx.fillRect(x + 1, h / 2 - leftH, binW - 2, leftH);

        // Right (bottom half, pink)
        ctx.fillStyle = 'rgba(255, 102, 136, 0.6)';
        ctx.fillRect(x + 1, h / 2, binW - 2, rightH);
    });

    // Center line
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    // Mark death bin
    if (bins.length > 0) {
        const lastBinX = (bins.length - 1) * binW + binW / 2;
        ctx.fillStyle = 'rgba(255, 80, 80, 0.8)';
        ctx.beginPath();
        ctx.arc(lastBinX, h / 2, 4, 0, Math.PI * 2);
        ctx.fill();
    }
}

function generateInsights(m) {
    const insights = [];

    // AAI insight
    const aai = m.aai;
    if (Math.abs(aai) < 0.05) {
        insights.push(`Excellent balance! Your AAI of ${aai.toFixed(3)} indicates evenly distributed attention.`);
    } else if (aai < -0.15) {
        insights.push(`You favor your left side — try focusing more on the right. AAI: ${aai.toFixed(3)}`);
    } else if (aai > 0.15) {
        insights.push(`You favor your right side — try focusing more on the left. AAI: ${aai.toFixed(3)}`);
    } else if (aai < -0.05) {
        insights.push(`Slight left-side bias detected (AAI: ${aai.toFixed(3)}). Nearly balanced!`);
    } else if (aai > 0.05) {
        insights.push(`Slight right-side bias detected (AAI: ${aai.toFixed(3)}). Nearly balanced!`);
    }

    // Vigilance decrement detection
    if (m.timeBins.length >= 3) {
        const firstThird = m.timeBins.slice(0, Math.ceil(m.timeBins.length / 3));
        const lastThird = m.timeBins.slice(-Math.ceil(m.timeBins.length / 3));

        const avgFirst = (arr) => {
            const rts = arr.flatMap(b => [b.leftRT_avg, b.rightRT_avg].filter(r => r > 0));
            return rts.length > 0 ? rts.reduce((a, b) => a + b, 0) / rts.length : 0;
        };

        const earlyRT = avgFirst(firstThird);
        const lateRT = avgFirst(lastThird);

        if (earlyRT > 0 && lateRT > 0 && lateRT > earlyRT * 1.3) {
            const pctSlower = Math.round(((lateRT - earlyRT) / earlyRT) * 100);
            insights.push(`Reactions slowed ${pctSlower}% in the final third — attention fatigue detected.`);
        }
    }

    // Panic swaps
    if (m.panicSwaps > 5) {
        insights.push(`${m.panicSwaps} panic swaps detected (rapid back-and-forth). Try more deliberate movements.`);
    }

    // Near misses
    if (m.totalNearMisses > 0) {
        insights.push(`${m.totalNearMisses} near miss${m.totalNearMisses > 1 ? 'es' : ''} — close calls show good reflexes under pressure!`);
    }

    // Speed milestone
    if (m.maxSpeed >= 3) {
        insights.push(`Survived to ${m.maxSpeed.toFixed(1)}x speed — impressive processing speed!`);
    }

    // If no interesting insights, give duration
    if (insights.length === 0) {
        insights.push(`Survived ${formatDuration(m.duration)}. Keep practicing to improve!`);
    }

    return insights;
}

function formatDuration(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    if (m > 0) return `${m}m ${sec}s`;
    return `${sec}s`;
}
