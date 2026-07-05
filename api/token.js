export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const { code, verifier } = req.body;
    const CLIENT_ID = "33zqFdSUnH9jY0bjdm8Vn";
    const REDIRECT_URI = "https://bryceetrades-kimsmercy496-2389s-projects.vercel.app";

    // 1. Exchange OAuth code for an access token
    const tokenResponse = await fetch(
        "https://auth.deriv.com/oauth2/token",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: new URLSearchParams({
                grant_type: "authorization_code",
                client_id: CLIENT_ID,
                code,
                code_verifier: verifier,
                redirect_uri: REDIRECT_URI
            })
        }
    );

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
        return res.status(tokenResponse.status).json(tokenData);
    }

    // 2. Get the user's Options account(s)
    const accountsResponse = await fetch(
        "https://api.derivws.com/trading/v1/options/accounts",
        {
            headers: {
                Authorization: `Bearer ${tokenData.access_token}`,
                "Deriv-App-ID": CLIENT_ID
            }
        }
    );

    const accountsData = await accountsResponse.json();
    const account = accountsData.data && accountsData.data[0];

    if (!account) {
        return res.status(500).json({
            error: "No trading account returned",
            accounts: accountsData
        });
    }

    // 3. Get a one-time-password WebSocket URL for that account.
    // This URL (not the classic ws.derivws.com endpoint) is what the
    // frontend must connect to for ticks, balance, and trading.
    const otpResponse = await fetch(
        `https://api.derivws.com/trading/v1/options/accounts/${account.account_id}/otp`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${tokenData.access_token}`,
                "Deriv-App-ID": CLIENT_ID
            }
        }
    );

    const otpData = await otpResponse.json();
    const wsUrl = otpData.data && otpData.data.url;

    if (!wsUrl) {
        return res.status(500).json({
            error: "Failed to generate OTP WebSocket URL",
            otp: otpData
        });
    }

    return res.status(200).json({
        access_token: tokenData.access_token,
        account,
        ws_url: wsUrl
    });
} 