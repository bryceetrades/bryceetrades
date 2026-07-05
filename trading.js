async function buyDigitContract(contractType, barrier, stake = 1) {

    const token = localStorage.getItem("deriv_token");

    if (!token) {
        alert("Please login first.");
        return;
    }

    const ws = new WebSocket(
        `wss://ws.derivws.com/websockets/v3?app_id=${CONFIG.APP_ID}`
    );

    ws.onopen = () => {

        ws.send(JSON.stringify({
            authorize: token
        }));

    };

    ws.onmessage = (event) => {

        const data = JSON.parse(event.data);

        if (data.error) {
            alert(data.error.message);
            ws.close();
            return;
        }

        // Authorized
        if (data.msg_type === "authorize") {

            ws.send(JSON.stringify({
                proposal: 1,
                amount: stake,
                basis: "stake",
                contract_type: contractType,
                currency: "USD",
                duration: 1,
                duration_unit: "t",
                symbol: CONFIG.SYMBOL,
                barrier: barrier
            }));

            return;
        }

        // Proposal received
        if (data.msg_type === "proposal") {

            ws.send(JSON.stringify({
                buy: data.proposal.id,
                price: stake
            }));

            return;
        }

        // Trade purchased
        if (data.msg_type === "buy") {

            alert("✅ Trade placed successfully!");

            console.log(data);

            ws.close();

        }

    };

}