<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Brycee Trades</title>
</head>

<body style="font-family:Arial; text-align:center; padding:40px; background:#f5f5f5; margin:0;">

<h1>Brycee Trades</h1>

<p>Tap below to connect your Deriv account</p>

<button id="loginBtn"
style="padding:15px 30px; font-size:18px; background:#0057ff; color:white; border:none; border-radius:8px;">
Connect Deriv Account
</button>

<p id="status" style="margin-top:20px; word-break:break-all;"></p>

<script>

const APP_ID = "33yMrZBIMziNyVi9bMf2r";
const REDIRECT_URI = "https://bryceetrades.github.io/bryceetrades/";

function connectDeriv() {

    const oauthUrl =
        "https://oauth.deriv.com/oauth2/authorize?app_id=" +
        APP_ID +
        "&redirect_uri=" +
        encodeURIComponent(REDIRECT_URI);

    document.getElementById("status").innerText =
        "Redirecting to: " + oauthUrl;

    window.location.href = oauthUrl;
}
const APP_ID = "33zqFdSUnH9jY0bjdm8Vn";
const REDIRECT_URI = "https://bryceetrades-kimsmercy496-2389s-projects.vercel.app";

document.getElementById("loginBtn").addEventListener("click", () => {

    const url =
        `https://oauth.deriv.com/oauth2/authorize?app_id=${APP_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;

    window.location.href = url;

}

);

document.getElementById("status").innerText =
    "Current URL: " + window.location.href;

</script>

</body>
</html>