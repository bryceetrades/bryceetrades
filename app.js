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

    if (data.tick) {

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

        let html = "";

        let highestDigit = 0;
        let lowestDigit = 0;

        for(let i=0;i<=9;i++){

    const percentage =
    ((digitCount[i]/last100Digits.length)*100 || 0).toFixed(1);

    html += `
    <div class="digit-row">
        <span class="digit-label">${i}</span>

        <div class="bar-container">
            <div class="bar" style="width:${percentage}%"></div>
        </div>

        <span class="digit-percent">${percentage}%</span>
    </div>
    `;

    if(digitCount[i] > digitCount[highestDigit])
        highestDigit = i;

    if(digitCount[i] < digitCount[lowestDigit])
        lowestDigit = i;
        }

        html += "<hr>";
        html += `<b>Highest:</b> ${highestDigit}<br>`;
        html += `<b>Lowest:</b> ${lowestDigit}<br>`;
        html += `<b>Window:</b> Last ${last100Digits.length} ticks`;

        document.getElementById("analysis").innerHTML = html;
    }
}
