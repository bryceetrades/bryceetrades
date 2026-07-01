const socket = new WebSocket("wss://ws.derivws.com/websockets/v3?app_id=1089");

const digitCount = {
    0: 0, 1: 0, 2: 0, 3: 0, 4: 0,
    5: 0, 6: 0, 7: 0, 8: 0, 9: 0
};

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

        digitCount[lastDigit]++;

        document.getElementById("analysis").innerHTML =
            Object.entries(digitCount)
                .map(([digit, count]) => `Digit ${digit}: ${count}`)
                .join("<br>");
    }
};
