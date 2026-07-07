// =====================
// BRYCEE TRADES - Trading Engine
// =====================
// Uses `socket`, `sendRequest`, `currentSymbol`, and `subscribeToContract`
// from app.js (loaded before this file).

const DIRECTION_OPTIONS = {
    callput_natural: [
        { value: "CALL", label: "Rise" },
        { value: "PUT",  label: "Fall" }
    ],
    callput_barrier: [
        { value: "CALL", label: "Higher" },
        { value: "PUT",  label: "Lower" }
    ],
    matchdiff: [
        { value: "DIGITMATCH", label: "Matches" },
        { value: "DIGITDIFF",  label: "Differs" }
    ],
    overunder: [
        { value: "DIGITOVER",  label: "Over" },
        { value: "DIGITUNDER", label: "Under" }
    ],
    evenodd: [
        { value: "DIGITEVEN", label: "Even" },
        { value: "DIGITODD",  label: "Odd" }
    ]
};

function refreshTradeForm() {
    const category = document.getElementById("tradeCategory").value;
    const directionSelect = document.getElementById("tradeDirection");

    directionSelect.innerHTML = "";
    DIRECTION_OPTIONS[category].forEach(opt => {
        const el = document.createElement("option");
        el.value = opt.value;
        el.textContent = opt.label;
        directionSelect.appendChild(el);
    });

    const isDigitContract = ["matchdiff", "overunder", "evenodd"].includes(category);

    document.getElementById("predictionRow").style.display =
        (category === "matchdiff" || category === "overunder") ? "block" : "none";

    document.getElementById("barrierRow").style.display =
        (category === "callput_barrier") ? "block" : "none";

    // Digit contracts (Matches/Differs, Over/Under, Even/Odd) only allow
    // tick-based duration on Deriv — lock the unit selector to reflect that.
    const durationUnitSelect = document.getElementById("durationUnit");
    durationUnitSelect.disabled = isDigitContract;
    if (isDigitContract) durationUnitSelect.value = "t";
}

document.getElementById("tradeCategory").addEventListener("change", refreshTradeForm);
refreshTradeForm();

function buildContractRequest() {

    const category = document.getElementById("tradeCategory").value;
    const contract_type = document.getElementById("tradeDirection").value;
    const stake = Number(document.getElementById("stake").value);
    const duration = Number(document.getElementById("duration").value);
    const duration_unit = document.getElementById("durationUnit").value;

    const payload = {
        proposal: 1,
        amount: stake,
        basis: "stake",
        contract_type,
        currency: "USD",
        duration,
        duration_unit,
        underlying_symbol: currentSymbol
    };

    if (category === "matchdiff" || category === "overunder") {
        payload.barrier = document.getElementById("predictionDigit").value;
    } else if (category === "callput_barrier") {
        payload.barrier = document.getElementById("barrierOffset").value;
    }
    // Rise/Fall and Even/Odd need no barrier at all

    return payload;
}

// Places one trade using the current Purchase Conditions form. Shared by the
// manual "PLACE TRADE" button and the automated bot loop below. Throws on
// failure — callers decide how to handle/report that.
async function executeTrade() {

    const stake = Number(document.getElementById("stake").value);
    if (!stake || stake <= 0) {
        throw new Error("Enter a stake amount.");
    }

    const request = buildContractRequest();
    logEvent(`Requesting proposal: ${request.contract_type} on ${currentSymbol}, stake ${stake}`);

    // Start the countdown as early as possible, right when we send the
    // proposal — not after buy() resolves — so short (1-tick) trades
    // don't miss their settling tick.
    if (request.duration_unit === "t") {
        pendingTickContracts.push({
            contract_type: request.contract_type,
            barrier: request.barrier,
            ticksRemaining: request.duration
        });
    }

    const proposalResponse = await sendRequest(request);

    const buyResponse = await sendRequest({
        buy: proposalResponse.proposal.id,
        price: stake
    });

    logEvent(`Trade placed — contract ${buyResponse.buy && buyResponse.buy.contract_id}`);

    if (buyResponse.buy && buyResponse.buy.contract_id) {
        subscribeToContract(buyResponse.buy.contract_id);
    }

    return buyResponse.buy;
}

async function placeTrade() {

    if (!localStorage.getItem("deriv_ws_url")) {
        alert("Please log in with Deriv first.");
        return;
    }

    if (!socket || socket.readyState !== WebSocket.OPEN) {
        alert("Not connected to Deriv.");
        return;
    }

    try {
        await executeTrade();
    } catch (err) {
        console.error(err);
        logEvent(`Trade failed: ${err.message || "unknown error"}`);
        alert(err.message || "Trade failed.");
    }
}

document.getElementById("buyBtn").addEventListener("click", placeTrade);

// =====================
// BOT — repeats the Purchase Conditions trade automatically until stopped
// or a Risk Management limit is hit.
// =====================

let botRunning = false;
let botSessionPnl = 0;
let botTradesCount = 0;
const botTradeLog = []; // { id, contract_type, stake, status: 'pending'|'won'|'lost'|'error' }

function renderBotTradeFeed() {
    const container = document.getElementById("botTradeFeed");
    if (!container) return;

    if (botTradeLog.length === 0) {
        container.innerHTML = `<p class="empty-msg">No trades yet this run</p>`;
        return;
    }

    container.innerHTML = botTradeLog.slice(-8).reverse().map(t => {
        let badge = "⏳ Pending";
        let cls = "";

        if (t.status === "won") { badge = `✅ +${t.profit.toFixed(2)} USD`; cls = "profit-positive"; }
        if (t.status === "lost") { badge = `❌ ${t.profit.toFixed(2)} USD`; cls = "profit-negative"; }
        if (t.status === "error") { badge = "⚠️ Error"; }

        return `<div class="history-row">
            <span>${t.contract_type} · stake ${t.stake.toFixed(2)}</span>
            <span class="${cls}">${badge}</span>
        </div>`;
    }).join("");
}

function updateBotStatusUI() {
    const statusEl = document.getElementById("botStatus");
    const pnlEl = document.getElementById("botSessionPnl");
    const countEl = document.getElementById("botTradesCount");
    const runBtn = document.getElementById("runBotBtn");

    statusEl.textContent = botRunning ? "🟢 Running" : "⚪ Stopped";

    pnlEl.textContent = (botSessionPnl >= 0 ? "+" : "") + botSessionPnl.toFixed(2) + " USD";
    pnlEl.className = botSessionPnl >= 0 ? "profit-positive" : "profit-negative";

    countEl.textContent = botTradesCount;

    runBtn.textContent = botRunning ? "⏹ STOP BOT" : "▶ RUN BOT";
    runBtn.classList.toggle("running", botRunning);
}

function stopBot(reason) {
    botRunning = false;
    logEvent(`Bot stopped${reason ? " — " + reason : ""}`);
    updateBotStatusUI();
}

async function runBotLoop() {

    if (!botRunning) return;

    const stopLoss = Number(document.getElementById("botStopLoss").value) || 0;
    const takeProfit = Number(document.getElementById("botTakeProfit").value) || 0;
    const maxTrades = Number(document.getElementById("botMaxTrades").value) || 0;

    if (stopLoss && botSessionPnl <= -stopLoss) return stopBot("stop loss reached");
    if (takeProfit && botSessionPnl >= takeProfit) return stopBot("take profit reached");
    if (maxTrades && botTradesCount >= maxTrades) return stopBot("max trades reached");

    const feedEntry = {
        contract_type: document.getElementById("tradeDirection").value,
        stake: Number(document.getElementById("stake").value) || 0,
        status: "pending"
    };
    botTradeLog.push(feedEntry);
    renderBotTradeFeed();

    try {
        const bought = await executeTrade();

        if (!bought || !bought.contract_id) {
            throw new Error("No contract_id returned from buy");
        }

        const result = await waitForSettlement(bought.contract_id);
        botTradesCount++;
        botSessionPnl += result.profit;
        updateBotStatusUI();

        feedEntry.status = result.profit >= 0 ? "won" : "lost";
        feedEntry.profit = result.profit;
        renderBotTradeFeed();

    } catch (err) {
        console.error(err);
        feedEntry.status = "error";
        renderBotTradeFeed();
        logEvent(`Bot error: ${err.message || "unknown error"} — retrying shortly`);
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    if (botRunning) runBotLoop();
}

document.getElementById("runBotBtn").addEventListener("click", () => {

    if (botRunning) {
        stopBot("manual stop");
        return;
    }

    if (!localStorage.getItem("deriv_ws_url")) {
        alert("Please log in with Deriv first.");
        return;
    }

    if (!socket || socket.readyState !== WebSocket.OPEN) {
        alert("Not connected to Deriv.");
        return;
    }

    botRunning = true;
    botSessionPnl = 0;
    botTradesCount = 0;
    botTradeLog.length = 0;
    renderBotTradeFeed();
    logEvent("Bot started");
    updateBotStatusUI();
    runBotLoop();
});

// =====================
// QUICK TRADE (Dashboard) — one-click Rise/Fall using the Quick Trade stake
// =====================

async function quickTrade(direction) {

    if (!localStorage.getItem("deriv_ws_url")) {
        alert("Please log in with Deriv first.");
        return;
    }

    if (!socket || socket.readyState !== WebSocket.OPEN) {
        alert("Not connected to Deriv.");
        return;
    }

    const stake = Number(document.getElementById("quickStake").value);

    if (!stake || stake <= 0) {
        alert("Enter a stake amount.");
        return;
    }

    try {

        logEvent(`Quick trade: ${direction} on ${currentSymbol}, stake ${stake}`);

        const proposalResponse = await sendRequest({
            proposal: 1,
            amount: stake,
            basis: "stake",
            contract_type: direction, // "CALL" (Rise) or "PUT" (Fall)
            currency: "USD",
            duration: 5,
            duration_unit: "t",
            underlying_symbol: currentSymbol
        });

        const buyResponse = await sendRequest({
            buy: proposalResponse.proposal.id,
            price: stake
        });

        logEvent(`Quick trade placed — contract ${buyResponse.buy && buyResponse.buy.contract_id}`);

        if (buyResponse.buy && buyResponse.buy.contract_id) {
            subscribeToContract(buyResponse.buy.contract_id);
        }

    } catch (err) {

        console.error(err);
        logEvent(`Quick trade failed: ${err.message || "unknown error"}`);
        alert(err.message || "Trade failed.");

    }
}

document.getElementById("quickRise").addEventListener("click", () => quickTrade("CALL"));
document.getElementById("quickFall").addEventListener("click", () => quickTrade("PUT"));