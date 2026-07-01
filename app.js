const loginBtn = document.getElementById("loginBtn");

// Your Deriv App ID
const APP_ID = "33zqFdSUnH9jY0bjdm8Vn";

loginBtn.addEventListener("click", () => {

    const redirect = encodeURIComponent(window.location.origin);

    const url =
    `https://oauth.deriv.com/oauth2/authorize?app_id=${APP_ID}&l=EN&redirect_uri=${redirect}`;

    window.location.href = url;

});
