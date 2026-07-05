// =====================
// BRYCEE TRADES - Trading Engine
// =====================
// Uses `socket` and `sendRequest` from app.js (loaded after this file,
// but that's fine — this function only runs later, on button click).

async function buyDigitContract(contractType, barrier, stake = 1) {

    if (!localStorage.getItem("deriv_ws_url")) {
        alert("Please log in with Deriv first.");
        return;
    }

    if (!socket || socket.readyState !== WebSocket.OPEN) {
        alert("Not connected to Deriv.");
        return;
    }

    try {

        // Request proposal
        const proposalResponse = await sendRequest({
            proposal: 1,
            amount: stake,
            basis: "stake",
            contract_type: contractType,
            currency: "USD",
            duration: 1,
            duration_unit: "t",
            symbol: CONFIG.SYMBOL,
            barrier: barrier
        });

        // Buy contract
        const buyResponse = await sendRequest({
            buy: proposalResponse.proposal.id,
            price: stake
        });

        console.log("Trade placed:", buyResponse);

        alert("Trade placed successfully!");

    } catch (err) {

        console.error(err);

        alert(
            err.message ||
            "Trade failed."
        );

    }

}