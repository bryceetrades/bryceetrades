// =====================
// BRYCEE TRADES - Trading Engine
// =====================
// Uses `socket`, `sendRequest`, `currentSymbol`, and `subscribeToContract`
// from app.js (loaded before this file).

const DIRECTION_OPTIONS = {
    callput_natural: [
        { value: "CALL", label: "Rise" },
        { value: "PUT",  label: "Fall" }
    ],
    callput_barrier: [
        { value: "CALL", label: "Higher" },
        { value: "PUT",  label: "Lower" }
    ],
    matchdiff: [
        { value: "DIGITMATCH", label: "Matches" },
        { value: "DIGITDIFF",  label: "Differs" }
    ],
    overunder: [
        { value: "DIGITOVER",  label: "Over" },
        { value: "DIGITUNDER", label: "Under" }
    ],
    evenodd: [
        { value: "DIGITEVEN", label: "Even" },
        { value: "DIGITODD",  label: "Odd" }
    ]
};

function refreshTradeForm() {
    const category = document.getElementById("tradeCategory").value;
    const directionSelect = document.getElementById("tradeDirection");

    directionSelect.innerHTML = "";
    DIRECTION_OPTIONS[category].forEach(opt => {
        const el = document.createElement("option");
        el.value = opt.value;
        el.textContent = opt.label;
        directionSelect.appendChild(el);
    });

    const isDigitContract = ["matchdiff", "overunder", "evenodd"].includes(category);

    document.getElementById("predictionRow").style.display =
        (category === "matchdiff" || category === "overunder") ? "block" : "none";

    document.getElementById("barrierRow").style.display =
        (category === "callput_barrier") ? "block" : "none";

    // Digit contracts (Matches/Differs, Over/Under, Even/Odd) only allow
    // tick-based duration on Deriv — lock the unit selector to reflect that.
    const durationUnitSelect = document.getElementById("durationUnit");
    durationUnitSelect.disabled = isDigitContract;
    if (isDigitContract) durationUnitSelect.value = "t";
}

document.getElementById("tradeCategory").addEventListener("change", refreshTradeForm);
refreshTradeForm();

function buildContractRequest() {

    const category = document.getElementById("tradeCategory").value;
    const contract_type = document.getElementById("tradeDirection").value;
    const stake = Number(document.getElementById("stake").value);
    const duration = Number(document.getElementById("duration").value);
    const duration_unit = document.getElementById("durationUnit").value;

    const payload = {
        proposal: 1,
        amount: stake,
        basis: "stake",
        contract_type,
        currency: "USD",
        duration,
        duration_unit,
        underlying_symbol: currentSymbol
    };

    if (category === "matchdiff" || category === "overunder") {
        payload.barrier = document.getElementById("predictionDigit").value;
    } else if (category === "callput_barrier") {
        payload.barrier = document.getElementById("barrierOffset").value;
    }
    // Rise/Fall and Even/Odd need no barrier at all

    return payload;
}

async function placeTrade() {

    if (!localStorage.getItem("deriv_ws_url")) {
        alert("Please log in with Deriv first.");
        return;
    }

    if (!socket || socket.readyState !== WebSocket.OPEN) {
        alert("Not connected to Deriv.");
        return;
    }

    const stake = Number(document.getElementById("stake").value);

    if (!stake || stake <= 0) {
        alert("Enter a stake amount.");
        return;
    }

    try {

        const request = buildContractRequest();
        logEvent(`Requesting proposal: ${request.contract_type} on ${currentSymbol}, stake ${stake}`);

        const proposalResponse = await sendRequest(request);

        const buyResponse = await sendRequest({
            buy: proposalResponse.proposal.id,
            price: stake
        });

        console.log("Trade placed:", buyResponse);
        logEvent(`Trade placed — contract ${buyResponse.buy && buyResponse.buy.contract_id}`);

        if (buyResponse.buy && buyResponse.buy.contract_id) {
            subscribeToContract(buyResponse.buy.contract_id);
        }

    } catch (err) {

        console.error(err);
        logEvent(`Trade failed: ${err.message || "unknown error"}`);
        alert(err.message || "Trade failed.");

    }
}

document.getElementById("buyBtn").addEventListener("click", placeTrade);

// =====================
// QUICK TRADE (Dashboard) — one-click Rise/Fall using the Quick Trade stake
// =====================

async function quickTrade(direction) {

    if (!localStorage.getItem("deriv_ws_url")) {
        alert("Please log in with Deriv first.");
        return;
    }

    if (!socket || socket.readyState !== WebSocket.OPEN) {
        alert("Not connected to Deriv.");
        return;
    }

    const stake = Number(document.getElementById("quickStake").value);

    if (!stake || stake <= 0) {
        alert("Enter a stake amount.");
        return;
    }

    try {

        logEvent(`Quick trade: ${direction} on ${currentSymbol}, stake ${stake}`);

        const proposalResponse = await sendRequest({
            proposal: 1,
            amount: stake,
            basis: "stake",
            contract_type: direction, // "CALL" (Rise) or "PUT" (Fall)
            currency: "USD",
            duration: 5,
            duration_unit: "t",
            underlying_symbol: currentSymbol
        });

        const buyResponse = await sendRequest({
            buy: proposalResponse.proposal.id,
            price: stake
        });

        logEvent(`Quick trade placed — contract ${buyResponse.buy && buyResponse.buy.contract_id}`);

        if (buyResponse.buy && buyResponse.buy.contract_id) {
            subscribeToContract(buyResponse.buy.contract_id);
        }

    } catch (err) {

        console.error(err);
        logEvent(`Quick trade failed: ${err.message || "unknown error"}`);
        alert(err.message || "Trade failed.");

    }
}

document.getElementById("quickRise").addEventListener("click", () => quickTrade("CALL"));
document.getElementById("quickFall").addEventListener("click", () => quickTrade("PUT"));