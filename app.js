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

// --- Request/response tracker -----------------------------------------
// Lets trading.js do `await sendRequest({...})` instead of juggling
// raw onmessage callbacks. The Deriv API echoes back req_id.
let reqCounter = 1;
const pendingRequests = {};

function sendRequest(payload) {
    return new Promise((resolve, reject) => {
        const req_id = reqCounter++;
        pendingRequests[req_id] = { resolve, reject };
        socket.send(JSON.stringify({ ...payload, req_id }));
    });
}
// -----------------------------------------------------------------------

let last100Digits = [];
let highStreak = 0;
let lowStreak = 0;
let signalLocked = false;

socket.onopen = () => {

    console.log("Connected to:", authedWsUrl ? "authenticated socket" : "public socket");

    if (authedWsUrl) {

        const account = JSON.parse(localStorage.getItem("deriv_account") || "null");

        if (account) {
            document.getElementById("status").textContent =
                `🟢 ${account.account_id}`;

            const loginBtn = document.getElementById("loginBtn");
            loginBtn.textContent = "✅ Logged In";
            loginBtn.disabled = true;
        }

        sendRequest({ balance: 1, subscribe: 1 })
            .then((data) => {
                document.getElementById("accountBalance").textContent =
                    `${data.balance.balance} ${data.balance.currency}`;
            })
            .catch((err) => {
                console.error("Balance request failed:", err);
            });
    }

    // Ticks work on both the public and authenticated socket
    socket.send(JSON.stringify({
        ticks: CONFIG.SYMBOL,
        subscribe: 1
    }));
};

socket.onmessage = (event) => {

    const data = JSON.parse(event.data);

    // Resolve/reject any pending promise-based request (balance/proposal/buy/etc.)
    if (data.req_id && pendingRequests[data.req_id]) {
        const { resolve, reject } = pendingRequests[data.req_id];
        delete pendingRequests[data.req_id];

        if (data.error) {
            reject(data.error);
        } else {
            resolve(data);
        }
    }

    if (data.error) {
        console.log(data.error);
        return;
    }

    if (data.msg_type === "balance" && data.balance) {
        document.getElementById("accountBalance").textContent =
            `${data.balance.balance} ${data.balance.currency}`;
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
    // SIGNAL ENGINE
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

            signal = "🟢 BUY UNDER 6";
            signalLocked = true;

        }

        else if (lowStreak >= 3) {

            signal = "🔵 BUY OVER 3";
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

    document.getElementById("status").textContent =
        "🔴 Connection Error";

};

socket.onclose = () => {

    document.getElementById("status").textContent =
        "🟠 Disconnected";

};

document.getElementById("buyBtn").addEventListener("click", async () => {

    try {

        await buyDigitContract(
            "DIGITUNDER",
            6,
            1
        );

    } catch (error) {

        console.error(error);
        alert(error.message || "Trade failed.");

    }

});