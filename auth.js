// auth.js

function login() {
    const url =
        `https://oauth.deriv.com/oauth2/authorize?app_id=${CONFIG.APP_ID}&redirect_uri=${encodeURIComponent(CONFIG.REDIRECT_URI)}`;

    window.location.href = url;
}

// Handle redirect after login
const params = new URLSearchParams(window.location.search);

if (params.has("token1")) {
    const token = params.get("token1");
    localStorage.setItem("deriv_token", token);

    console.log("SUCCESS! Token:", token);

    // Remove token from URL
    window.history.replaceState({}, document.title, "/");
}