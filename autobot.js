// =====================================================================
// AUTO TRADING ENGINE (autobot.js)
// =====================================================================
// Runs independently from the manual "PLACE TRADE" button and the
// existing repeat-trade "RUN BOT" loop in trading.js. This engine only
// acts when a specific tick pattern (Strategy A or B) is detected —
// it does not touch any existing manual trading functionality.
//
// Honesty note for future maintainers: Strategy A/B are "hot/cold digit"
// pattern rules. Digit outcomes on these synthetic indices are close to
// independent draws each tick — recent frequency does not change the
// odds of the next digit. This engine executes exactly what it's told,
// it does not imply the strategy has a statistical edge.
// =====================================================================

const AUTO_ENGINE_STATE = {
    STOPPED: "stopped",
    RUNNING: "running",
    PAUSED: "paused"
};

let autoEngineState = AUTO_ENGINE_STATE.STOPPED;
let autoEngineTradeInFlight = false; // prevents overlapping entries
let lastSignalKey = null;            // prevents duplicate entries from the same signal

function autoEngineLog(msg) {
    logEvent(`[Auto] ${msg}`);

    const panel = document.getElementById("autoEngineFeed");
    if (!panel) return;
    if (panel.querySelector(".empty-msg")) panel.innerHTML = "";

    const row = document.createElement("div");
    row.className = "history-row";
    row.innerHTML = `<span>${msg}</span>`;
    panel.prepend(row);

    // Keep the feed from growing unbounded
    while (panel.children.length > 20) {
        panel.removeChild(panel.lastChild);
    }
}

function updateAutoEngineUI() {
    const statusEl = document.getElementById("autoEngineStatus");

    const labels = {
        [AUTO_ENGINE_STATE.STOPPED]: "⚪ Stopped",
        [AUTO_ENGINE_STATE.RUNNING]: "🟢 Running",
        [AUTO_ENGINE_STATE.PAUSED]:  "🟡 Paused"
    };
    statusEl.textContent = labels[autoEngineState];

    document.getElementById("autoStartBtn").disabled  = autoEngineState !== AUTO_ENGINE_STATE.STOPPED;
    document.getElementById("autoPauseBtn").disabled   = autoEngineState !== AUTO_ENGINE_STATE.RUNNING;
    document.getElementById("autoResumeBtn").disabled  = autoEngineState !== AUTO_ENGINE_STATE.PAUSED;
    document.getElementById("autoStopBtn").disabled    = autoEngineState === AUTO_ENGINE_STATE.STOPPED;

    if (typeof renderBotDashboard === "function") renderBotDashboard();
}

// Called once per live tick from app.js, after the digit percentages
// for this tick have been computed.
function checkStrategySignals() {

    if (autoEngineState !== AUTO_ENGINE_STATE.RUNNING) return;
    if (autoEngineTradeInFlight) return;
    if (tickWindow.length < 2) return;

    const strategy = document.getElementById("autoStrategySelect").value; // "A" | "B" | "both"
    const lastTwo = tickWindow.slice(-2).map(t => t.digit);
    const signalKey = lastTwo.join(",");

    // Strategy A: last 2 digits all in {6,7,8,9}, at least 2 of them under 10% frequency -> Under 6
    const matchesA =
        (strategy === "A" || strategy === "both") &&
        lastTwo.every(d => [6, 7, 8, 9].includes(d)) &&
        lastTwo.filter(d => currentDigitPercentages[d] < 10).length >= 2;

    // Strategy B: last 2 digits all in {0,1,2,3}, at least 2 of them under 10% frequency -> Over 3
    const matchesB =
        (strategy === "B" || strategy === "both") &&
        lastTwo.every(d => [0, 1, 2, 3].includes(d)) &&
        lastTwo.filter(d => currentDigitPercentages[d] < 10).length >= 2;

    if (!matchesA && !matchesB) return;

    // Duplicate-entry guard: don't re-fire on the exact same digit pair
    // that already triggered a trade.
    if (signalKey === lastSignalKey) return;
    lastSignalKey = signalKey;

    const strategyName = matchesA ? "A" : "B";
    const contractType = matchesA ? "DIGITUNDER" : "DIGITOVER";
    const barrier = matchesA ? 6 : 3;

    recordSignalOccurrence(signalKey);
    const { score, reasons } = computeConfidence(signalKey);
    renderConfidence(score, reasons);

    const threshold = Number(document.getElementById("aiConfidenceThreshold").value) || 80;

    if (score < threshold) {
        autoEngineLog(
            `Skipped — Strategy ${strategyName} pattern matched but confidence ${score}% < threshold ${threshold}% (${reasons.join(", ")})`
        );
        return;
    }

    const gate = checkPreTradeGate();

    if (!gate.allow) {
        if (gate.hardStop) {
            triggerRiskStop(gate.reason);
        } else {
            autoEngineLog(`Skipped — ${gate.reason}`);
        }
        return;
    }

    autoEngineLog(`Strategy ${strategyName} signal — confidence ${score}% ≥ threshold ${threshold}%`);
    fireAutoTrade(strategyName, contractType, barrier, lastTwo);
}

async function fireAutoTrade(strategyName, contractType, barrier, digitsSeen) {

    autoEngineTradeInFlight = true;
    const tradeStartTime = Date.now();

    const stake = Number(document.getElementById("stake").value) || 1;
    const reason = `digits [${digitsSeen.join(", ")}] all in range, both under 10% frequency`;
    autoEngineLog(`Entering — ${reason}`);

    try {
        // Tick-based digit contract → eligible for the instant local flash too
        pendingTickContracts.push({
            contract_type: contractType,
            barrier,
            ticksRemaining: 1
        });

        const proposalResponse = await sendRequest({
            proposal: 1,
            amount: stake,
            basis: "stake",
            contract_type: contractType,
            currency: "USD",
            duration: 1,
            duration_unit: "t",
            underlying_symbol: currentSymbol,
            barrier: String(barrier)
        });

        const buyResponse = await sendRequest({
            buy: proposalResponse.proposal.id,
            price: stake
        });

        markTradeExecutedNow();
        autoEngineLog(`Trade placed — ${contractType} ${barrier}, stake ${stake.toFixed(2)}`);

        if (buyResponse.buy && buyResponse.buy.contract_id) {
            subscribeToContract(buyResponse.buy.contract_id);

            const result = await waitForSettlement(buyResponse.buy.contract_id);
            recordAutoTradeResult(result.profit, Date.now() - tradeStartTime);
            const outcome = result.profit >= 0 ? "WIN +" : "LOSS ";
            autoEngineLog(`Result: ${outcome}${result.profit.toFixed(2)} USD`);

            const stopReason = checkPostTradeStops();
            if (stopReason) {
                triggerRiskStop(stopReason);
            }
        }

    } catch (err) {
        console.error(err);
        autoEngineLog(`Trade failed: ${err.message || "unknown error"}`);
    } finally {
        autoEngineTradeInFlight = false;
    }
}

document.getElementById("autoStartBtn").addEventListener("click", () => {
    if (!localStorage.getItem("deriv_ws_url")) {
        alert("Please log in with Deriv first.");
        return;
    }
    if (!socket || socket.readyState !== WebSocket.OPEN) {
        alert("Not connected to Deriv.");
        return;
    }

    autoEngineState = AUTO_ENGINE_STATE.RUNNING;
    lastSignalKey = null;
    autoEngineLog("Engine started");
    updateAutoEngineUI();
});

document.getElementById("autoPauseBtn").addEventListener("click", () => {
    autoEngineState = AUTO_ENGINE_STATE.PAUSED;
    autoEngineLog("Engine paused");
    updateAutoEngineUI();
});

document.getElementById("autoResumeBtn").addEventListener("click", () => {
    autoEngineState = AUTO_ENGINE_STATE.RUNNING;
    autoEngineLog("Engine resumed");
    updateAutoEngineUI();
});

document.getElementById("autoStopBtn").addEventListener("click", () => {
    autoEngineState = AUTO_ENGINE_STATE.STOPPED;
    lastSignalKey = null;
    autoEngineLog("Engine stopped");
    updateAutoEngineUI();
});

updateAutoEngineUI();

document.getElementById("autoStrategySelect").addEventListener("change", () => {
    if (typeof renderBotDashboard === "function") renderBotDashboard();
});

if (typeof renderBotDashboard === "function") renderBotDashboard();