export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const { code, verifier } = req.body;

    const response = await fetch("https://auth.deriv.com/oauth2/token", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
            grant_type: "authorization_code",
            client_id: "33zqFdSUnH9jY0bjdm8Vn",
            code,
            code_verifier: verifier,
            redirect_uri: "https://bryceetrades-kimsmercy496-2389s-projects.vercel.app"
        })
    });

    const accounts = await fetch("https://api.derivws.com/trading/v1/options/accounts", {
    headers: {
        "Authorization": `Bearer ${data.access_token}`,
        "Deriv-App-ID": "33zqFdSUnH9jY0bjdm8Vn"
    }
});

const data = await response.json();
const accountsData = await accounts.json();

console.log(accountsData);

    res.status(response.status).json(data);
}