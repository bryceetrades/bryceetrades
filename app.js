// =====================
// UI CHROME (tabs, sidebar, accordions, logs, logout)
// =====================
// Pure UI wiring — doesn't touch the socket/trading logic below.

function logEvent(msg) {
    const panel = document.getElementById("logsPanel");
    if (!panel) return;
    const time = new Date().toLocaleTimeString();
    const line = document.createElement("div");
    line.textContent = `[${time}] ${msg}`;
    panel.prepend(line);
}

function activateTab(tabId) {
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.toggle("active", b.dataset.tab === tabId));
    document.querySelectorAll(".side-icon").forEach(b => b.classList.toggle("active", b.dataset.tab === tabId));

    const panel = document.getElementById(`tab-${tabId}`);
    if (panel) panel.classList.add("active");

    // The fixed Place Trade bar only makes sense on the Bot Builder tab
    document.getElementById("tab-bot-actionbar").style.display = (tabId === "bot") ? "block" : "none";
}

document.querySelectorAll(".tab-btn, .side-icon").forEach(btn => {
    btn.addEventListener("click", () => activateTab(btn.dataset.tab));
});

function activateBotSubpanel(panelId) {
    document.querySelectorAll(".bot-subpanel").forEach(p => p.classList.remove("active"));
    document.querySelectorAll(".bot-subtab-btn").forEach(b => b.classList.toggle("active", b.dataset.botpanel === panelId));

    const panel = document.getElementById(`botpanel-${panelId}`);
    if (panel) panel.classList.add("active");

    // The Auto Trading Engine has its own Start/Pause/Resume/Stop buttons
    // inline in its card — no need to also show RUN BOT in the fixed bar.
    document.getElementById("runBotBtn").style.display = (panelId === "repeat") ? "block" : "none";
}

document.querySelectorAll(".bot-subtab-btn").forEach(btn => {
    btn.addEventListener("click", () => activateBotSubpanel(btn.dataset.botpanel));
});

document.querySelectorAll(".accordion-head").forEach(head => {
    head.addEventListener("click", () => {
        head.closest(".accordion").classList.toggle("open");
    });
});

document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.removeItem("deriv_token");
    localStorage.removeItem("deriv_account");
    localStorage.removeItem("deriv_ws_url");
    location.reload();
});

(function initSettingsAccountInfo() {
    const account = JSON.parse(localStorage.getItem("deriv_account") || "null");
    if (account) {
        document.getElementById("settingsAccountInfo").textContent =
            `Logged in as ${account.account_id} (${account.account_type || "unknown"})`;
    }
})();

// --- Real/Demo account switching -----------------------------------------
(function initAccountSwitch() {
    const account = JSON.parse(localStorage.getItem("deriv_account") || "null");
    const accountsForDebug = JSON.parse(localStorage.getItem("deriv_accounts") || "[]");
    const demoBtn = document.getElementById("switchDemo");
    const realBtn = document.getElementById("switchReal");
    const note = document.getElementById("accountSwitchNote");

    console.log("Deriv accounts on this login:", accountsForDebug);

    if (account) {
        demoBtn.classList.toggle("active", account.account_type === "demo");
        realBtn.classList.toggle("active", account.account_type !== "demo");
    }

    function switchAccount(targetType) {
        const accounts = JSON.parse(localStorage.getItem("deriv_accounts") || "[]");
        const accessToken = localStorage.getItem("deriv_token");

        // Some Deriv account_type values for real accounts aren't literally
        // "real" (could be a regional/regulatory variant) — treat anything
        // that isn't demo as "real" instead of requiring an exact match.
        const target = targetType === "demo"
            ? accounts.find(a => a.account_type === "demo")
            : accounts.find(a => a.account_type !== "demo");

        if (!target) {
            note.textContent = accounts.length
                ? `No ${targetType} account found — see console for what this login actually has.`
                : "No account list found — try logging out and back in.";
            console.log("Deriv accounts available:", accounts);
            return;
        }
        if (!accessToken) {
            note.textContent = "Please log in first.";
            return;
        }

        note.textContent = "Switching...";

        fetch("/api/otp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ access_token: accessToken, account_id: target.account_id })
        })
            .then(r => r.json())
            .then(data => {
                if (!data.ws_url) {
                    note.textContent = "Switch failed — see console.";
                    console.error(data);
                    return;
                }
                localStorage.setItem("deriv_ws_url", data.ws_url);
                localStorage.setItem("deriv_account", JSON.stringify(target));
                location.reload();
            })
            .catch(err => {
                note.textContent = "Switch failed — see console.";
                console.error(err);
            });
    }

    demoBtn.addEventListener("click", () => switchAccount("demo"));
    realBtn.addEventListener("click", () => switchAccount("real"));
})();

// --- Daily P&L / win rate / trade count (persists per calendar day) ------
function todayStatsKey() {
    return "stats:" + new Date().toISOString().slice(0, 10);
}

function loadDailyStats() {
    try {
        const raw = localStorage.getItem(todayStatsKey());
        return raw ? JSON.parse(raw) : { trades: 0, wins: 0, pnl: 0 };
    } catch {
        return { trades: 0, wins: 0, pnl: 0 };
    }
}

function recordTradeResult(profit) {
    const stats = loadDailyStats();
    stats.trades += 1;
    if (profit > 0) stats.wins += 1;
    stats.pnl += profit;
    localStorage.setItem(todayStatsKey(), JSON.stringify(stats));
    renderDailyStats(stats);
}

function renderDailyStats(stats) {
    stats = stats || loadDailyStats();
    const winRate = stats.trades ? ((stats.wins / stats.trades) * 100).toFixed(1) : "0.0";

    const pnlEl = document.getElementById("pnlToday");
    pnlEl.textContent = (stats.pnl >= 0 ? "+" : "") + stats.pnl.toFixed(2) + " USD";
    pnlEl.className = stats.pnl >= 0 ? "profit-positive" : "profit-negative";

    document.getElementById("winRate").textContent = winRate + "%";
    document.getElementById("tradesToday").textContent = stats.trades;
}

// --- AI Trading Bot overview (Dashboard tab) ------------------------------
// Sourced entirely from the Auto Trading Engine's own trade history
// (autoEngineResults, from aisignal.js) — distinct from the site-wide
// Today's P&L card above, which includes manual trades too.
function pulseStat(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const card = el.closest(".stat-card");
    if (!card) return;
    card.classList.remove("pulse");
    void card.offsetWidth; // restart the animation
    card.classList.add("pulse");
}

function renderBotDashboard() {
    if (typeof autoEngineResults === "undefined") return; // aisignal.js not loaded yet

    const strategyLabels = { A: "Strategy A — Under 6", B: "Strategy B — Over 3", both: "Both Strategies" };
    const strategySelect = document.getElementById("autoStrategySelect");
    const statusLabels = {
        stopped: "⚪ Stopped",
        running: "🟢 Running",
        paused:  "🟡 Paused"
    };

    document.getElementById("dashBotStatus").textContent =
        statusLabels[typeof autoEngineState !== "undefined" ? autoEngineState : "stopped"];

    document.getElementById("dashStrategy").textContent =
        strategySelect ? strategyLabels[strategySelect.value] : "—";

    document.getElementById("dashConfidence").textContent =
        (typeof lastConfidenceScore === "number") ? lastConfidenceScore + "%" : "—";

    const total = autoEngineResults.length;
    const wins = autoEngineResults.filter(r => r.profit > 0).length;
    const losses = autoEngineResults.filter(r => r.profit <= 0).length;
    const winRate = total ? ((wins / total) * 100).toFixed(1) : "0.0";
    const todayPnl = typeof getTodayAutoPnl === "function" ? getTodayAutoPnl() : 0;
    const avgDuration = typeof getAverageTradeDurationSeconds === "function" ? getAverageTradeDurationSeconds() : null;

    const botPnlEl = document.getElementById("dashBotPnl");
    botPnlEl.textContent = (todayPnl >= 0 ? "+" : "") + todayPnl.toFixed(2) + " USD";
    botPnlEl.className = todayPnl >= 0 ? "profit-positive" : "profit-negative";

    document.getElementById("dashWinRate").textContent = winRate + "%";
    document.getElementById("dashTotalTrades").textContent = total;
    document.getElementById("dashAvgDuration").textContent =
        avgDuration !== null ? avgDuration.toFixed(1) + "s" : "—";

    document.getElementById("dashWins").textContent = wins;
    document.getElementById("dashLosses").textContent = losses;
    document.getElementById("dashConsecWins").textContent =
        typeof getConsecutiveWins === "function" ? getConsecutiveWins() : 0;
    document.getElementById("dashConsecLosses").textContent =
        typeof getConsecutiveLosses === "function" ? getConsecutiveLosses() : 0;

    ["dashBotPnl", "dashWinRate", "dashTotalTrades", "dashWins", "dashLosses"]
        .forEach(pulseStat);
}

renderDailyStats();

// --- Live price chart (simple line chart, canvas) -------------------------
let priceHistory = [];
let currentBalance = null; // numeric account balance, read by riskmanager.js

// Trades on tick-based digit contracts (Matches/Differs, Over/Under, Even/Odd
// with duration_unit "t") can be evaluated the instant the settling tick
// arrives — we already know the contract's rule, so there's no need to wait
// for the server's confirmation just to flash the result.
const pendingTickContracts = []; // { contract_type, barrier, ticksRemaining }

function evaluateDigitContract(contractType, barrier, digit) {
    const b = Number(barrier);
    switch (contractType) {
        case "DIGITMATCH": return digit === b;
        case "DIGITDIFF":  return digit !== b;
        case "DIGITOVER":  return digit > b;
        case "DIGITUNDER": return digit < b;
        case "DIGITEVEN":  return digit % 2 === 0;
        case "DIGITODD":   return digit % 2 !== 0;
        default: return null; // not a digit contract — can't evaluate locally
    }
}

function drawChart() {
    const canvas = document.getElementById("priceChart");
    if (!canvas || priceHistory.length < 2) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight || 140;
    canvas.width = width * dpr;
    canvas.height = height * dpr;

    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const min = Math.min(...priceHistory);
    const max = Math.max(...priceHistory);
    const range = (max - min) || 1;

    ctx.beginPath();
    priceHistory.forEach((price, i) => {
        const x = (i / (priceHistory.length - 1)) * width;
        const y = height - ((price - min) / range) * height;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });

    const rising = priceHistory[priceHistory.length - 1] >= priceHistory[0];
    ctx.strokeStyle = rising ? "#22c55e" : "#ef4444";
    ctx.lineWidth = 2;
    ctx.stroke();
}

// =====================
// SOCKET CONNECTION
// =====================
// Two possible endpoints for the Options API:
//  - Public (no login, ticks only):  wss://api.derivws.com/trading/v1/options/ws/public
//  - Authenticated (after login):    the ws_url returned by the OTP step in api/token.js,
//                                    already saved to localStorage as "deriv_ws_url"

const PUBLIC_WS_URL = "wss://api.derivws.com/trading/v1/options/ws/public";
const authedWsUrl = localStorage.getItem("deriv_ws_url");

let socket; // reassigned by connectSocket() on reconnect — declared here, created below
let reconnectAttempts = 0;
let hasConnectedOnce = false;
const MAX_RECONNECT_ATTEMPTS = 10;

// --- Request/response layer --------------------------------------------
// Two patterns:
//  - sendRequest(payload)              -> one-shot, resolves once (authorize, buy, sell, portfolio snapshot)
//  - sendSubscription(payload, onUpdate) -> ongoing, calls onUpdate for every push (ticks, balance, open contracts)
let reqCounter = 1;
const pendingRequests = {};     // req_id -> { resolve, reject }   (one-shot)
const activeSubscriptions = {}; // req_id -> onUpdate(data)        (ongoing)

function sendRequest(payload) {
    return new Promise((resolve, reject) => {
        const req_id = reqCounter++;
        pendingRequests[req_id] = { resolve, reject };
        socket.send(JSON.stringify({ ...payload, req_id }));
    });
}

function sendSubscription(payload, onUpdate) {
    const req_id = reqCounter++;
    activeSubscriptions[req_id] = onUpdate;
    safeSend({ ...payload, subscribe: 1, req_id });
    return req_id;
}

function safeSend(payload) {
    if (socket.readyState !== WebSocket.OPEN) {
        console.warn("Not connected — skipped send:", payload);
        document.getElementById("status").textContent = "🟠 Disconnected";
        return false;
    }
    socket.send(JSON.stringify(payload));
    return true;
}
// -------------------------------------------------------------------------

// --- Market state --------------------------------------------------------
let currentSymbol = CONFIG.SYMBOL;

let windowSize = 1000;
let tickWindow = [];   // { digit, direction: "rise" | "fall" | "same" }
let currentDigitPercentages = Array(10).fill(0); // read by autobot.js's strategy checks
let lastQuote = null;

let highStreak = 0;
let lowStreak = 0;
let signalLocked = false;

function populateMarketSelect() {
    const select = document.getElementById("marketSelectTop");

    CONFIG.SYMBOLS.forEach(s => {
        const opt = document.createElement("option");
        opt.value = s.code;
        opt.textContent = s.name;
        if (s.code === CONFIG.SYMBOL) opt.selected = true;
        select.appendChild(opt);
    });

    select.addEventListener("change", (e) => switchMarket(e.target.value));
}

function resetAnalysisState() {
    tickWindow = [];
    lastQuote = null;
    highStreak = 0;
    lowStreak = 0;
    signalLocked = false;

    document.getElementById("tick").textContent = "-";
    document.getElementById("analysis").innerHTML = "";
    document.getElementById("priceValue").textContent = "-";
    document.getElementById("recentStrip").innerHTML = "";
    document.getElementById("signals").innerHTML = "Waiting for analysis...";
}

// Pre-fill the analysis window with recent history so stats aren't empty
// right after loading or switching markets.
function backfillHistory(symbol) {
    sendRequest({
        ticks_history: symbol,
        count: windowSize,
        end: "latest",
        style: "ticks"
    })
        .then((data) => {
            const prices = (data.history && data.history.prices) || [];

            prices.forEach((price) => {
                const quote = Number(price);
                const digit = Number(quote.toFixed(2).slice(-1));

                let direction = "same";
                if (lastQuote !== null) {
                    if (quote > lastQuote) direction = "rise";
                    else if (quote < lastQuote) direction = "fall";
                }

                lastQuote = quote;
                tickWindow.push({ digit, direction });
            });

            renderAnalysis();
        })
        .catch((err) => console.error("History backfill failed:", err));
}

function populateTicksWindowSelect() {
    document.getElementById("ticksWindow").addEventListener("change", (e) => {
        windowSize = Number(e.target.value);
        resetAnalysisState();
        backfillHistory(currentSymbol);
    });
}

function switchMarket(newSymbol) {
    // Stop the old ticks stream before starting a new one
    safeSend({ forget_all: "ticks" });

    currentSymbol = newSymbol;
    resetAnalysisState();
    backfillHistory(currentSymbol);

    const label = CONFIG.SYMBOLS.find(s => s.code === newSymbol);
    document.getElementById("analysisMarketLabel").textContent = label ? label.name : newSymbol;

    safeSend({ ticks: currentSymbol, subscribe: 1 });
    logEvent(`Switched market to ${newSymbol}`);
}

populateMarketSelect();
populateTicksWindowSelect();

document.getElementById("overUnderBarrier").addEventListener("input", renderAnalysis);
// -------------------------------------------------------------------------

// --- Open positions / trade history ---------------------------------------
const openPositions = {}; // contract_id -> latest proposal_open_contract data

// Lets the bot loop "await" a specific contract's settlement instead of
// polling — resolved from inside the subscribeToContract callback below.
const settlementWaiters = {}; // contract_id -> resolve function
function waitForSettlement(contractId) {
    return new Promise((resolve) => {
        settlementWaiters[contractId] = resolve;
    });
}

function subscribeToContract(contract_id) {
    sendSubscription(
        { proposal_open_contract: 1, contract_id },
        (data) => {
            if (data.error) {
                console.error("Position update error:", data.error);
                return;
            }

            const poc = data.proposal_open_contract;
            if (!poc) return;

            if (poc.is_sold) {
                delete openPositions[contract_id];
                addToHistory(poc);

                const profit = Number(poc.profit || 0);
                recordTradeResult(profit);

                // Only flash if we can confirm the exact digit the price settled
                // on. Falling back to "whatever's live now" would flash the
                // wrong digit — the instant local flash (tick-based digit
                // contracts) already covers those correctly on its own.
                const exitPrice = poc.exit_tick ?? poc.sell_spot;
                if (exitPrice != null) {
                    const settledDigit = Number(Number(exitPrice).toFixed(2).slice(-1));
                    flashDigitResult(settledDigit, profit >= 0);
                }

                showTradeToast(Number(poc.buy_price || 0), profit);

                if (settlementWaiters[contract_id]) {
                    settlementWaiters[contract_id]({ profit });
                    delete settlementWaiters[contract_id];
                }
            } else {
                openPositions[contract_id] = poc;
            }

            renderOpenPositions();
        }
    );
}

function renderOpenPositions() {
    const container = document.getElementById("openPositions");
    const ids = Object.keys(openPositions);

    if (ids.length === 0) {
        container.innerHTML = `<p class="empty-msg">No open positions</p>`;
        return;
    }

    container.innerHTML = ids.map(id => {
        const p = openPositions[id];
        const profit = Number(p.profit || 0);
        const profitClass = profit >= 0 ? "profit-positive" : "profit-negative";

        return `
        <div class="position-row">
            <div>
                <strong>${p.display_name || p.underlying || ""}</strong>
                <div class="position-sub">${p.shortcode || ""}</div>
            </div>
            <div class="${profitClass}">
                ${profit >= 0 ? "+" : ""}${profit.toFixed(2)} ${p.currency || ""}
            </div>
            <button class="sell-btn" data-id="${id}">Sell</button>
        </div>`;
    }).join("");

    container.querySelectorAll(".sell-btn").forEach(btn => {
        btn.addEventListener("click", () => sellContract(btn.dataset.id));
    });
}

async function sellContract(contract_id) {
    try {
        // price: 0 = accept current market price
        await sendRequest({ sell: contract_id, price: 0 });
    } catch (err) {
        console.error("Sell failed:", err);
        alert(err.message || "Sell failed.");
    }
}

function addToHistory(poc) {
    const container = document.getElementById("tradeHistory");
    if (container.querySelector(".empty-msg")) container.innerHTML = "";

    const profit = Number(poc.profit || 0);
    const profitClass = profit >= 0 ? "profit-positive" : "profit-negative";

    const row = document.createElement("div");
    row.className = "history-row";
    row.innerHTML = `
        <span>${poc.display_name || poc.underlying || ""}</span>
        <span class="${profitClass}">${profit >= 0 ? "+" : ""}${profit.toFixed(2)} ${poc.currency || ""}</span>
    `;
    container.prepend(row);
}
// -------------------------------------------------------------------------

function handleSocketOpen() {

    console.log("Connected to:", authedWsUrl ? "authenticated socket" : "public socket");
    logEvent(authedWsUrl ? "Connected to authenticated socket" : "Connected to public socket");

    if (hasConnectedOnce && reconnectAttempts > 0 && typeof notify === "function") {
        notify("Reconnected", "Connection to Deriv restored", "success");
    }
    hasConnectedOnce = true;
    reconnectAttempts = 0;

    if (authedWsUrl) {

        const account = JSON.parse(localStorage.getItem("deriv_account") || "null");

        if (account) {
            document.getElementById("status").textContent = `🟢 ${account.account_id}`;
            logEvent(`Authorized as ${account.account_id}`);

            const loginBtn = document.getElementById("loginBtn");
            loginBtn.textContent = "✅ Logged In";
            loginBtn.disabled = true;
        }

        sendSubscription({ balance: 1 }, (data) => {
            if (data.error) return console.error(data.error);
            if (data.balance) {
                currentBalance = Number(data.balance.balance);
                document.getElementById("accountBalance").textContent =
                    `${data.balance.balance} ${data.balance.currency}`;
            }
        });

        // Load any positions that were already open before this page load
        sendRequest({ portfolio: 1 })
            .then((data) => {
                const contracts = (data.portfolio && data.portfolio.contracts) || [];
                contracts.forEach(c => subscribeToContract(c.contract_id));
                logEvent(`Loaded ${contracts.length} open position(s) from portfolio`);
            })
            .catch((err) => console.error("Portfolio load failed:", err));
    }

    safeSend({ ticks: currentSymbol, subscribe: 1 });
    backfillHistory(currentSymbol);
    logEvent(`Subscribed to ticks for ${currentSymbol}`);
};

function handleSocketMessage(event) {

    const data = JSON.parse(event.data);

    // One-shot requests
    if (data.req_id && pendingRequests[data.req_id]) {
        const { resolve, reject } = pendingRequests[data.req_id];
        delete pendingRequests[data.req_id];

        if (data.error) {
            reject(data.error);
        } else {
            resolve(data);
        }
    }

    // Ongoing subscriptions
    if (data.req_id && activeSubscriptions[data.req_id]) {
        activeSubscriptions[data.req_id](data);
    }

    if (data.error) {
        console.log(data.error);
        return;
    }

    if (!data.tick) return;

    const quote = data.tick.quote;
    const digit = Number(Number(quote).toFixed(2).slice(-1));

    let direction = "same";
    if (lastQuote !== null) {
        if (quote > lastQuote) direction = "rise";
        else if (quote < lastQuote) direction = "fall";
    }
    lastQuote = quote;

    document.getElementById("tick").textContent = digit;

    tickWindow.push({ digit, direction });
    if (tickWindow.length > windowSize) {
        tickWindow.shift();
    }

    priceHistory.push(quote);
    if (priceHistory.length > 60) priceHistory.shift();
    drawChart();

    renderAnalysis();

    // Auto Trading Engine (autobot.js) — checks Strategy A/B on every tick
    if (typeof checkStrategySignals === "function") checkStrategySignals();

    // Instantly evaluate any tick-based digit contracts settling on this tick.
    // This must run AFTER renderAnalysis() — that function rebuilds the whole
    // digit grid's HTML from scratch every tick, which would otherwise erase
    // the flash class the instant it's added.
    for (let i = pendingTickContracts.length - 1; i >= 0; i--) {
        const pc = pendingTickContracts[i];
        pc.ticksRemaining--;
        if (pc.ticksRemaining <= 0) {
            const isWin = evaluateDigitContract(pc.contract_type, pc.barrier, digit);
            if (isWin !== null) flashDigitResult(digit, isWin);
            pendingTickContracts.splice(i, 1);
        }
    }

    // =====================
    // SIGNAL ENGINE (analytics only — does not place trades automatically)
    // =====================

    if ([6,7,8,9].includes(digit)) {

        highStreak++;
        lowStreak = 0;

    } else if ([0,1,2,3].includes(digit)) {

        lowStreak++;
        highStreak = 0;

    } else {

        highStreak = 0;
        lowStreak = 0;
        signalLocked = false;

    }

    let signal = "⚪ WAIT";

    if (!signalLocked) {

        if (highStreak >= 3) {

            signal = "🟢 CONSIDER UNDER 6";
            signalLocked = true;

        }

        else if (lowStreak >= 3) {

            signal = "🔵 CONSIDER OVER 3";
            signalLocked = true;

        }

    }

    if (highStreak === 0 && lowStreak === 0) {
        signalLocked = false;
    }

    document.getElementById("signals").innerHTML = `
        <h3>${signal}</h3>
        <p>High Streak: ${highStreak}</p>
        <p>Low Streak: ${lowStreak}</p>
    `;
};

function renderAnalysis() {

    if (tickWindow.length === 0) return;

    const total = tickWindow.length;
    const digitCount = Array(10).fill(0);
    let evenCount = 0;
    let riseCount = 0;
    let fallCount = 0;
    let directionTotal = 0;

    const barrier = Number(document.getElementById("overUnderBarrier").value) || 0;
    let overCount = 0;
    let underCount = 0;

    tickWindow.forEach(({ digit, direction }) => {
        digitCount[digit]++;

        if (digit % 2 === 0) evenCount++;

        if (direction === "rise") { riseCount++; directionTotal++; }
        else if (direction === "fall") { fallCount++; directionTotal++; }

        if (digit > barrier) overCount++;
        else if (digit < barrier + 1) underCount++;
    });

    // --- Digit distribution circles (2 rows of 5) ---
    const highest = Math.max(...digitCount);
    const lowest = Math.min(...digitCount);
    const currentDigit = tickWindow[tickWindow.length - 1].digit;
    let html = "";

    for (let i = 0; i < 10; i++) {
        const percent = ((digitCount[i] / total) * 100).toFixed(1);
        currentDigitPercentages[i] = Number(percent);
        let cls = "digit-circle";
        if (digitCount[i] === highest) cls += " highest";
        if (digitCount[i] === lowest) cls += " lowest";
        if (i === currentDigit) cls += " current";

        html += `
        <div class="${cls}">
            <div class="val">${i}</div>
            <div class="pct">${percent}%</div>
        </div>`;
    }
    document.getElementById("analysis").innerHTML = html;
    positionDigitCursor(currentDigit);

    // --- Current price + recent ticks strip ---
    const priceStr = lastQuote.toFixed(2);
    document.getElementById("priceValue").innerHTML =
        priceStr.slice(0, -1) + `<span class="last-digit">${priceStr.slice(-1)}</span>`;

    const recent = tickWindow.slice(-10);
    document.getElementById("recentStrip").innerHTML = recent.map(t =>
        `<div class="recent-chip ${t.direction === "fall" ? "fall" : "rise"}">${t.digit}</div>`
    ).join("");

    // --- Even / Odd ---
    const evenPct = (evenCount / total) * 100;
    document.getElementById("evenPct").textContent = evenPct.toFixed(1) + "%";
    document.getElementById("oddPct").textContent = (100 - evenPct).toFixed(1) + "%";
    document.getElementById("evenBar").style.width = evenPct.toFixed(1) + "%";

    // --- Rise / Fall (ignores "same" ticks) ---
    const risePct = directionTotal ? (riseCount / directionTotal) * 100 : 0;
    document.getElementById("risePct").textContent = risePct.toFixed(1) + "%";
    document.getElementById("fallPct").textContent = (100 - risePct).toFixed(1) + "%";
    document.getElementById("riseBar").style.width = risePct.toFixed(1) + "%";

    // --- Over / Under ---
    const overPct = (overCount / total) * 100;
    const underPct = (underCount / total) * 100;
    document.getElementById("underBarrierLabel").textContent = barrier + 1;
    document.getElementById("overPct").textContent = overPct.toFixed(1) + "%";
    document.getElementById("underPct").textContent = underPct.toFixed(1) + "%";
    document.getElementById("overUnderBar").style.width = overPct.toFixed(1) + "%";
}

// --- Moving cursor over the current live digit ---
function positionDigitCursor(digit) {
    const circles = document.querySelectorAll("#analysis .digit-circle");
    const cursor = document.getElementById("digitCursor");
    if (!circles.length || !cursor) return;

    const target = circles[digit];

    cursor.style.left = (target.offsetLeft + target.offsetWidth / 2) + "px";
    cursor.style.top = target.offsetTop + "px";
    cursor.classList.add("visible");
}

// --- Flash the digit a trade settled on: green for a win, red for a loss ---
function flashDigitResult(digit, isWin) {
    const circles = document.querySelectorAll("#analysis .digit-circle");
    const target = circles[digit];
    if (!target) return;

    target.classList.add(isWin ? "result-win" : "result-loss");
    setTimeout(() => {
        target.classList.remove("result-win", "result-loss");
    }, 1400);
}

// --- Popup showing stake + result after a trade settles ---
function showTradeToast(stake, profit) {
    const toast = document.getElementById("tradeToast");
    const isWin = profit >= 0;

    toast.innerHTML = `
        ${isWin ? "+" : ""}${profit.toFixed(2)} USD
        <span class="stake-line">Stake: ${stake.toFixed(2)} USD</span>
    `;
    toast.className = `trade-toast show ${isWin ? "win" : "loss"}`;

    setTimeout(() => {
        toast.classList.remove("show");
    }, 2500);
}

function handleSocketError() {
    document.getElementById("status").textContent = "🔴 Connection Error";
    logEvent("Connection error");
}

function handleSocketClose() {
    document.getElementById("status").textContent = "🟠 Disconnected";
    logEvent("Disconnected");

    if (hasConnectedOnce && typeof notify === "function") {
        notify("API Disconnected", "Lost connection to Deriv — attempting to reconnect", "error");
    }

    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        logEvent(`Reconnecting in 3s (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
        setTimeout(connectSocket, 3000);
    } else {
        logEvent("Max reconnect attempts reached — refresh the page to retry.");
    }
}

function connectSocket() {
    socket = new WebSocket(authedWsUrl || PUBLIC_WS_URL);
    socket.onopen = handleSocketOpen;
    socket.onmessage = handleSocketMessage;
    socket.onerror = handleSocketError;
    socket.onclose = handleSocketClose;
}

connectSocket();