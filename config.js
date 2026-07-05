const CONFIG = {
    CLIENT_ID: "33zqFdSUnH9jY0bjdm8Vn",
    REDIRECT_URI: "https://bryceetrades-kimsmercy496-2389s-projects.vercel.app",

    // Default market shown on load
    SYMBOL: "R_100",

    // Volatility indices available in the Market dropdown.
    // Trim this list down any time — the dashboard reads it dynamically.
    SYMBOLS: [
        { code: "R_10",     name: "Volatility 10 Index" },
        { code: "R_25",     name: "Volatility 25 Index" },
        { code: "R_50",     name: "Volatility 50 Index" },
        { code: "R_75",     name: "Volatility 75 Index" },
        { code: "R_100",    name: "Volatility 100 Index" },
        { code: "1HZ10V",   name: "Volatility 10 (1s) Index" },
        { code: "1HZ25V",   name: "Volatility 25 (1s) Index" },
        { code: "1HZ50V",   name: "Volatility 50 (1s) Index" },
        { code: "1HZ75V",   name: "Volatility 75 (1s) Index" },
        { code: "1HZ100V",  name: "Volatility 100 (1s) Index" }
    ]
};