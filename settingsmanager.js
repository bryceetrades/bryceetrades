// =====================================================================
// SETTINGS MANAGER (settingsmanager.js)
// =====================================================================
// Settings tab is the "save your defaults" hub: editing a value here and
// clicking Save Settings both (1) applies it to the live Bot Builder
// fields immediately and (2) persists it to localStorage so it's
// restored automatically the next time the site loads. The live fields
// in Bot Builder remain directly editable for in-session tweaks — this
// doesn't lock them, it just sets what they start as.
// =====================================================================

const SETTINGS_KEY = "bryceetrades_settings";

const SETTINGS_DEFAULTS = {
    stake: 1,
    strategy: "A",
    confidenceThreshold: 80,
    dailyProfitTarget: 20,
    dailyLossLimit: 20,
    maxConsecutiveLosses: 5,
    cooldownAfterLoss: 30,
    maxTradesPerHour: 30,
    maxStake: 5,
    minBalance: 0,
    soundAlerts: false,
    notifications: false
};

// Read by notifications.js (Feature 7) to decide whether to play a sound
// or show a browser notification.
let soundAlertsEnabled = SETTINGS_DEFAULTS.soundAlerts;
let notificationsEnabled = SETTINGS_DEFAULTS.notifications;

function loadSettings() {
    try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        return raw ? { ...SETTINGS_DEFAULTS, ...JSON.parse(raw) } : { ...SETTINGS_DEFAULTS };
    } catch {
        return { ...SETTINGS_DEFAULTS };
    }
}

// Fills both the Settings tab fields AND the live Bot Builder / Risk
// Management fields from the given settings object.
function applySettingsToFields(settings) {
    document.getElementById("settingsStake").value = settings.stake;
    document.getElementById("settingsStrategy").value = settings.strategy;
    document.getElementById("settingsConfidenceThreshold").value = settings.confidenceThreshold;
    document.getElementById("settingsDailyProfitTarget").value = settings.dailyProfitTarget;
    document.getElementById("settingsDailyLossLimit").value = settings.dailyLossLimit;
    document.getElementById("settingsMaxConsecutiveLosses").value = settings.maxConsecutiveLosses;
    document.getElementById("settingsCooldownAfterLoss").value = settings.cooldownAfterLoss;
    document.getElementById("settingsMaxTradesPerHour").value = settings.maxTradesPerHour;
    document.getElementById("settingsMaxStake").value = settings.maxStake;
    document.getElementById("settingsMinBalance").value = settings.minBalance;
    document.getElementById("settingsSoundAlerts").checked = settings.soundAlerts;
    document.getElementById("settingsNotifications").checked = settings.notifications;

    // Live fields (Bot Builder / Risk Management)
    document.getElementById("stake").value = settings.stake;
    document.getElementById("autoStrategySelect").value = settings.strategy;
    document.getElementById("aiConfidenceThreshold").value = settings.confidenceThreshold;
    document.getElementById("riskDailyProfitTarget").value = settings.dailyProfitTarget;
    document.getElementById("riskDailyLossLimit").value = settings.dailyLossLimit;
    document.getElementById("riskMaxConsecutiveLosses").value = settings.maxConsecutiveLosses;
    document.getElementById("riskCooldownAfterLoss").value = settings.cooldownAfterLoss;
    document.getElementById("riskMaxTradesPerHour").value = settings.maxTradesPerHour;
    document.getElementById("riskMaxStake").value = settings.maxStake;
    document.getElementById("riskMinBalance").value = settings.minBalance;

    soundAlertsEnabled = settings.soundAlerts;
    notificationsEnabled = settings.notifications;

    if (typeof renderBotDashboard === "function") renderBotDashboard();
}

function readSettingsFromFields() {
    return {
        stake: Number(document.getElementById("settingsStake").value) || SETTINGS_DEFAULTS.stake,
        strategy: document.getElementById("settingsStrategy").value,
        confidenceThreshold: Number(document.getElementById("settingsConfidenceThreshold").value) || 0,
        dailyProfitTarget: Number(document.getElementById("settingsDailyProfitTarget").value) || 0,
        dailyLossLimit: Number(document.getElementById("settingsDailyLossLimit").value) || 0,
        maxConsecutiveLosses: Number(document.getElementById("settingsMaxConsecutiveLosses").value) || 0,
        cooldownAfterLoss: Number(document.getElementById("settingsCooldownAfterLoss").value) || 0,
        maxTradesPerHour: Number(document.getElementById("settingsMaxTradesPerHour").value) || 0,
        maxStake: Number(document.getElementById("settingsMaxStake").value) || 0,
        minBalance: Number(document.getElementById("settingsMinBalance").value) || 0,
        soundAlerts: document.getElementById("settingsSoundAlerts").checked,
        notifications: document.getElementById("settingsNotifications").checked
    };
}

document.getElementById("saveSettingsBtn").addEventListener("click", () => {
    const settings = readSettingsFromFields();
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    applySettingsToFields(settings);

    const note = document.getElementById("settingsSavedNote");
    note.textContent = "✅ Saved and applied.";
    setTimeout(() => { note.textContent = ""; }, 2500);

    if (typeof logEvent === "function") logEvent("Settings saved");
});

document.getElementById("resetSettingsBtn").addEventListener("click", () => {
    if (!confirm("Reset all settings to defaults?")) return;
    localStorage.removeItem(SETTINGS_KEY);
    applySettingsToFields(SETTINGS_DEFAULTS);

    const note = document.getElementById("settingsSavedNote");
    note.textContent = "Reset to defaults.";
    setTimeout(() => { note.textContent = ""; }, 2500);
});

// Restore saved settings the moment the page loads
applySettingsToFields(loadSettings());