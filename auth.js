// auth.js

function login() {
    const url =
        `https://oauth.deriv.com/oauth2/authorize?app_id=${APP_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;

    window.location.href = url;
}

// Handle OAuth callback
const params = new URLSearchParams(window.location.search);

if (params.has("token1")) {
    const token = params.get("token1");
    localStorage.setItem("deriv_token", token);

    console.log("Logged in successfully");
}
