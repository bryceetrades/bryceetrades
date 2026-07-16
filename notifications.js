// =====================================================================
// NOTIFICATIONS (notifications.js)
// =====================================================================
// One entry point — notify(title, body, type) — used everywhere a
// notification is needed: bot start/stop, trade entered/skipped, profit
// target/loss limit hit, API disconnect/reconnect. Respects the Sound
// Alerts and Browser Notifications toggles from Settings
// (soundAlertsEnabled / notificationsEnabled, set in settingsmanager.js).
//
// type is one of "success" | "warning" | "error" | "info" — drives the
// sound's tone and the in-app toast's color.
// =====================================================================

function playAlertSound(type) {
    if (typeof soundAlertsEnabled === "undefined" || !soundAlertsEnabled) return;

    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        const freq = { success: 880, info: 660, warning: 440, error: 220 }[type] || 660;
        osc.type = "sine";
        osc.frequency.value = freq;

        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

        osc.start();
        osc.stop(ctx.currentTime + 0.25);
    } catch (err) {
        console.warn("Sound alert failed:", err);
    }
}

let notificationPermissionRequested = false;

function showBrowserNotification(title, body) {
    if (typeof notificationsEnabled === "undefined" || !notificationsEnabled) return;
    if (!("Notification" in window)) return;

    if (Notification.permission === "granted") {
        new Notification(title, { body });
    } else if (Notification.permission !== "denied" && !notificationPermissionRequested) {
        notificationPermissionRequested = true;
        Notification.requestPermission().then(permission => {
            if (permission === "granted") new Notification(title, { body });
        });
    }
}

function showInAppNotification(title, body, type) {
    const container = document.getElementById("appNotifications");
    if (!container) return;

    const el = document.createElement("div");
    el.className = `app-notification ${type}`;
    el.innerHTML = `<strong>${title}</strong>${body ? `<span>${body}</span>` : ""}`;
    container.appendChild(el);

    requestAnimationFrame(() => el.classList.add("show"));

    setTimeout(() => {
        el.classList.remove("show");
        setTimeout(() => el.remove(), 300);
    }, 4500);

    // Keep the stack from growing unbounded if events fire in a burst
    while (container.children.length > 5) {
        container.removeChild(container.firstChild);
    }
}

function notify(title, body, type = "info") {
    if (typeof logEvent === "function") {
        logEvent(`🔔 ${title}${body ? " — " + body : ""}`);
    }
    playAlertSound(type);
    showBrowserNotification(title, body);
    showInAppNotification(title, body, type);
}

// Ask for browser notification permission as soon as the user opts in,
// rather than waiting for the first event to try (better UX).
document.getElementById("settingsNotifications").addEventListener("change", (e) => {
    if (e.target.checked && "Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
    }
});