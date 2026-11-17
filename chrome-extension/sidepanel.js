"use strict";

const SETTINGS_KEY = "pitchpilotSettings";
const SILENCE_DELAY_MS = 1500;
const SCREEN_SCAN_INTERVAL_MS = 15_000;
const SCREEN_SCAN_QUESTION = "Inspect this screen frame for a visible programming or coding challenge, or an interview question. If a clear question is visible, solve it without inventing missing details. For coding tasks, provide the approach, optimal code in the language shown or requested, and time/space Big-O. For interview questions, provide a concise structured answer. If no question is visible, state that no question was detected.";
const CAMOUFLAGE_STORAGE_KEY = "pitchpilotCamouflageMode";
const STEALTH_PREF_STORAGE_KEY = "pitchpilotStealthPrefs";

const elements = {
  settingsToggle: document.getElementById("settings-toggle"),
  connectionSettings: document.getElementById("connection-settings"),
  backendOrigin: document.getElementById("backend-origin"),
  apiToken: document.getElementById("api-token"),
  rememberToken: document.getElementById("remember-token"),
  saveSettings: document.getElementById("save-settings"),
  clearToken: document.getElementById("clear-token"),
  connectAccount: document.getElementById("connect-account"),
  settingsMessage: document.getElementById("settings-message"),
  settingsClose: document.getElementById("settings-close"),
  extensionAccessLink: document.getElementById("extension-access-link"),
  supportLink: document.getElementById("support-link"),
  upgradeLink: document.getElementById("upgrade-link"),
  creditBadge: document.getElementById("credit-badge"),
  signedUser: document.getElementById("signed-user"),
  shell: document.querySelector(".shell"),
  enableMicrophone: document.getElementById("enable-microphone"),
  micGrantView: document.getElementById("mic-grant-view"),
  micGrantStatus: document.getElementById("mic-grant-status"),
  micGrantAction: document.getElementById("mic-grant-action"),
  status: document.getElementById("status"),
  statusTitle: document.getElementById("status-title"),
  statusDetail: document.getElementById("status-detail"),
  appMessage: document.getElementById("app-message"),
  setupView: document.getElementById("setup-view"),
  contextStep: document.getElementById("context-step"),
  preferencesStep: document.getElementById("preferences-step"),
  contextIndicator: document.getElementById("step-context-indicator"),
  preferencesIndicator: document.getElementById("step-preferences-indicator"),
  sessionTypeButtons: [...document.querySelectorAll("[data-session-type]")],
  jobDescription: document.getElementById("job-description"),
  importTab: document.getElementById("import-tab"),
  briefFile: document.getElementById("brief-file"),
  resumeFile: document.getElementById("resume-file"),
  resumeSelect: document.getElementById("resume-select"),
  resumeStatus: document.getElementById("resume-status"),
  documentSelect: document.getElementById("document-select"),
  documentsStatus: document.getElementById("documents-status"),
  nextStep: document.getElementById("next-step"),
  backToContext: document.getElementById("back-to-context"),
  languageSelect: document.getElementById("language-select"),
  answerStyle: document.getElementById("answer-style"),
  autoAnswer: document.getElementById("auto-answer"),
  sessionId: document.getElementById("session-id"),
  startSession: document.getElementById("start-session"),
  liveView: document.getElementById("live-view"),
  liveSessionType: document.getElementById("live-session-type"),
  elapsedTime: document.getElementById("elapsed-time"),
  listenButton: document.getElementById("listen-button"),
  liveAutoAnswer: document.getElementById("live-auto-answer"),
  shareScreenButton: document.getElementById("share-screen-button"),
  screenPreviewPanel: document.getElementById("screen-preview-panel"),
  screenPreview: document.getElementById("screen-preview"),
  screenShareStatus: document.getElementById("screen-share-status"),
  stopScreenShare: document.getElementById("stop-screen-share"),
  screenScanStatus: document.getElementById("screen-scan-status"),
  solveButton: document.getElementById("solve-button"),
  question: document.getElementById("question"),
  askButton: document.getElementById("ask-button"),
  results: document.getElementById("results"),
  endSession: document.getElementById("end-session"),
  panicHideBtn: document.getElementById("panic-hide-btn"),
  camouflageToggle: document.getElementById("camouflage-toggle"),
  stealthOpacity: document.getElementById("stealth-opacity"),
  disguiseTitleToggle: document.getElementById("disguise-title-toggle"),
};

const state = {
  settings: null,
  documents: [],
  sessionType: "INTERVIEW",
  language: "English",
  answerStyle: "Concise",
  jobDescription: "",
  documentIds: [],
  sessionId: "",
  sessionStartedAt: 0,
  timer: null,
  listening: false,
  recognition: null,
  speechDraft: "",
  interimDraft: "",
  silenceTimer: null,
  restartTimer: null,
  requestInFlight: false,
  requestQueue: [],
  microphoneGranted: false,
  targetTabId: null,
  displayStream: null,
  screenScanTimer: null,
  screenScanInFlight: false,
  lastScannedFrame: "",
  stealthMode: false,
  panicHidden: false,
  titleDisguised: false,
  opacity: 1.0,
  originalTitle: document.title || "PitchPilot AI",
};

function setStatus(title, detail, status = "idle") {
  if (elements.statusTitle) elements.statusTitle.textContent = title;
  if (elements.statusDetail) elements.statusDetail.textContent = detail;
  if (elements.status) elements.status.dataset.state = status;
}

function showMessage(message, kind = "error") {
  if (elements.appMessage) {
    elements.appMessage.textContent = message || "";
    elements.appMessage.hidden = !message;
    elements.appMessage.dataset.kind = kind;
  }
}

function updateStealthUI() {
  document.body.classList.toggle("stealth-mode", state.stealthMode);
  elements.camouflageToggle.textContent = state.stealthMode ? "💻 Default Theme" : "💻 VS Code Theme";
  
  if (elements.shell) elements.shell.classList.toggle("panic-blurred", state.panicHidden);
  elements.panicHideBtn.textContent = state.panicHidden ? "🛡️ Show UI" : "🛡️ Panic Hide (Esc)";

  document.title = state.titleDisguised ? "README.md - Visual Studio Code" : state.originalTitle;
  document.body.style.opacity = String(state.opacity);
  
  elements.stealthOpacity.value = String(state.opacity);
  elements.disguiseTitleToggle.checked = state.titleDisguised;
}

function saveStealthPrefs() {
  try {
    localStorage.setItem(STEALTH_PREF_STORAGE_KEY, JSON.stringify({
      stealthMode: state.stealthMode,
      titleDisguised: state.titleDisguised,
      opacity: state.opacity
    }));
  } catch (error) {
    console.error("Failed to persist stealth prefs:", error);
  }
}

function loadStealthPrefs() {
  try {
    const saved = localStorage.getItem(STEALTH_PREF_STORAGE_KEY);
    if (saved) {
      const prefs = JSON.parse(saved);
      state.stealthMode = !!prefs.stealthMode;
      state.titleDisguised = !!prefs.titleDisguised;
      state.opacity = typeof prefs.opacity === "number" ? prefs.opacity : 1.0;
      updateStealthUI();
    }
  } catch (error) {
    console.error("Failed to load stealth prefs:", error);
  }
}

function togglePanicHide() {
  state.panicHidden = !state.panicHidden;
  updateStealthUI();
}

function toggleCamouflage() {
  state.stealthMode = !state.stealthMode;
  saveStealthPrefs();
  updateStealthUI();
}

function toggleTitleDisguise() {
  state.titleDisguised = !state.titleDisguised;
  saveStealthPrefs();
  updateStealthUI();
}

function handleOpacityChange(e) {
  state.opacity = parseFloat(e.target.value);
  saveStealthPrefs();
  updateStealthUI();
}

function isMicrophonePermissionDenied(error) {
  return error instanceof Error
    && (error.name === "NotAllowedError" || error.name === "PermissionDeniedError");
}

function showMicrophonePermissionHelp(message) {
  showMessage(message);
  if (elements.enableMicrophone) elements.enableMicrophone.hidden = false;
}

async function requestMicrophoneGrant() {
  elements.micGrantAction.hidden = true;
  elements.micGrantStatus.textContent = "Allow microphone access in Chrome's permission prompt.";
  try {
    const microphone = await navigator.mediaDevices.getUserMedia({ audio: true });
    microphone.getTracks().forEach((track) => track.stop());
    state.microphoneGranted = true;
    elements.micGrantStatus.textContent = "Microphone enabled. Return to the side panel to start listening.";
    elements.micGrantAction.textContent = "Close this tab";
  } catch (error) {
    state.microphoneGranted = false;
    elements.micGrantStatus.textContent = isMicrophonePermissionDenied(error)
      ? "Microphone access was not granted. Allow it in Chrome and choose Try again."
      : error instanceof Error
        ? error.message
        : "Could not access a microphone. Connect one and try again.";
    elements.micGrantAction.textContent = "Try again";
  }
  elements.micGrantAction.hidden = false;
}

async function closeMicrophonePermissionTab() {
  try {
    const tab = await chrome.tabs.getCurrent();
    if (typeof tab?.id === "number") {
      await chrome.tabs.remove(tab.id);
      return;
    }
    window.close();
  } catch (error) {
    elements.micGrantStatus.textContent = error instanceof Error
      ? `Microphone is enabled. You can close this tab and return to the side panel. (${error.message})`
      : "Microphone is enabled. You can close this tab and return to the side panel.";
  }
}

function showSettingsMessage(message, kind = "") {
  elements.settingsMessage.textContent = message || "";
  elements.settingsMessage.dataset.kind = kind;
}

function setConnectionSettingsOpen(open) {
  elements.connectionSettings.hidden = !open;
  elements.settingsToggle.setAttribute("aria-expanded", String(open));
}

function updateStep(step, moveFocus = false) {
  const isContext = step === "context";
  document.querySelectorAll(".wizard-step").forEach(el => el.hidden = true);
  if (isContext) elements.contextStep.hidden = false;
  else elements.preferencesStep.hidden = false;

  elements.contextIndicator.classList.toggle("active", isContext);
  elements.preferencesIndicator.classList.toggle("active", !isContext);
  
  if (moveFocus) {
    const heading = isContext
      ? document.querySelector("#context-step h2")
      : document.querySelector("#preferences-step h2");
    heading?.focus();
  }
}

function selectSessionType(type) {
  state.sessionType = type;
  elements.sessionTypeButtons.forEach((button) => {
    const active = button.dataset.sessionType === type;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function populateSelect(select, documents, emptyLabel, multiple = false) {
  const previous = multiple
    ? new Set([...select.selectedOptions].map((option) => option.value))
    : new Set([select.value]);
  select.replaceChildren();

  if (!multiple) {
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = emptyLabel;
    select.append(empty);
  }

  documents.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = `${item.title || "Untitled"}${multiple ? ` · ${item.docType}` : ""}`;
    option.selected = previous.has(item.id);
    select.append(option);
  });
}

async function loadDocuments() {
  if (!state.settings?.apiToken) {
    elements.creditBadge.textContent = "Connect account";
    elements.signedUser.textContent = "Not connected";
    setConnectionSettingsOpen(true);
    return;
  }

  try {
    const result = await PitchPilotExtension.requestJson("/api/extension/context", state.settings);
    state.documents = Array.isArray(result.documents) ? result.documents : [];
    const credits = Number(result.user?.credits);
    elements.creditBadge.textContent = Number.isFinite(credits)
      ? `${credits.toLocaleString()} credits`
      : `${result.user?.plan || "Connected"}`;
    elements.signedUser.textContent = result.user?.email || result.user?.name || "Account connected";
    
    populateSelect(
      elements.resumeSelect,
      state.documents.filter((item) => item.docType === "RESUME"),
      "No CV selected",
    );
    populateSelect(
      elements.documentSelect,
      state.documents.filter((item) => item.docType !== "RESUME"),
      "No saved documents",
      true,
    );
  } catch (error) {
    elements.creditBadge.textContent = "Token issue";
    elements.signedUser.textContent = "Not connected";
    setConnectionSettingsOpen(true);
  }
}

async function importCurrentTab() {
  elements.importTab.disabled = true;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (typeof tab?.id !== "number") throw new Error("No active tab found.");
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => document.body.innerText.slice(0, 5000)
    });
    if (results?.[0]?.result) {
      elements.jobDescription.value = results[0].result;
    }
  } catch (err) {
    console.error("Tab import failed:", err);
  } finally {
    elements.importTab.disabled = false;
  }
}

async function startSession() {
  if (!state.settings?.apiToken) {
    setConnectionSettingsOpen(true);
    return;
  }
  elements.startSession.disabled = true;
  try {
    state.settings = await PitchPilotExtension.saveSettings({
      ...state.settings,
      apiToken: elements.apiToken.value,
      rememberToken: elements.rememberToken.checked,
    });
    document.getElementById("setup-view").hidden = true;
    elements.liveView.hidden = false;
    state.sessionStartedAt = Date.now();
    state.timer = setInterval(updateElapsedTime, 1000);
  } finally {
    elements.startSession.disabled = false;
  }
}

function updateElapsedTime() {
  if (!state.sessionStartedAt) return;
  const seconds = Math.floor((Date.now() - state.sessionStartedAt) / 1000);
  const minutesText = String(Math.floor(seconds / 60)).padStart(2, "0");
  const secondsText = String(seconds % 60).padStart(2, "0");
  elements.elapsedTime.textContent = `${minutesText}:${secondsText}`;
}

async function askCopilot(question) {
  if (!question.trim()) return;
  try {
    const data = await PitchPilotExtension.requestJson("/api/copilot/answer", state.settings, {
      method: "POST",
      body: JSON.stringify({ question: question.trim(), mode: state.sessionType })
    });
    elements.results.textContent = JSON.stringify(data, null, 2);
  } catch (e) {
    elements.results.textContent = `Error: ${e.message}`;
  }
}

async function saveConnectionSettings() {
  elements.saveSettings.disabled = true;
  showSettingsMessage("");
  try {
    state.settings = await PitchPilotExtension.saveSettings({
      ...state.settings,
      apiOrigin: elements.backendOrigin.value,
      apiToken: elements.apiToken.value,
      rememberToken: elements.rememberToken.checked,
    });
    showSettingsMessage("Saved successfully.", "success");
    setConnectionSettingsOpen(false);
    await loadDocuments();
  } catch (error) {
    showSettingsMessage(error instanceof Error ? error.message : "Error saving.", "error");
  } finally {
    elements.saveSettings.disabled = false;
  }
}

async function connectAccount() {
  try {
    state.settings = await PitchPilotExtension.connectAccount(state.settings);
    elements.apiToken.value = state.settings.apiToken;
    showSettingsMessage("Connected successfully.", "success");
    setConnectionSettingsOpen(false);
    await loadDocuments();
  } catch (error) {
    showSettingsMessage(error.message, "error");
  }
}

async function initialize() {
  loadStealthPrefs();
  state.settings = await PitchPilotExtension.loadSettings();
  elements.backendOrigin.value = state.settings.apiOrigin;
  elements.apiToken.value = state.settings.apiToken;
  elements.rememberToken.checked = state.settings.rememberToken;
  
  if (state.settings.apiToken) await loadDocuments();
  else setConnectionSettingsOpen(true);
}

elements.settingsToggle.addEventListener("click", () => setConnectionSettingsOpen(elements.connectionSettings.hidden));
elements.settingsClose.addEventListener("click", () => setConnectionSettingsOpen(false));
elements.saveSettings.addEventListener("click", () => void saveConnectionSettings());
elements.connectAccount.addEventListener("click", () => void connectAccount());
elements.importTab.addEventListener("click", () => void importCurrentTab());
elements.nextStep.addEventListener("click", () => updateStep("preferences", true));
elements.backToContext.addEventListener("click", () => updateStep("context", true));
elements.startSession.addEventListener("click", () => void startSession());
elements.askButton.addEventListener("click", () => void askCopilot(elements.question.value));
elements.panicHideBtn.addEventListener("click", togglePanicHide);
elements.camouflageToggle.addEventListener("click", toggleCamouflage);
elements.stealthOpacity.addEventListener("input", handleOpacityChange);
elements.disguiseTitleToggle.addEventListener("change", toggleTitleDisguise);

void initialize();
