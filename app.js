const APP_ID = "33zqFdSUnH9jY0bjdm8Vn";
const REDIRECT_URI = "https://bryceetrades-kimsmercy496-2389s-projects.vercel.app/";
const CURRENCY = "USD";

let ws = null;
let token = localStorage.getItem('deriv_token');
let balance = 0;

function connectWS() {
  ws = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${APP_ID}`);
    ws.onopen = () => {
        if (token) ws.send(JSON.stringify({ authorize: token }));
          };
            ws.onmessage = (msg) => {
                const data = JSON.parse(msg.data);
                    if (data.error) { console.error(data.error.message); return; }
                        
                            if (data.msg_type === 'authorize') {
                                  ws.send(JSON.stringify({ balance: 1, subscribe: 1 }));
                                      }
                                          
                                              if (data.msg_type === 'balance') {
                                                    balance = data.balance;
                                                          if (document.getElementById('balance')) {
                                                                  document.getElementById('balance').innerText = balance.toFixed(2) + ' USD';
                                                                        }
                                                                            }
                                                                              };
                                                                              }
                                                                              connectWS();

                                                                              function login() {
                                                                                const appUrl = `https://oauth.deriv.com/oauth2/authorize?app_id=${APP_ID}&redirect_uri=${REDIRECT_URI}`;
                                                                                  window.location.href = appUrl;
                                                                                  }

                                                                                  function getTokenFromURL() {
                                                                                    const hash = window.location.hash;
                                                                                      if (hash.includes('token1=')) {
                                                                                          const t = hash.split('token1=')[1].split('&')[0];
                                                                                              localStorage.setItem('deriv_token', t);
                                                                                                  window.location.hash = '';
                                                                                                      location.reload();
                                                                                                        }
                                                                                                        }
                                                                                                        getTokenFromURL();

                                                                                                        function logout() {
                                                                                                          localStorage.removeItem('deriv_token');
                                                                                                            location.href = 'index.html';
                                                                                                            }