// =====================================================================
// AI SIGNAL FILTER (aisignal.js)
// =====================================================================
// Computes a 0-100 "confidence score" for a detected strategy signal
// before it's allowed to trade. This is a transparent, rule-based
// scorer — not a trained machine-learning model. Every factor and its
// contribution is visible in the returned "reasons" list, and that's
// exactly what gets shown in the UI, so nothing here is a black box.
//
// Factors used:
//   1. This auto-engine's own recent win rate
//   2. Current consecutive-loss streak
//   3. Tick momentum (recent rise/fall skew)
//   4. How often this exact digit pattern has fired recently
//   5. Recent price volatility
//   6. Time elapsed since the engine's last trade
// =====================================================================

const autoEngineResults = [];   // { profit, timestamp } — this engine's own trade history
const signalOccurrences = {};   // signalKey -> [timestamps this exact setup has fired recently]
let lastAutoTradeTime = null;

function recordAutoTradeResult(profit, durationMs) {
    autoEngineResults.push({ profit, timestamp: Date.now(), durationMs: durationMs || 0 });
    if (autoEngineResults.length > 50) autoEngineResults.shift();
    if (typeof renderBotDashboard === "function") renderBotDashboard();
}

function markTradeExecutedNow() {
    lastAutoTradeTime = Date.now();
}

function recordSignalOccurrence(signalKey) {
    if (!signalOccurrences[signalKey]) signalOccurrences[signalKey] = [];
    signalOccurrences[signalKey].push(Date.now());

    const cutoff = Date.now() - 10 * 60 * 1000; // keep last 10 minutes only
    signalOccurrences[signalKey] = signalOccurrences[signalKey].filter(t => t > cutoff);
}

function getRecentWinRate(sampleSize = 20) {
    const recent = autoEngineResults.slice(-sampleSize);
    if (recent.length === 0) return null;
    const wins = recent.filter(r => r.profit > 0).length;
    return (wins / recent.length) * 100;
}

function getConsecutiveLosses() {
    let streak = 0;
    for (let i = autoEngineResults.length - 1; i >= 0; i--) {
        if (autoEngineResults[i].profit < 0) streak++;
        else break;
    }
    return streak;
}

function getConsecutiveWins() {
    let streak = 0;
    for (let i = autoEngineResults.length - 1; i >= 0; i--) {
        if (autoEngineResults[i].profit > 0) streak++;
        else break;
    }
    return streak;
}

function getAverageTradeDurationSeconds() {
    if (autoEngineResults.length === 0) return null;
    const total = autoEngineResults.reduce((sum, r) => sum + (r.durationMs || 0), 0);
    return (total / autoEngineResults.length) / 1000;
}

function getVolatility(sampleSize = 30) {
    const recent = priceHistory.slice(-sampleSize);
    if (recent.length < 2) return 0;
    const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
    const variance = recent.reduce((a, b) => a + (b - mean) ** 2, 0) / recent.length;
    return Math.sqrt(variance);
}

function getMomentum(sampleSize = 30) {
    const recent = tickWindow.slice(-sampleSize);
    const rises = recent.filter(t => t.direction === "rise").length;
    const falls = recent.filter(t => t.direction === "fall").length;
    const total = rises + falls;
    if (total === 0) return 0;
    return ((rises - falls) / total) * 100; // -100..100
}

function getSetupFrequency(signalKey) {
    return (signalOccurrences[signalKey] || []).length;
}

// Returns { score: 0-100, reasons: string[] }
function computeConfidence(signalKey) {

    let score = 50; // neutral baseline
    const reasons = [];

    // 1. Recent win rate
    const winRate = getRecentWinRate();
    if (winRate === null) {
        reasons.push("no trade history yet (neutral)");
    } else {
        const c = Math.round((winRate - 50) * 0.3);
        score += c;
        reasons.push(`win rate ${winRate.toFixed(0)}% (${c >= 0 ? "+" : ""}${c})`);
    }

    // 2. Consecutive losses
    const losses = getConsecutiveLosses();
    if (losses > 0) {
        const penalty = Math.min(losses * 8, 30);
        score -= penalty;
        reasons.push(`${losses}-loss streak (-${penalty})`);
    }

    // 3. Tick momentum (magnitude only — a strong move in either direction
    // suggests the market isn't flat/random right now)
    const momentum = getMomentum();
    const momentumContribution = Math.round(Math.abs(momentum) * 0.1);
    if (momentumContribution > 0) {
        score += momentumContribution;
        reasons.push(`momentum ${momentum.toFixed(0)}% (+${momentumContribution})`);
    }

    // 4. Frequency of this exact setup recently
    const freq = getSetupFrequency(signalKey);
    let freqContribution;
    if (freq <= 1) {
        freqContribution = 5;
        reasons.push("fresh setup (+5)");
    } else if (freq <= 3) {
        freqContribution = 0;
        reasons.push(`seen ${freq}x recently (neutral)`);
    } else {
        freqContribution = -Math.min((freq - 3) * 5, 20);
        reasons.push(`seen ${freq}x recently (${freqContribution})`);
    }
    score += freqContribution;

    // 5. Volatility
    const volatility = getVolatility();
    if (volatility > 0) {
        if (volatility < 0.5) {
            score += 8;
            reasons.push("low volatility (+8)");
        } else if (volatility >= 2) {
            score -= 10;
            reasons.push("high volatility (-10)");
        } else {
            reasons.push("normal volatility (neutral)");
        }
    }

    // 6. Time since this engine's last trade
    if (lastAutoTradeTime === null) {
        score += 5;
        reasons.push("first trade this session (+5)");
    } else {
        const secondsSince = (Date.now() - lastAutoTradeTime) / 1000;
        if (secondsSince < 5) {
            score -= 15;
            reasons.push(`only ${secondsSince.toFixed(0)}s since last trade (-15)`);
        } else if (secondsSince >= 30) {
            score += 10;
            reasons.push(`${secondsSince.toFixed(0)}s since last trade (+10)`);
        } else {
            reasons.push(`${secondsSince.toFixed(0)}s since last trade (neutral)`);
        }
    }

    score = Math.max(0, Math.min(100, Math.round(score)));

    return { score, reasons };
}

let lastConfidenceScore = null; // read by the Dashboard tab

function renderConfidence(score, reasons) {
    lastConfidenceScore = score;

    const scoreEl = document.getElementById("aiConfidenceScore");
    const barEl = document.getElementById("aiConfidenceBar");
    const reasonEl = document.getElementById("aiConfidenceReason");

    if (scoreEl) scoreEl.textContent = score + "%";

    if (barEl) {
        barEl.style.width = score + "%";
        barEl.style.background = score >= 70 ? "var(--green)" : score >= 40 ? "var(--gold)" : "var(--red)";
    }

    if (reasonEl) reasonEl.textContent = reasons.join(" · ");

    if (typeof renderBotDashboard === "function") renderBotDashboard();
}