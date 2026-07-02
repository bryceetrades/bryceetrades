document
    .getElementById("loginBtn")
    .addEventListener("click", login);

function login() {

    const url =
        `https://oauth.deriv.com/oauth2/authorize` +
        `?app_id=${CONFIG.APP_ID}` +
        `&redirect_uri=${encodeURIComponent(CONFIG.REDIRECT_URI)}` +
        `&scope=read`;

    window.location.href = url;
}

const params = new URLSearchParams(window.location.search);

if (params.has("token1")) {

    const token = params.get("token1");

    document.getElementById("status").innerHTML =
        "✅ Logged in<br><br>" + token;

    console.log(token);

} else {

    console.log("No token received.");

}