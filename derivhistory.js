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

function renderDashboardFromStatement(transactions) {
    const todayTx = transactions.filter(t => isToday(t.transaction_time));

    // Net P&L for today = sum of every transaction's amount. Buys are
    // negative (stake paid out), sells/payouts are positive (money back)
    // — summing nets out to the correct profit/loss automatically.
    const todayPnl = todayTx.reduce((sum, t) => sum + Number(t.amount || 0), 0);

    // Treat anything that isn't a "buy" as a settlement (sell/payout) for
    // win-rate purposes — a settled contract's amount is its payout.
    const settlements = todayTx.filter(t => t.action_type !== "buy");
    const wins = settlements.filter(t => Number(t.amount) > 0).length;
    const winRate = settlements.length ? ((wins / settlements.length) * 100).toFixed(1) : "0.0";

    const pnlEl = document.getElementById("pnlToday");
    if (pnlEl) {
        pnlEl.textContent = (todayPnl >= 0 ? "+" : "") + todayPnl.toFixed(2) + " USD";
        pnlEl.className = todayPnl >= 0 ? "profit-positive" : "profit-negative";
    }

    const winRateEl = document.getElementById("winRate");
    if (winRateEl) winRateEl.textContent = winRate + "%";

    const tradesTodayEl = document.getElementById("tradesToday");
    if (tradesTodayEl) tradesTodayEl.textContent = settlements.length;

    renderDerivTradeList(transactions.slice(0, 30));
}

function renderDerivTradeList(transactions) {
    const container = document.getElementById("tradeHistory");
    if (!container) return;

    const settlements = transactions.filter(t => t.action_type !== "buy");

    if (settlements.length === 0) {
        container.innerHTML = `<p class="empty-msg">No trades yet</p>`;
        return;
    }

    container.innerHTML = settlements.map(t => {
        const amount = Number(t.amount || 0);
        const cls = amount >= 0 ? "profit-positive" : "profit-negative";
        const time = new Date(t.transaction_time * 1000).toLocaleString();
        return `<div class="history-row">
            <span>${time}</span>
            <span class="${cls}">${amount >= 0 ? "+" : ""}${amount.toFixed(2)} USD</span>
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