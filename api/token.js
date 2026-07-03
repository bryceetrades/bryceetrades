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

    const data = await response.json();

    return res.status(response.status).json(data);
}