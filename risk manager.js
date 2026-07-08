// =====================================================================
// RISK MANAGEMENT (riskmanager.js)
// =====================================================================
// Guards the Auto Trading Engine only (the manual "PLACE TRADE" button
// and the repeat-trade "RUN BOT" in trading.js already have their own
// separate Stop Loss / Take Profit / Max Trades and are untouched).
//
// Two kinds of limits:
//   - HARD STOPS: daily profit target, daily loss limit, max consecutive
//     losses, max stake, minimum balance. Breaching any of these stops
//     the engine completely and notifies the user.
//   - THROTTLES: cooldown after a loss, max trades per hour. These just
//     skip the current signal — the engine keeps running and will try
//     again once the throttle clears.
// =====================================================================

function getTodayAutoPnl() {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    return autoEngineResults
        .filter(r => r.timestamp >= startOfToday.getTime())
        .reduce((sum, r) => sum + r.profit, 0);
}

function getTradesInLastHour() {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    return autoEngineResults.filter(r => r.timestamp >= oneHourAgo).length;
}

function getLastLossTime() {
    for (let i = autoEngineResults.length - 1; i >= 0; i--) {
        if (autoEngineResults[i].profit < 0) return autoEngineResults[i].timestamp;
    }
    return null;
}

// Checked right after a trade settles — catches a breach the moment it
// happens rather than waiting for the next signal attempt.
function checkPostTradeStops() {
    const dailyProfitTarget    = Number(document.getElementById("riskDailyProfitTarget").value) || 0;
    const dailyLossLimit       = Number(document.getElementById("riskDailyLossLimit").value) || 0;
    const maxConsecutiveLosses = Number(document.getElementById("riskMaxConsecutiveLosses").value) || 0;
    const minBalance           = Number(document.getElementById("riskMinBalance").value) || 0;

    const todayPnl = getTodayAutoPnl();
    const losses = getConsecutiveLosses();

    if (dailyProfitTarget && todayPnl >= dailyProfitTarget) {
        return `Daily profit target reached (+${todayPnl.toFixed(2)} USD)`;
    }
    if (dailyLossLimit && todayPnl <= -dailyLossLimit) {
        return `Daily loss limit reached (${todayPnl.toFixed(2)} USD)`;
    }
    if (maxConsecutiveLosses && losses >= maxConsecutiveLosses) {
        return `Max consecutive losses reached (${losses})`;
    }
    if (minBalance && currentBalance !== null && currentBalance < minBalance) {
        return `Balance ${currentBalance.toFixed(2)} USD below minimum ${minBalance.toFixed(2)} USD`;
    }
    return null;
}

// Checked before firing a new trade — includes everything in
// checkPostTradeStops() plus max stake and the two throttles.
// Returns { allow, hardStop, reason }
function checkPreTradeGate() {
    const stake = Number(document.getElementById("stake").value) || 0;
    const maxStake = Number(document.getElementById("riskMaxStake").value) || 0;

    if (maxStake && stake > maxStake) {
        return { allow: false, hardStop: true, reason: `Stake ${stake.toFixed(2)} exceeds max stake ${maxStake.toFixed(2)}` };
    }

    const stopReason = checkPostTradeStops();
    if (stopReason) {
        return { allow: false, hardStop: true, reason: stopReason };
    }

    const cooldownSeconds = Number(document.getElementById("riskCooldownAfterLoss").value) || 0;
    const lastLoss = getLastLossTime();
    if (cooldownSeconds && lastLoss !== null) {
        const secondsSinceLoss = (Date.now() - lastLoss) / 1000;
        if (secondsSinceLoss < cooldownSeconds) {
            const remaining = Math.ceil(cooldownSeconds - secondsSinceLoss);
            return { allow: false, hardStop: false, reason: `Cooldown after loss — ${remaining}s remaining` };
        }
    }

    const maxTradesPerHour = Number(document.getElementById("riskMaxTradesPerHour").value) || 0;
    if (maxTradesPerHour) {
        const tradesThisHour = getTradesInLastHour();
        if (tradesThisHour >= maxTradesPerHour) {
            return { allow: false, hardStop: false, reason: `Max trades/hour reached (${tradesThisHour}/${maxTradesPerHour})` };
        }
    }

    return { allow: true, hardStop: false, reason: null };
}

// Stops the engine and notifies the user — used for hard-stop breaches.
function triggerRiskStop(reason) {
    autoEngineState = AUTO_ENGINE_STATE.STOPPED;
    lastSignalKey = null;
    autoEngineLog(`🛑 Risk limit hit — engine stopped: ${reason}`);
    updateAutoEngineUI();
    alert(`Auto Trading Engine stopped:\n${reason}`);
}