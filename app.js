const socket = new WebSocket("wss://ws.derivws.com/websockets/v3?app_id=1089");

let last100Digits = [];

socket.onopen = () => {
    console.log("Connected to Deriv");

    socket.send(JSON.stringify({
        ticks: "R_100"
    }));
};

socket.onmessage = (event) => {

    const data = JSON.parse(event.data);

    if (!data.tick) return;

    const price = data.tick.quote.toString();
    const lastDigit = price.charAt(price.length - 1);

    document.getElementById("tick").textContent = lastDigit;

    last100Digits.push(lastDigit);

    if (last100Digits.length > 100) {
        last100Digits.shift();
    }

    const digitCount = {
        0:0,1:0,2:0,3:0,4:0,
        5:0,6:0,7:0,8:0,9:0
    };

    last100Digits.forEach(digit => {
        digitCount[digit]++;
    });

    const counts = Object.values(digitCount);

    const highest = Math.max(...counts);
    const lowest = Math.min(...counts);

    let html = "";

    for(let i=0;i<=9;i++){

        const percentage = (
            (digitCount[i] / last100Digits.length) * 100 || 0
        ).toFixed(1);

        let rowClass = "";

        if(digitCount[i] === highest){
            rowClass = "highest";
        }else if(digitCount[i] === lowest){
            rowClass = "lowest";
        }

        html += `
        <div class="digit-row ${rowClass}">
            <span class="digit-label">${i}</span>

            <div class="bar-container">
                <div class="bar" style="width:${percentage}%"></div>
            </div>

            <span class="digit-percent">${digitCount[i]} (${percentage}%)</span>
        </div>
        `;
    }

    html += "<hr>";
    html += `<b>Window:</b> Last ${last100Digits.length} ticks`;

    document.getElementById("analysis").innerHTML = html;

let signal = "⚪ No clear signal";

if (digitCount[0] + digitCount[1] + digitCount[2] + digitCount[3] >
    digitCount[6] + digitCount[7] + digitCount[8] + digitCount[9]) {

    signal = "🟢 OVER 3 is currently stronger";

} else if (digitCount[6] + digitCount[7] + digitCount[8] + digitCount[9] >
           digitCount[0] + digitCount[1] + digitCount[2] + digitCount[3]) {

    signal = "🔵 UNDER 6 is currently stronger";
}

document.getElementById("signals").innerHTML = signal;
};
