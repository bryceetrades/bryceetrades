// =====================================================================
// TRADE HISTORY LOG (tradehistorylog.js)
// =====================================================================
// Records every Auto Trading Engine decision — executed trades AND
// skipped signals — with full context: strategy, confidence score,
// entry digit, contract type, stake, profit/loss, result, and the
// reason the AI entered or skipped. Persisted to localStorage so it
// survives a page reload. Supports filtering and CSV export.
// =====================================================================

const TRADE_HISTORY_KEY = "bryceetrades_ai_trade_history";
const TRADE_HISTORY_MAX = 500; // cap stored entries to keep localStorage lean

let aiTradeHistory = [];
let historyFilterStrategy = "all";
let historyFilterResult = "all";

function loadTradeHistory() {
    try {
        const raw = localStorage.getItem(TRADE_HISTORY_KEY);
        aiTradeHistory = raw ? JSON.parse(raw) : [];
    } catch {
        aiTradeHistory = [];
    }
}

function saveTradeHistory() {
    if (aiTradeHistory.length > TRADE_HISTORY_MAX) {
        aiTradeHistory = aiTradeHistory.slice(-TRADE_HISTORY_MAX);
    }
    localStorage.setItem(TRADE_HISTORY_KEY, JSON.stringify(aiTradeHistory));
}

// entry: { strategy, confidence, entryDigit, contractType, stake, profit, result, reason }
// result is one of "win" | "loss" | "skipped"
function recordHistoryEntry(entry) {
    aiTradeHistory.push({
        timestamp: Date.now(),
        strategy: entry.strategy ?? "-",
        confidence: entry.confidence ?? null,
        entryDigit: entry.entryDigit ?? null,
        contractType: entry.contractType ?? "-",
        stake: entry.stake ?? null,
        profit: entry.profit ?? null,
        result: entry.result,
        reason: entry.reason ?? ""
    });
    saveTradeHistory();
    renderTradeHistoryTable();
}

function renderTradeHistoryTable() {
    const tbody = document.getElementById("aiHistoryTableBody");
    const emptyMsg = document.getElementById("aiHistoryEmpty");
    if (!tbody) return;

    const filtered = aiTradeHistory
        .filter(e => historyFilterStrategy === "all" || e.strategy === historyFilterStrategy)
        .filter(e => historyFilterResult === "all" || e.result === historyFilterResult)
        .slice(-200)
        .reverse();

    if (filtered.length === 0) {
        tbody.innerHTML = "";
        if (emptyMsg) emptyMsg.style.display = "block";
        return;
    }
    if (emptyMsg) emptyMsg.style.display = "none";

    tbody.innerHTML = filtered.map(e => {
        const resultBadge =
            e.result === "win"  ? `<span class="profit-positive">WIN</span>` :
            e.result === "loss" ? `<span class="profit-negative">LOSS</span>` :
                                   `<span class="empty-msg">SKIPPED</span>`;

        const time = new Date(e.timestamp).toLocaleString();

        return `<tr>
            <td>${time}</td>
            <td>${e.strategy}</td>
            <td>${e.confidence != null ? e.confidence + "%" : "-"}</td>
            <td>${e.entryDigit != null ? e.entryDigit : "-"}</td>
            <td>${e.contractType}</td>
            <td>${e.stake != null ? Number(e.stake).toFixed(2) : "-"}</td>
            <td>${e.profit != null ? (e.profit >= 0 ? "+" : "") + Number(e.profit).toFixed(2) : "-"}</td>
            <td>${resultBadge}</td>
            <td class="history-reason">${e.reason}</td>
        </tr>`;
    }).join("");
}

function exportTradeHistoryCSV() {
    const headers = ["Timestamp", "Strategy", "Confidence", "EntryDigit", "ContractType", "Stake", "ProfitLoss", "Result", "Reason"];

    const rows = aiTradeHistory.map(e => [
        new Date(e.timestamp).toISOString(),
        e.strategy,
        e.confidence ?? "",
        e.entryDigit ?? "",
        e.contractType,
        e.stake ?? "",
        e.profit ?? "",
        e.result,
        `"${(e.reason || "").replace(/"/g, '""')}"`
    ]);

    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `bryceetrades-history-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function clearTradeHistory() {
    if (!confirm("Clear all AI trade history? This can't be undone.")) return;
    aiTradeHistory = [];
    saveTradeHistory();
    renderTradeHistoryTable();
}

document.getElementById("historyFilterStrategy").addEventListener("change", (e) => {
    historyFilterStrategy = e.target.value;
    renderTradeHistoryTable();
});

document.getElementById("historyFilterResult").addEventListener("change", (e) => {
    historyFilterResult = e.target.value;
    renderTradeHistoryTable();
});

document.getElementById("exportHistoryBtn").addEventListener("click", exportTradeHistoryCSV);
document.getElementById("clearHistoryBtn").addEventListener("click", clearTradeHistory);

loadTradeHistory();
renderTradeHistoryTable();