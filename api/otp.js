// Given an already-obtained access_token and an account_id, this returns
// a fresh OTP-based WebSocket URL for that account. Used when the user
// switches between Demo and Real without going through OAuth again.

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const { access_token, account_id } = req.body;
    const CLIENT_ID = "33zqFdSUnH9jY0bjdm8Vn";

    if (!access_token || !account_id) {
        return res.status(400).json({ error: "access_token and account_id are required" });
    }

    const otpResponse = await fetch(
        `https://api.derivws.com/trading/v1/options/accounts/${account_id}/otp`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${access_token}`,
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

    return res.status(200).json({ ws_url: wsUrl });
}