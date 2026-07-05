// =====================
// BRYCEE TRADES - Trading Engine
// =====================

async function buyDigitContract(contractType, barrier, stake = 1) {

    if (!api) {
        alert("Not connected to Deriv.");
        return;
    }

    try {

        // Request proposal
        const proposal = await api.proposal({
            proposal: 1,
            amount: stake,
            basis: "stake",
            contract_type: contractType,
            currency: "USD",
            duration: 1,
            duration_unit: "t",
            symbol: currentSymbol,
            barrier: barrier
        });

        // Buy contract
        const buy = await api.buy({
            buy: proposal.proposal.id,
            price: stake
        });

        console.log("Trade placed:", buy);

        alert("Trade placed successfully!");

    } catch (err) {

        console.error(err);

        alert(
            err.error?.message ||
            err.message ||
            "Trade failed."
        );

    }

}
