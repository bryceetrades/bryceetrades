const APP_ID = "33zqFdSUnH9jY0bjdm8Vn";
const REDIRECT_URI = "https://bryceetrades-kimsmercy496-2389s-projects.vercel.app";

// =====================
// DERIV LOGIN
// =====================

document.getElementById("loginBtn").addEventListener("click", () => {

    const oauthUrl =
        `https://oauth.deriv.com/oauth2/authorize?app_id=${APP_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;

    window.location.href = oauthUrl;

});

// =====================
// LIVE TICKS
// =====================

const socket = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=1089`);

let last100Digits = [];

let highStreak = 0;
let lowStreak = 0;

let signalLocked = false;

socket.onopen = () => {

    console.log("Connected");

    socket.send(JSON.stringify({
        ticks: "R_100"
    }));

};

socket.onmessage = (event) => {

    const data = JSON.parse(event.data);

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

        const percent =
            last100Digits.length
                ? ((count[i] / last100Digits.length) * 100).toFixed(1)
                : "0.0";

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

        </div>`;
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

        } else if (lowStreak >= 3) {

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

    document.getElementById("status").textContent = "🔴 Connection Error";

};

socket.onclose = () => {

    document.getElementById("status").textContent = "🟠 Disconnected";

};

document.getElementById("buyBtn").addEventListener("click", () => {

    alert("Trading engine will be connected after OAuth login.");

});
