"use strict";

const elements = {
  settingsToggle: document.getElementById("settings-toggle"),
  settingsPanel: document.getElementById("settings-panel"),
  settingsClose: document.getElementById("settings-close"),
  backendOrigin: document.getElementById("backend-origin"),
  extensionToken: document.getElementById("extension-token"),
  rememberToken: document.getElementById("remember-token"),
  saveSettings: document.getElementById("save-settings"),
  settingsMessage: document.getElementById("settings-message"),
  creditBadge: document.getElementById("credit-badge"),
  upgradeLink: document.getElementById("upgrade-link"),
  supportLink: document.getElementById("support-link"),
  connectAccount: document.getElementById("connect-account"),
  manualTokenLink: document.getElementById("manual-token-link"),
  openPanel: document.getElementById("open-panel"),
};

function showSettingsMessage(message, kind = "") {
  elements.settingsMessage.textContent = message;
  elements.settingsMessage.dataset.kind = kind;
}

function setSettingsOpen(open) {
  elements.settingsPanel.hidden = !open;
  elements.settingsToggle.setAttribute("aria-expanded", String(open));
}

async function loadPopup() {
  try {
    const settings = await PitchPilotExtension.loadSettings();
    elements.backendOrigin.value = settings.apiOrigin;
    elements.extensionToken.value = settings.apiToken;
    elements.rememberToken.checked = settings.rememberToken;
    elements.upgradeLink.href = `${settings.apiOrigin}/pricing`;
    elements.supportLink.href = `${settings.apiOrigin}/dashboard`;
    elements.manualTokenLink.href = `${settings.apiOrigin}/extension-access`;

    if (!settings.apiToken) {
      elements.creditBadge.textContent = "Connect token";
      return;
    }

    try {
      const payload = await PitchPilotExtension.requestJson("/api/extension/context", settings);
      const credits = Number(payload.user?.credits);
      elements.creditBadge.textContent = Number.isFinite(credits)
        ? `${credits.toLocaleString()} credits`
        : `${payload.user?.plan || "Account connected"}`;
    } catch (error) {
      elements.creditBadge.textContent = error instanceof Error && error.message.includes("expired")
        ? "Token expired"
        : "Credits unavailable";
    }
  } catch {
    elements.creditBadge.textContent = "Settings unavailable";
    showSettingsMessage("Could not read extension settings. Check Chrome storage access.", "error");
  }
}

async function savePopupSettings() {
  elements.saveSettings.disabled = true;
  showSettingsMessage("");
  try {
    const settings = await PitchPilotExtension.saveSettings({
      apiOrigin: elements.backendOrigin.value,
      apiToken: elements.extensionToken.value,
      rememberToken: elements.rememberToken.checked,
    });
    elements.backendOrigin.value = settings.apiOrigin;
    elements.upgradeLink.href = `${settings.apiOrigin}/pricing`;
    elements.supportLink.href = `${settings.apiOrigin}/dashboard`;
    elements.manualTokenLink.href = `${settings.apiOrigin}/extension-access`;
    showSettingsMessage("Settings saved.", "success");
    await loadPopup();
  } catch (error) {
    showSettingsMessage(error instanceof Error ? error.message : "Could not save settings.", "error");
  } finally {
    elements.saveSettings.disabled = false;
  }
}

async function connectAccount() {
  elements.connectAccount.disabled = true;
  elements.creditBadge.textContent = "Connecting…";
  showSettingsMessage("");
  try {
    const settings = await PitchPilotExtension.loadSettings();
    const connected = await PitchPilotExtension.connectAccount(settings);
    elements.extensionToken.value = connected.apiToken;
    elements.backendOrigin.value = connected.apiOrigin;
    elements.rememberToken.checked = connected.rememberToken;
    showSettingsMessage("Account connected. Token stored using your current storage preference.", "success");
    await loadPopup();
  } catch (error) {
    elements.creditBadge.textContent = "Not connected";
    showSettingsMessage(error instanceof Error ? error.message : "Could not connect your account.", "error");
    elements.settingsPanel.hidden = false;
    elements.settingsToggle.setAttribute("aria-expanded", "true");
  } finally {
    elements.connectAccount.disabled = false;
  }
}

elements.settingsToggle.addEventListener("click", () => {
  setSettingsOpen(elements.settingsPanel.hidden);
});
elements.settingsClose.addEventListener("click", () => setSettingsOpen(false));
elements.saveSettings.addEventListener("click", () => void savePopupSettings());
elements.openPanel.addEventListener("click", async () => {
  elements.openPanel.disabled = true;
  try {
    await PitchPilotExtension.openFullSidePanel();
    window.close();
  } catch (error) {
    showSettingsMessage(error instanceof Error ? error.message : "Could not open the side panel.", "error");
    elements.openPanel.disabled = false;
  }
});
elements.supportLink.addEventListener("click", (event) => {
  event.preventDefault();
  void PitchPilotExtension.openAppPage("/dashboard");
});
elements.upgradeLink.addEventListener("click", (event) => {
  event.preventDefault();
  void PitchPilotExtension.openAppPage("/pricing");
});
elements.manualTokenLink.addEventListener("click", (event) => {
  event.preventDefault();
  void PitchPilotExtension.openAppPage("/extension-access");
});
elements.connectAccount.addEventListener("click", () => void connectAccount());

void loadPopup();
