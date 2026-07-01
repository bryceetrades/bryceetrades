const socket = new WebSocket("wss://ws.derivws.com/websockets/v3?app_id=1089");

const digitCount = {
  0: 0, 1: 0, 2: 0, 3: 0, 4: 0,
  5: 0, 6: 0, 7: 0, 8: 0, 9: 0
};

let totalTicks = 0;

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
    totalTicks++;

    let highestDigit = "";
    let highestCount = -1;

    let lowestDigit = "";
    let lowestCount = Number.MAX_SAFE_INTEGER;

    let html = "";

    for (let i = 0; i <= 9; i++) {
      const count = digitCount[i];
      const percentage = ((count / totalTicks) * 100).toFixed(1);

      html += `Digit ${i}: ${count} (${percentage}%)<br>`;

      if (count > highestCount) {
        highestCount = count;
        highestDigit = i;
      }

      if (count < lowestCount) {
        lowestCount = count;
        lowestDigit = i;
      }
    }

    html += `<br><b>Highest:</b> ${highestDigit}`;
    html += `<br><b>Lowest:</b> ${lowestDigit}`;

    document.getElementById("analysis").innerHTML = html;
  }
};
