// =====================================================================
// DERIV HISTORY (derivhistory.js)
// =====================================================================
// Fetches the account's real trade/transaction history straight from
// Deriv's own servers (the `statement` call), instead of relying only
// on this browser's localStorage. This makes Today's P&L, Win Rate, and
// Trades Today correctly match across every device you log in on —
// Deriv is the single source of truth, not any one browser.
//
// Scope note: this only covers actual trades Deriv has a record of. The
// AI Trade History tab (confidence scores, strategy names, skipped-signal
// reasons) is app-specific data Deriv has no knowledge of, so that part
// still lives in local storage only — syncing *that* across devices
// would need our own backend database, which this isn't.
// =====================================================================

let derivHistoryIntervalId = null;

function isToday(unixSeconds) {
    const d = new Date(unixSeconds * 1000);
    const now = new Date();
    return d.toDateString() === now.toDateString();
}

async function loadDerivStatement() {
    try {
        const data = await sendRequest({ statement: 1, description: 1, limit: 100 });
        console.log("Deriv statement response:", data);

        const transactions = (data.statement && data.statement.transactions) || [];
        renderDashboardFromStatement(transactions);

    } catch (err) {
        console.error("Failed to load Deriv statement:", err);
    }
}

// Nets each contract's buy (negative stake) and sell (payout — 0 if
// lost, positive if won) legs together via contract_id. The raw sell
// amount alone is NOT the profit/loss — it's just the payout received,
// which is 0 on every loss. This is why losses were showing as +0.00.
function computeContractResults(transactions) {
    const byContract = {};

    transactions.forEach(t => {
        if (!t.contract_id) return; // skip non-contract transactions (deposits, etc.)

        if (!byContract[t.contract_id]) {
            byContract[t.contract_id] = { amount: 0, sellTime: null, hasSell: false };
        }

        byContract[t.contract_id].amount += Number(t.amount || 0);

        if (t.action_type === "sell") {
            byContract[t.contract_id].sellTime = t.transaction_time;
            byContract[t.contract_id].hasSell = true;
        }
    });

    // Only count contracts that have actually settled (have a sell leg) —
    // still-open positions won't have one yet.
    return Object.entries(byContract)
        .filter(([, c]) => c.hasSell)
        .map(([contract_id, c]) => ({
            contract_id,
            profit: c.amount,
            time: c.sellTime
        }));
}

function renderDashboardFromStatement(transactions) {
    const results = computeContractResults(transactions);
    const todayResults = results.filter(r => isToday(r.time));

    const todayPnl = todayResults.reduce((sum, r) => sum + r.profit, 0);
    const wins = todayResults.filter(r => r.profit > 0).length;
    const winRate = todayResults.length ? ((wins / todayResults.length) * 100).toFixed(1) : "0.0";

    const pnlEl = document.getElementById("pnlToday");
    if (pnlEl) {
        pnlEl.textContent = (todayPnl >= 0 ? "+" : "") + todayPnl.toFixed(2) + " USD";
        pnlEl.className = todayPnl >= 0 ? "profit-positive" : "profit-negative";
    }

    const winRateEl = document.getElementById("winRate");
    if (winRateEl) winRateEl.textContent = winRate + "%";

    const tradesTodayEl = document.getElementById("tradesToday");
    if (tradesTodayEl) tradesTodayEl.textContent = todayResults.length;

    renderDerivTradeList(results);
}

function renderDerivTradeList(results) {
    const container = document.getElementById("tradeHistory");
    if (!container) return;

    if (results.length === 0) {
        container.innerHTML = `<p class="empty-msg">No trades yet</p>`;
        return;
    }

    const sorted = [...results].sort((a, b) => b.time - a.time).slice(0, 30);

    container.innerHTML = sorted.map(r => {
        const cls = r.profit >= 0 ? "profit-positive" : "profit-negative";
        const time = new Date(r.time * 1000).toLocaleString();
        return `<div class="history-row">
            <span>${time}</span>
            <span class="${cls}">${r.profit >= 0 ? "+" : ""}${r.profit.toFixed(2)} USD</span>
        </div>`;
    }).join("");
}

// Fetch immediately on (re)connect, then keep polling so changes made on
// other devices show up here without needing a manual reload. Guarded
// against stacking multiple intervals across reconnects.
function startDerivHistoryPolling() {
    loadDerivStatement();
    if (derivHistoryIntervalId) clearInterval(derivHistoryIntervalId);
    derivHistoryIntervalId = setInterval(loadDerivStatement, 30000);
}