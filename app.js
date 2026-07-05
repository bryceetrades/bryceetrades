// =====================
// SOCKET CONNECTION
// =====================
// Two possible endpoints for the Options API:
//  - Public (no login, ticks only):  wss://api.derivws.com/trading/v1/options/ws/public
//  - Authenticated (after login):    the ws_url returned by the OTP step in api/token.js,
//                                    already saved to localStorage as "deriv_ws_url"

const PUBLIC_WS_URL = "wss://api.derivws.com/trading/v1/options/ws/public";
const authedWsUrl = localStorage.getItem("deriv_ws_url");

const socket = new WebSocket(authedWsUrl || PUBLIC_WS_URL);

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
    socket.send(JSON.stringify({ ...payload, subscribe: 1, req_id }));
    return req_id;
}
// -------------------------------------------------------------------------

// --- Market state --------------------------------------------------------
let currentSymbol = CONFIG.SYMBOL;

let last100Digits = [];
let highStreak = 0;
let lowStreak = 0;
let signalLocked = false;

function populateMarketSelect() {
    const select = document.getElementById("marketSelect");

    CONFIG.SYMBOLS.forEach(s => {
        const opt = document.createElement("option");
        opt.value = s.code;
        opt.textContent = s.name;
        if (s.code === CONFIG.SYMBOL) opt.selected = true;
        select.appendChild(opt);
    });

    select.addEventListener("change", (e) => switchMarket(e.target.value));
}

function switchMarket(newSymbol) {
    // Stop the old ticks stream before starting a new one
    socket.send(JSON.stringify({ forget_all: "ticks" }));

    currentSymbol = newSymbol;
    last100Digits = [];
    highStreak = 0;
    lowStreak = 0;
    signalLocked = false;

    document.getElementById("tick").textContent = "-";
    document.getElementById("analysis").innerHTML = "";
    document.getElementById("signals").innerHTML = "Waiting for analysis...";

    socket.send(JSON.stringify({ ticks: currentSymbol, subscribe: 1 }));
}

populateMarketSelect();
// -------------------------------------------------------------------------

// --- Open positions / trade history ---------------------------------------
const openPositions = {}; // contract_id -> latest proposal_open_contract data

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

socket.onopen = () => {

    console.log("Connected to:", authedWsUrl ? "authenticated socket" : "public socket");

    if (authedWsUrl) {

        const account = JSON.parse(localStorage.getItem("deriv_account") || "null");

        if (account) {
            document.getElementById("status").textContent = `🟢 ${account.account_id}`;

            const loginBtn = document.getElementById("loginBtn");
            loginBtn.textContent = "✅ Logged In";
            loginBtn.disabled = true;
        }

        sendSubscription({ balance: 1 }, (data) => {
            if (data.error) return console.error(data.error);
            if (data.balance) {
                document.getElementById("accountBalance").textContent =
                    `${data.balance.balance} ${data.balance.currency}`;
            }
        });

        // Load any positions that were already open before this page load
        sendRequest({ portfolio: 1 })
            .then((data) => {
                const contracts = (data.portfolio && data.portfolio.contracts) || [];
                contracts.forEach(c => subscribeToContract(c.contract_id));
            })
            .catch((err) => console.error("Portfolio load failed:", err));
    }

    socket.send(JSON.stringify({
        ticks: currentSymbol,
        subscribe: 1
    }));
};

socket.onmessage = (event) => {

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

    const digit = Number(
        data.tick.quote.toString().slice(-1)
    );

    document.getElementById("tick").textContent = digit;

    last100Digits.push(digit);

    if (last100Digits.length > 100) {
        last100Digits.shift();
    }

    const count = Array(10).fill(0);

    last100Digits.forEach(d => count[d]++);

    const highest = Math.max(...count);
    const lowest = Math.min(...count);

    let html = "";

    for (let i = 0; i < 10; i++) {

        const percent = (
            (count[i] / last100Digits.length) * 100
        ).toFixed(1);

        let cls = "";

        if (count[i] === highest) cls = "highest";
        if (count[i] === lowest) cls = "lowest";

        html += `
        <div class="digit-row ${cls}">
            <span class="digit-label">${i}</span>

            <div class="bar-container">
                <div class="bar" style="width:${percent}%"></div>
            </div>

            <span class="digit-percent">${percent}%</span>
        </div>
        `;
    }

    document.getElementById("analysis").innerHTML = html;

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

socket.onerror = () => {
    document.getElementById("status").textContent = "🔴 Connection Error";
};

socket.onclose = () => {
    document.getElementById("status").textContent = "🟠 Disconnected";
};