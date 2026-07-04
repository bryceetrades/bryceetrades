const AUTH_URL = "https://auth.deriv.com/oauth2/auth";

function randomString(length) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);

    for (let i = 0; i < length; i++) {
        result += chars[array[i] % chars.length];
    }

    return result;
}

async function sha256(text) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hash = await crypto.subtle.digest("SHA-256", data);
    return hash;
}

function base64url(buffer) {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

async function login() {
    const verifier = randomString(64);
    localStorage.setItem("pkce_verifier", verifier);

    const challenge = base64url(await sha256(verifier));
    const state = randomString(32);

    const url =
        `${AUTH_URL}?client_id=${CONFIG.CLIENT_ID}` +
        `&redirect_uri=${encodeURIComponent(CONFIG.REDIRECT_URI)}` +
        `&response_type=code` +
        `&scope=trade account_manage` +
        `&state=${state}` +
        `&code_challenge=${challenge}` +
        `&code_challenge_method=S256`;

    window.location.href = url;
}

document.getElementById("loginBtn").addEventListener("click", login);
(async () => {
    const params = new URLSearchParams(window.location.search);

    if (!params.has("code")) return;

    const code = params.get("code");
    const verifier = localStorage.getItem("pkce_verifier");

    const response = await fetch("/api/token", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            code,
            verifier
        })
    });

    const data = await response.json();

    console.log("OAuth Response:", data);

    if (data.access_token) {

    localStorage.setItem("deriv_token", data.access_token);

    localStorage.setItem(
        "deriv_account",
        JSON.stringify(data.accounts.data[0])
    );

    window.history.replaceState({}, "", "/");

    location.reload();
}
         else {
        alert("❌ Login Failed");
        console.log(data);
    }
})();