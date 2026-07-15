// =====================================================================
// REPEAT BOT (repeatbot.js)
// =====================================================================
// Repeats whatever trade is configured in Purchase Conditions, one after
// another, until stopped or a Risk Management limit (Stop Loss / Take
// Profit / Max Trades) is hit. Reuses executeTrade() from
// manualtrader.js — that's the only thing shared between the two files.
//
// Uses `socket`, `logEvent`, and `waitForSettlement` from app.js.
// =====================================================================

let botRunning = false;
let botSessionPnl = 0;
let botTradesCount = 0;
const botTradeLog = []; // { contract_type, stake, status: 'pending'|'won'|'lost'|'error' }

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
    if (typeof notify === "function") {
        notify("Bot Stopped", `Repeat Bot stopped${reason ? " — " + reason : ""}`, "info");
    }
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
    if (botTradeLog.length > 100) botTradeLog.shift(); // feed only ever shows the last 8; cap growth
    renderBotTradeFeed();

    try {
        const bought = await executeTrade(); // from manualtrader.js

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

    if (!ensureConnected()) return;

    botRunning = true;
    botSessionPnl = 0;
    botTradesCount = 0;
    botTradeLog.length = 0;
    renderBotTradeFeed();
    logEvent("Bot started");
    if (typeof notify === "function") notify("Bot Started", "Repeat Bot is now running", "success");
    updateBotStatusUI();
    runBotLoop();
});