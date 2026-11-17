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
  
  panicBtn: document.getElementById("panic-button"),
  themeBtn: document.getElementById("theme-button"),
  opacitySlider: document.getElementById("opacity-slider"),
  opacityValue: document.getElementById("opacity-value"),
  titleDisguise: document.getElementById("title-disguise-toggle"),
  setupPanel: document.getElementById("setup-panel"),
  livePanel: document.getElementById("live-panel"),
  sessionTypeTabs: document.querySelectorAll(".tab-btn"),
  jobDescription: document.getElementById("job-description"),
  importTab: document.getElementById("import-tab"),
  documentSelect: document.getElementById("document-select"),
  autoAnswer: document.getElementById("auto-answer-toggle"),
  startSession: document.getElementById("start-session-btn"),
  backToSetup: document.getElementById("back-to-setup"),
  questionInput: document.getElementById("question-input"),
  askBtn: document.getElementById("ask-btn"),
  listenToggle: document.getElementById("listen-toggle-btn"),
  solveScreen: document.getElementById("solve-screen-btn"),
  aiResponse: document.getElementById("ai-response-container"),
};

let currentSession = { type: "INTERVIEW", sessionId: "" };
let isListening = false;

function showSettingsMessage(message, kind = "") {
  elements.settingsMessage.textContent = message;
  elements.settingsMessage.dataset.kind = kind;
}

function updateStealthUI() {
  document.body.classList.toggle("vscode-theme", localStorage.getItem("pp-theme") === "vscode");
  document.body.style.opacity = elements.opacitySlider.value;
  elements.opacityValue.textContent = `${Math.round(elements.opacitySlider.value * 100)}%`;
  
  if (elements.titleDisguise.checked) {
    document.title = "README.md - Visual Studio Code";
  } else {
    document.title = "PitchPilot Stealth Copilot";
  }
}

function togglePanic() {
  const isHidden = document.body.classList.toggle("panic-hidden");
  if (isHidden) {
    document.body.style.opacity = "0";
  } else {
    updateStealthUI();
  }
}

async function loadPopup() {
  const settings = await PitchPilotExtension.loadSettings();
  elements.backendOrigin.value = settings.apiOrigin;
  elements.extensionToken.value = settings.apiToken;
  elements.rememberToken.checked = settings.rememberToken;
  elements.upgradeLink.href = `${settings.apiOrigin}/pricing`;
  elements.supportLink.href = `${settings.apiOrigin}/dashboard`;
  elements.manualTokenLink.href = `${settings.apiOrigin}/extension-access`;

  if (settings.apiToken) {
    try {
      const payload = await PitchPilotExtension.requestJson("/api/extension/context", settings);
      const credits = Number(payload.user?.credits);
      elements.creditBadge.textContent = Number.isFinite(credits) ? `${credits.toLocaleString()} credits` : "Active";
      
      elements.documentSelect.innerHTML = payload.documents
        .map(d => `<option value="${d.id}">${d.title} (${d.docType})</option>`).join("");
    } catch {
      elements.creditBadge.textContent = "Token issue";
    }
  } else {
    elements.creditBadge.textContent = "Connect token";
  }
}

elements.settingsToggle.addEventListener("click", () => {
  const isSettings = !elements.settingsPanel.hidden;
  elements.settingsPanel.hidden = isSettings;
  elements.settingsToggle.setAttribute("aria-expanded", String(!isSettings));
});

elements.settingsClose.addEventListener("click", () => elements.settingsPanel.hidden = true);
elements.saveSettings.addEventListener("click", async () => {
  try {
    await PitchPilotExtension.saveSettings({
      apiOrigin: elements.backendOrigin.value,
      apiToken: elements.extensionToken.value,
      rememberToken: elements.rememberToken.checked,
    });
    showSettingsMessage("Saved.", "success");
    await loadPopup();
  } catch (e) {
    showSettingsMessage(e.message, "error");
  }
});

elements.panicBtn.addEventListener("click", togglePanic);
elements.themeBtn.addEventListener("click", () => {
  const isVsCode = localStorage.getItem("pp-theme") === "vscode";
  localStorage.setItem("pp-theme", isVsCode ? "default" : "vscode");
  updateStealthUI();
});
elements.opacitySlider.addEventListener("input", updateStealthUI);
elements.titleDisguise.addEventListener("change", updateStealthUI);

elements.sessionTypeTabs.forEach(btn => btn.addEventListener("click", (e) => {
  elements.sessionTypeTabs.forEach(t => t.classList.remove("active"));
  e.currentTarget.classList.add("active");
  currentSession.type = e.currentTarget.dataset.sessionType;
}));

elements.startSession.addEventListener("click", () => {
  elements.setupPanel.hidden = true;
  elements.livePanel.hidden = false;
});

elements.backToSetup.addEventListener("click", () => {
  elements.setupPanel.hidden = false;
  elements.livePanel.hidden = true;
});

elements.askBtn.addEventListener("click", async () => {
  const prompt = elements.questionInput.value;
  if (!prompt) return;
  const settings = await PitchPilotExtension.loadSettings();
  try {
    const res = await PitchPilotExtension.requestJson("/api/copilot/query", settings, {
      method: "POST",
      body: JSON.stringify({ question: prompt, mode: currentSession.type })
    });
    elements.aiResponse.textContent = res.data.summary || "No AI response.";
  } catch (e) {
    elements.aiResponse.textContent = "Error: " + e.message;
  }
});

elements.listenToggle.addEventListener("click", () => {
  isListening = !isListening;
  elements.listenToggle.textContent = isListening ? "⏹ Stop Listening" : "🎤 Start Listening";
});

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" || (e.ctrlKey && e.shiftKey && e.key === "H")) {
    togglePanic();
  }
});

elements.connectAccount.addEventListener("click", async () => {
  try {
    await PitchPilotExtension.connectAccount();
    await loadPopup();
  } catch (e) {
    showSettingsMessage(e.message, "error");
  }
});

loadPopup();
updateStealthUI();
