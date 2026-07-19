// Resets a demo (virtual) account's balance back to the default $10,000.
// Only works for demo accounts — Deriv rejects this for real accounts.

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const { access_token, account_id } = req.body;
    const CLIENT_ID = "33zqFdSUnH9jY0bjdm8Vn";

    if (!access_token || !account_id) {
        return res.status(400).json({ error: "access_token and account_id are required" });
    }

    const response = await fetch(
        `https://api.derivws.com/trading/v1/options/accounts/${account_id}/reset-demo-balance`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${access_token}`,
                "Deriv-App-ID": CLIENT_ID
            }
        }
    );

    const data = await response.json();

    if (!response.ok) {
        return res.status(response.status).json({ error: data.errors?.[0]?.message || "Reset failed", details: data });
    }

    return res.status(200).json({ success: true, data });
}