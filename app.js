const socket = new WebSocket("wss://ws.derivws.com/websockets/v3?app_id=1089");

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
    }
};
