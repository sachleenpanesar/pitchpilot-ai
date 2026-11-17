"use strict";

const SETTINGS_KEY = "pitchpilotSettings";
const SILENCE_DELAY_MS = 1500;
const SCREEN_SCAN_INTERVAL_MS = 15_000;
const SCREEN_SCAN_QUESTION = "Inspect this screen frame for a visible programming or coding challenge, or an interview question. If a clear question is visible, solve it without inventing missing details. For coding tasks, provide the approach, optimal code in the language shown or requested, and time/space Big-O. For interview questions, provide a concise structured answer. If no question is visible, state that no question was detected.";

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
  resumeSelect: document.getElementById("resume-select"),
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
};

function setStatus(title, detail, status = "idle") {
  elements.statusTitle.textContent = title;
  elements.statusDetail.textContent = detail;
  elements.status.dataset.state = status;
}

function showMessage(message, kind = "error") {
  elements.appMessage.textContent = message || "";
  elements.appMessage.hidden = !message;
  elements.appMessage.dataset.kind = kind;
}

function isMicrophonePermissionDenied(error) {
  return error instanceof Error
    && (error.name === "NotAllowedError" || error.name === "PermissionDeniedError");
}

function showMicrophonePermissionHelp(message) {
  showMessage(message);
  elements.enableMicrophone.hidden = false;
}

async function openMicrophonePermissionTab() {
  elements.enableMicrophone.disabled = true;
  try {
    await chrome.tabs.create({
      url: chrome.runtime.getURL("sidepanel.html?grantMic=1"),
      active: true,
    });
  } catch (error) {
    showMessage(error instanceof Error ? error.message : "Could not open the microphone permission page.");
  } finally {
    elements.enableMicrophone.disabled = false;
  }
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
  elements.connectionSettings.open = open;
  elements.settingsToggle.setAttribute("aria-expanded", String(open));
}

function updateStep(step, moveFocus = false) {
  const isContext = step === "context";
  elements.contextStep.hidden = !isContext;
  elements.preferencesStep.hidden = isContext;
  elements.contextIndicator.classList.toggle("active", isContext);
  elements.preferencesIndicator.classList.toggle("active", !isContext);
  elements.preferencesIndicator.classList.toggle("complete", isContext && state.sessionType);
  if (isContext) {
    elements.contextIndicator.setAttribute("aria-current", "step");
    elements.preferencesIndicator.removeAttribute("aria-current");
  } else {
    elements.contextIndicator.removeAttribute("aria-current");
    elements.preferencesIndicator.setAttribute("aria-current", "step");
  }
  if (moveFocus) {
    const heading = isContext
      ? document.getElementById("context-heading")
      : document.getElementById("preferences-heading");
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
  if (!documents.length && multiple) {
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = emptyLabel;
    empty.disabled = true;
    select.append(empty);
  }
}

async function loadDocuments() {
  if (!state.settings?.apiToken) {
    elements.creditBadge.textContent = "Connect account";
    elements.signedUser.textContent = "Not connected";
    elements.documentsStatus.textContent = "Add an extension token in Settings to load saved documents.";
    setConnectionSettingsOpen(true);
    return;
  }

  elements.documentsStatus.textContent = "Loading saved documents…";
  try {
    const result = await PitchPilotExtension.requestJson("/api/extension/context", state.settings);
    state.documents = Array.isArray(result.documents) ? result.documents : [];
    const credits = Number(result.user?.credits);
    elements.creditBadge.textContent = Number.isFinite(credits)
      ? `${credits.toLocaleString()} credits`
      : `${result.user?.plan || "Connected"}`;
    elements.signedUser.textContent = result.user?.email || result.user?.name || "Account connected";
    elements.signedUser.title = result.user?.email || "";
    populateSelect(
      elements.resumeSelect,
      state.documents.filter((item) => item.docType === "RESUME"),
      "No saved CV / Resume",
    );
    populateSelect(
      elements.documentSelect,
      state.documents.filter((item) => item.docType !== "RESUME"),
      "No saved documents",
      true,
    );
    elements.documentsStatus.textContent = state.documents.length
      ? `${state.documents.length} saved document(s) loaded.`
      : "No saved documents yet. You can continue without them.";
  } catch (error) {
    elements.documentsStatus.textContent = error instanceof Error ? error.message : "Could not load saved documents.";
    elements.creditBadge.textContent = "Account unavailable";
    elements.signedUser.textContent = "Check connection";
    setConnectionSettingsOpen(true);
  }
}

async function importCurrentTab() {
  elements.importTab.disabled = true;
  elements.importTab.textContent = "Importing…";
  showMessage("");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (typeof tab?.id !== "number") throw new Error("Could not find the active tab.");
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const content = document.querySelector("main, article, [role='main']") || document.body;
        return (content?.innerText || "").slice(0, 20_000);
      },
    });
    const extracted = typeof results[0]?.result === "string" ? results[0].result.trim() : "";
    if (!extracted) throw new Error("No readable page text was found in the current tab.");
    elements.jobDescription.value = extracted;
    setStatus("Page text imported", "Review the extracted context before continuing.", "ready");
  } catch (error) {
    showMessage(
      error instanceof Error
        ? `${error.message} Protected or internal Chrome pages cannot be read.`
        : "Could not import text from this tab.",
    );
  } finally {
    elements.importTab.disabled = false;
    elements.importTab.textContent = "Import from Current Tab";
  }
}

async function readBriefFile() {
  const file = elements.briefFile.files?.[0];
  if (!file) return;
  if (file.size > 200_000) {
    showMessage("Brief files must be smaller than 200 KB.");
    elements.briefFile.value = "";
    return;
  }
  try {
    const text = await file.text();
    if (!text.trim()) throw new Error("The selected file is empty.");
    elements.jobDescription.value = text.slice(0, 20_000);
    setStatus("Brief imported", `${file.name} is ready to use as session context.`, "ready");
    showMessage("");
  } catch (error) {
    showMessage(error instanceof Error ? error.message : "Could not read the selected text file.");
  }
}

function beginPreferences() {
  state.jobDescription = elements.jobDescription.value.trim();
  updateStep("preferences", true);
}

function getSelectedDocumentIds() {
  return [
    elements.resumeSelect.value,
    ...[...elements.documentSelect.selectedOptions].map((option) => option.value),
  ].filter(Boolean);
}

async function startSession() {
  if (!state.settings?.apiToken) {
    showMessage("Add an extension token in Connection settings before starting a live session.");
    setConnectionSettingsOpen(true);
    return;
  }
  elements.startSession.disabled = true;
  showMessage("");
  try {
    state.language = elements.languageSelect.value;
    state.answerStyle = elements.answerStyle.value;
    state.sessionId = elements.sessionId.value.trim();
    state.documentIds = [...new Set(getSelectedDocumentIds())];
    state.jobDescription = elements.jobDescription.value.trim();
    state.settings = await PitchPilotExtension.saveSettings({
      ...state.settings,
      apiToken: elements.apiToken.value,
      rememberToken: elements.rememberToken.checked,
      autoAnswer: elements.autoAnswer.checked,
      sessionType: state.sessionType,
      language: state.language,
      answerStyle: state.answerStyle,
      sessionId: state.sessionId,
    });
    elements.setupView.hidden = true;
    elements.liveView.hidden = false;
    elements.liveAutoAnswer.checked = elements.autoAnswer.checked;
    elements.liveSessionType.textContent = `${state.sessionType === "INTERVIEW" ? "INTERVIEW" : "REGULAR MEETING"} SESSION`;
    state.sessionStartedAt = Date.now();
    updateElapsedTime();
    state.timer = setInterval(updateElapsedTime, 1000);
    setStatus("Session ready", "Share a screen, dictate a question, or solve the visible challenge.", "ready");
    elements.results.replaceChildren();
    if (elements.liveAutoAnswer.checked) {
      startScreenScan();
      void startListening();
    }
  } catch (error) {
    showMessage(error instanceof Error ? error.message : "Could not start the session.");
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

function getSessionContext() {
  return [
    `Session type: ${state.sessionType === "INTERVIEW" ? "Interview" : "Regular meeting"}`,
    `Response language: ${state.language}`,
    `Answer style: ${state.answerStyle}`,
    state.jobDescription ? `Job description or meeting brief:\n${state.jobDescription}` : "",
  ].filter(Boolean).join("\n\n");
}

function makeCard(title) {
  const card = document.createElement("article");
  card.className = "card";
  const heading = document.createElement("h3");
  heading.textContent = title;
  const head = document.createElement("div");
  head.className = "card-head";
  head.append(heading);
  card.append(head);
  return { card, head };
}

function addListItem(list, label, text) {
  if (text === undefined || text === null || String(text).trim() === "") return;
  const item = document.createElement("li");
  if (label) {
    const strong = document.createElement("strong");
    strong.textContent = `${label}: `;
    item.append(strong);
  }
  item.append(document.createTextNode(String(text)));
  list.append(item);
}

function renderResult(payload, question) {
  const result = payload && payload.data ? payload.data : payload;
  elements.results.replaceChildren();

  const approach = makeCard("Spoken Approach");
  const bullets = document.createElement("ul");
  bullets.className = "approach-list";
  addListItem(bullets, "Answer", result.summary || result.recognizedQuestion || question);
  const star = result.starAnswer || {};
  addListItem(bullets, "Situation", star.situation);
  addListItem(bullets, "Task", star.task);
  addListItem(bullets, "Action", star.action);
  addListItem(bullets, "Result", star.result);
  if (Array.isArray(result.suggestedPhrases)) {
    result.suggestedPhrases.slice(0, 3).forEach((phrase, index) => {
      addListItem(bullets, `Say it ${index + 1}`, phrase);
    });
  }
  if (!bullets.childElementCount) addListItem(bullets, "", "No spoken approach was returned.");
  approach.card.append(bullets);
  elements.results.append(approach.card);

  const codeSolution = result.codingSolution || {};
  const codeCard = makeCard("Optimal Code");
  if (codeSolution.language) {
    const language = document.createElement("p");
    language.className = "hint";
    language.textContent = String(codeSolution.language);
    codeCard.card.insertBefore(language, codeCard.card.firstChild.nextSibling);
  }
  if (codeSolution.code) {
    const code = document.createElement("pre");
    code.className = "code";
    const codeText = document.createElement("code");
    codeText.textContent = String(codeSolution.code);
    code.append(codeText);
    codeCard.card.append(code);

    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.className = "copy";
    copyButton.textContent = "Copy";
    copyButton.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(String(codeSolution.code));
        copyButton.textContent = "Copied";
      } catch {
        copyButton.textContent = "Copy unavailable";
      }
    });
    codeCard.head.append(copyButton);
  } else {
    const empty = document.createElement("p");
    empty.textContent = "No code was returned for this question.";
    codeCard.card.append(empty);
  }
  elements.results.append(codeCard.card);

  const complexity = makeCard("Time / Space Big-O");
  const details = document.createElement("div");
  details.className = "complexity";
  for (const [label, value] of [
    ["Time", codeSolution.timeComplexity],
    ["Space", codeSolution.spaceComplexity],
  ]) {
    const row = document.createElement("p");
    row.append(document.createTextNode(label));
    const detail = document.createElement("strong");
    detail.textContent = String(value || "Not specified");
    row.append(detail);
    details.append(row);
  }
  complexity.card.append(details);
  elements.results.append(complexity.card);
}

async function askCopilot(question, imageBase64) {
  const trimmedQuestion = question.trim();
  if (!trimmedQuestion) {
    showMessage("Enter or dictate a question first.");
    return false;
  }
  if (state.requestInFlight) {
    if (state.requestQueue.length >= 5) {
      showMessage("The answer queue is full. Wait for a response before continuing.");
      return false;
    }
    state.requestQueue.push({ question: trimmedQuestion, imageBase64 });
    setStatus("Answer queued", `${state.requestQueue.length} question(s) waiting.`, "working");
    return false;
  }

  if (!state.settings?.apiToken) {
    showMessage("Add an extension token in Connection settings before asking for an answer.");
    return false;
  }

  state.requestInFlight = true;
  elements.solveButton.disabled = true;
  elements.askButton.disabled = true;
  setStatus("Thinking", "Sending this prompt to your configured backend.", "working");
  showMessage("");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const response = await fetch(`${state.settings.apiOrigin}/api/copilot/answer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${state.settings.apiToken}`,
      },
      body: JSON.stringify({
        question: trimmedQuestion,
        imageBase64,
        contextText: getSessionContext(),
        documentIds: state.documentIds,
        sessionId: state.sessionId || undefined,
        mode: state.sessionType,
      }),
      credentials: "omit",
      signal: controller.signal,
    });
    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new Error(`The API returned an unreadable response (${response.status}).`);
    }
    if (!response.ok) {
      if (response.status === 401) throw new Error("Your extension token is invalid or expired. Create a new one.");
      if (response.status === 402) throw new Error("Insufficient credits. Upgrade your plan or add credits.");
      if (response.status === 403) throw new Error("The API denied this request. Check the backend URL and account access.");
      throw new Error(typeof payload.error === "string" ? payload.error : `API request failed (${response.status}).`);
    }
    renderResult(payload, trimmedQuestion);
    setStatus("Answer ready", "Review the spoken approach, code, and Big-O below.", "ready");
    return true;
  } catch (error) {
    const message = error && error.name === "AbortError"
      ? "The API request timed out. Check the server and try again."
      : error instanceof Error
        ? error.message
        : "Could not reach the configured backend.";
    showMessage(message);
    setStatus("Connection issue", message, "error");
    return false;
  } finally {
    clearTimeout(timeout);
    state.requestInFlight = false;
    elements.solveButton.disabled = false;
    elements.askButton.disabled = false;
    const next = state.requestQueue.shift();
    if (next) void askCopilot(next.question, next.imageBase64);
  }
}

async function getCaptureTargetTab() {
  if (typeof state.targetTabId === "number") {
    try {
      const target = await chrome.tabs.get(state.targetTabId);
      if (typeof target.windowId === "number") return target;
    } catch {
      state.targetTabId = null;
    }
  }
  const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (typeof activeTab?.windowId !== "number") {
    throw new Error("Could not find the active tab. Open a regular webpage and try again.");
  }
  return activeTab;
}

async function captureScreenFrame() {
  if (state.displayStream?.active) {
    const video = elements.screenPreview;
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth || !video.videoHeight) {
      throw new Error("The shared screen preview is not ready yet. Wait a moment and try again.");
    }
    const scale = Math.min(1, 1280 / video.videoWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not prepare a frame from the shared screen.");
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.78);
  }

  const activeTab = await getCaptureTargetTab();
  const pageUrl = activeTab.url || activeTab.pendingUrl || "";
  const protectedPage = /^(chrome|chrome-extension|chrome-untrusted|devtools|edge|about):/i.test(pageUrl)
    || pageUrl.startsWith("view-source:");
  if (protectedPage) {
    throw new Error("Chrome does not allow screenshots of internal pages such as chrome:// settings. Share your screen or open a regular webpage.");
  }
  return chrome.tabs.captureVisibleTab(activeTab.windowId, { format: "jpeg", quality: 78 });
}

async function solveScreenNow() {
  elements.solveButton.disabled = true;
  try {
    setStatus("Capturing screen", "Capturing the shared screen or active webpage.", "working");
    const imageBase64 = await captureScreenFrame();
    await askCopilot(SCREEN_SCAN_QUESTION, imageBase64);
  } catch (error) {
    const message = error instanceof Error && error.message
      ? error.message
      : "Could not capture the shared screen or active webpage.";
    showMessage(`Screenshot unavailable: ${message}`);
    setStatus("Screen unavailable", "Share your screen or switch to a regular webpage.", "error");
  } finally {
    elements.solveButton.disabled = false;
  }
}

function speechRecognitionConstructor() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function flushSpeechDraft() {
  clearTimeout(state.silenceTimer);
  const spoken = `${state.speechDraft} ${state.interimDraft}`.trim();
  state.speechDraft = "";
  state.interimDraft = "";
  if (!spoken) return;
  elements.question.value = spoken;
  if (elements.liveAutoAnswer.checked) {
    void askCopilot(spoken);
  } else {
    setStatus("Speech ready", "Review the recognized question, then choose Get Answer.", "listening");
  }
}

function stopListening() {
  state.listening = false;
  clearTimeout(state.restartTimer);
  clearTimeout(state.silenceTimer);
  if (state.recognition) {
    state.recognition.onend = null;
    try { state.recognition.stop(); } catch { /* The recognizer may already be stopped. */ }
    state.recognition = null;
  }
  state.speechDraft = "";
  state.interimDraft = "";
  elements.listenButton.textContent = "Start listening";
  setStatus("Listening stopped", "Microphone recognition has been turned off.", "idle");
}

function startRecognition() {
  if (!state.listening) return;
  const Recognition = speechRecognitionConstructor();
  if (!Recognition) {
    stopListening();
    showMessage("Speech recognition is not available in this Chrome version or profile.");
    return;
  }
  const recognition = new Recognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = navigator.language || "en-US";
  recognition.onresult = (event) => {
    let changed = false;
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const transcript = event.results[index][0].transcript.trim();
      if (!transcript) continue;
      changed = true;
      if (event.results[index].isFinal) {
        state.speechDraft = `${state.speechDraft} ${transcript}`.trim();
        state.interimDraft = "";
      } else {
        state.interimDraft = transcript;
      }
    }
    if (!changed) return;
    clearTimeout(state.silenceTimer);
    state.silenceTimer = setTimeout(flushSpeechDraft, SILENCE_DELAY_MS);
    setStatus("Listening", "Speech recognized. Waiting for 1.5 seconds of silence.", "listening");
  };
  recognition.onerror = (event) => {
    if (event?.error === "not-allowed" || event?.error === "service-not-allowed") {
      stopListening();
      showMicrophonePermissionHelp("Microphone access was denied. Enable it in a browser tab, then try again.");
    } else {
      setStatus("Speech recognition issue", `Chrome reported: ${event?.error || "unknown"}.`, "error");
    }
  };
  recognition.onend = () => {
    if (!state.listening) return;
    state.restartTimer = setTimeout(startRecognition, 300);
  };
  state.recognition = recognition;
  try {
    recognition.start();
  } catch {
    state.restartTimer = setTimeout(startRecognition, 600);
  }
}

async function startListening() {
  if (state.listening) return;
  if (!speechRecognitionConstructor()) {
    showMessage("Speech recognition is not available in this Chrome version or profile.");
    return;
  }
  elements.listenButton.disabled = true;
  elements.enableMicrophone.hidden = true;
  try {
    const microphone = await navigator.mediaDevices.getUserMedia({ audio: true });
    microphone.getTracks().forEach((track) => track.stop());
    showMessage("");
    state.listening = true;
    startRecognition();
    elements.listenButton.textContent = "Stop listening";
    setStatus("Listening", "Speech is sent after 1.5 seconds of silence when Auto-Answer is on.", "listening");
  } catch (error) {
    const denied = isMicrophonePermissionDenied(error);
    const message = denied
      ? "Microphone access was denied. Enable it in a browser tab, then try listening again."
      : "Could not start speech recognition. Check microphone access and try again.";
    if (denied) showMicrophonePermissionHelp(message);
    else showMessage(message);
    setStatus("Microphone unavailable", message, "error");
  } finally {
    elements.listenButton.disabled = false;
  }
}

function endSession() {
  stopScreenScan();
  stopListening();
  if (state.timer) clearInterval(state.timer);
  state.timer = null;
  state.sessionStartedAt = 0;
  elements.elapsedTime.textContent = "00:00";
  elements.liveView.hidden = true;
  stopScreenShare(false);
  elements.setupView.hidden = false;
  updateStep("context");
  setStatus("Session ended", "Update the context or prepare another session.", "idle");
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
    elements.backendOrigin.value = state.settings.apiOrigin;
    showSettingsMessage("Settings saved.", "success");
    setConnectionSettingsOpen(!state.settings.apiToken);
    await loadDocuments();
  } catch (error) {
    showSettingsMessage(error instanceof Error ? error.message : "Could not save settings.", "error");
  } finally {
    elements.saveSettings.disabled = false;
  }
}

async function clearToken() {
  try {
    await PitchPilotExtension.clearToken();
    state.settings = await PitchPilotExtension.loadSettings();
    elements.apiToken.value = "";
    elements.rememberToken.checked = false;
    elements.creditBadge.textContent = "Connect account";
    elements.signedUser.textContent = "Not connected";
    showSettingsMessage("Extension token cleared.", "success");
    elements.documentsStatus.textContent = "Add an extension token in Settings to load saved documents.";
    setConnectionSettingsOpen(true);
  } catch {
    showSettingsMessage("Could not clear the extension token.", "error");
  }
}

async function connectAccount() {
  elements.connectAccount.disabled = true;
  showSettingsMessage("Connecting to your signed-in account…");
  try {
    state.settings = await PitchPilotExtension.connectAccount(state.settings);
    elements.apiToken.value = state.settings.apiToken;
    elements.backendOrigin.value = state.settings.apiOrigin;
    elements.rememberToken.checked = state.settings.rememberToken;
    setConnectionSettingsOpen(false);
    showSettingsMessage("Account connected.", "success");
    setStatus("Build your session context", "Add a job description, choose your preferences, then start.", "idle");
    await loadDocuments();
  } catch (error) {
    showSettingsMessage(error instanceof Error ? error.message : "Could not connect your account.", "error");
    setStatus("Connect your account", "Automatic connection failed. Sign in to the backend or use a manual token.", "error");
  } finally {
    elements.connectAccount.disabled = false;
  }
}

async function saveAutoAnswer(enabled) {
  try {
    const stored = await chrome.storage.local.get(SETTINGS_KEY);
    const settings = stored[SETTINGS_KEY] || {};
    settings.autoAnswer = enabled;
    await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
    if (state.settings) state.settings.autoAnswer = enabled;
  } catch {
    showMessage("Could not save the Auto-Answer preference.");
  }
}

function stopScreenScan() {
  if (state.screenScanTimer) clearInterval(state.screenScanTimer);
  state.screenScanTimer = null;
  state.lastScannedFrame = "";
  elements.screenScanStatus.textContent = "Scan Screen for Code / Questions is off.";
}

function startScreenScan() {
  stopScreenScan();
  elements.screenScanStatus.textContent = `Scan Screen for Code / Questions runs every ${SCREEN_SCAN_INTERVAL_MS / 1000} seconds. Frames are sent to your configured backend.`;
  void scanScreenForQuestions();
  state.screenScanTimer = setInterval(() => void scanScreenForQuestions(), SCREEN_SCAN_INTERVAL_MS);
}

async function scanScreenForQuestions(manual = false) {
  if (!manual && !elements.liveAutoAnswer.checked) return;
  if (state.screenScanInFlight || state.requestInFlight) {
    if (manual) showMessage("An answer is already being generated. Try the screen scan again when it finishes.");
    return;
  }
  state.screenScanInFlight = true;
  try {
    const imageBase64 = await captureScreenFrame();
    if (!manual && !elements.liveAutoAnswer.checked) return;
    if (imageBase64 === state.lastScannedFrame) {
      elements.screenScanStatus.textContent = "No screen changes detected since the last scan.";
      return;
    }
    if (state.requestInFlight) return;
    const answered = await askCopilot(SCREEN_SCAN_QUESTION, imageBase64);
    state.lastScannedFrame = answered ? imageBase64 : "";
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not scan the current screen.";
    if (manual) showMessage(message);
    elements.screenScanStatus.textContent = message;
  } finally {
    state.screenScanInFlight = false;
  }
}

function setAutoAnswerEnabled(enabled) {
  elements.autoAnswer.checked = enabled;
  elements.liveAutoAnswer.checked = enabled;
  void saveAutoAnswer(enabled);
  if (elements.liveView.hidden) return;
  if (enabled) {
    startScreenScan();
    if (!state.listening) void startListening();
  } else {
    stopScreenScan();
    stopListening();
  }
}

async function startScreenShare() {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    showMessage("Screen sharing is not available in this Chrome version.");
    return;
  }
  elements.shareScreenButton.disabled = true;
  showMessage("");
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    state.displayStream = stream;
    elements.screenPreview.srcObject = stream;
    elements.screenPreviewPanel.hidden = false;
    elements.screenShareStatus.textContent = stream.getAudioTracks().length
      ? "Screen and available audio are shared."
      : "Screen is shared. This source did not provide audio.";
    elements.shareScreenButton.textContent = "Screen Shared";
    const [videoTrack] = stream.getVideoTracks();
    if (!videoTrack) throw new Error("The selected source did not provide a video track.");
    videoTrack.addEventListener("ended", () => {
      if (state.displayStream === stream) stopScreenShare();
    }, { once: true });
    await elements.screenPreview.play();
    if (elements.liveAutoAnswer.checked) {
      stopScreenScan();
      startScreenScan();
    }
  } catch (error) {
    if (state.displayStream) stopScreenShare();
    const message = error instanceof Error
      ? error.name === "NotAllowedError"
        ? "Screen sharing was canceled or denied."
        : error.message
      : "Could not share the selected screen.";
    showMessage(message);
  } finally {
    elements.shareScreenButton.disabled = false;
  }
}

function stopScreenShare(restartScanner = true) {
  const stream = state.displayStream;
  state.displayStream = null;
  if (stream) stream.getTracks().forEach((track) => track.stop());
  elements.screenPreview.srcObject = null;
  elements.screenPreviewPanel.hidden = true;
  elements.shareScreenButton.textContent = "Share Screen";
  if (restartScanner && elements.liveAutoAnswer.checked && !elements.liveView.hidden) {
    stopScreenScan();
    startScreenScan();
  }
}

async function initialize() {
  if (new URLSearchParams(window.location.search).get("grantMic") === "1") {
    elements.shell.hidden = true;
    elements.micGrantView.hidden = false;
    await requestMicrophoneGrant();
    return;
  }

  try {
    state.settings = await PitchPilotExtension.loadSettings();
    const launchState = await chrome.storage.session.get("pitchpilotTargetTabId");
    state.targetTabId = Number.isInteger(launchState.pitchpilotTargetTabId)
      ? launchState.pitchpilotTargetTabId
      : null;
    elements.backendOrigin.value = state.settings.apiOrigin;
    elements.apiToken.value = state.settings.apiToken;
    elements.rememberToken.checked = state.settings.rememberToken;
    elements.sessionId.value = state.settings.sessionId;
    elements.autoAnswer.checked = state.settings.autoAnswer;
    elements.liveAutoAnswer.checked = state.settings.autoAnswer;
    elements.languageSelect.value = state.settings.language;
    elements.answerStyle.value = state.settings.answerStyle;
    selectSessionType(state.settings.sessionType);
    elements.extensionAccessLink.href = `${state.settings.apiOrigin}/extension-access`;
    elements.supportLink.href = `${state.settings.apiOrigin}/dashboard`;
    elements.upgradeLink.href = `${state.settings.apiOrigin}/pricing`;
    if (!state.settings.apiToken) {
      try {
        state.settings = await PitchPilotExtension.connectAccount(state.settings);
        elements.apiToken.value = state.settings.apiToken;
      } catch (error) {
        setConnectionSettingsOpen(true);
        const detail = error instanceof Error ? error.message : "Automatic connection failed.";
        showSettingsMessage(detail, "error");
        setStatus("Connect your account", "Sign in to the backend or use a manual 30-day token in Settings.", "idle");
      }
    } else {
      setConnectionSettingsOpen(false);
    }
    await loadDocuments();
    if (state.settings.apiToken) {
      setStatus("Build your session context", "Add a job description, choose your preferences, then start.", "idle");
    }
  } catch (error) {
    showMessage(error instanceof Error ? error.message : "Could not load extension settings.");
    setStatus("Settings unavailable", "Check Chrome extension storage access.", "error");
  }
}

elements.settingsToggle.addEventListener("click", () => {
  setConnectionSettingsOpen(!elements.connectionSettings.open);
});
elements.connectionSettings.addEventListener("toggle", () => {
  elements.settingsToggle.setAttribute("aria-expanded", String(elements.connectionSettings.open));
});
elements.extensionAccessLink.addEventListener("click", (event) => {
  event.preventDefault();
  void PitchPilotExtension.openAppPage("/extension-access");
});
elements.supportLink.addEventListener("click", (event) => {
  event.preventDefault();
  void PitchPilotExtension.openAppPage("/dashboard");
});
elements.upgradeLink.addEventListener("click", (event) => {
  event.preventDefault();
  void PitchPilotExtension.openAppPage("/pricing");
});
elements.saveSettings.addEventListener("click", () => void saveConnectionSettings());
elements.clearToken.addEventListener("click", () => void clearToken());
elements.connectAccount.addEventListener("click", () => void connectAccount());
elements.contextIndicator.addEventListener("click", () => updateStep("context", true));
elements.preferencesIndicator.addEventListener("click", () => updateStep("preferences", true));
elements.sessionTypeButtons.forEach((button) => {
  button.addEventListener("click", () => selectSessionType(button.dataset.sessionType));
});
elements.importTab.addEventListener("click", () => void importCurrentTab());
elements.briefFile.addEventListener("change", () => void readBriefFile());
elements.nextStep.addEventListener("click", beginPreferences);
elements.backToContext.addEventListener("click", () => updateStep("context", true));
elements.startSession.addEventListener("click", () => void startSession());
elements.listenButton.addEventListener("click", () => {
  if (state.listening) stopListening();
  else void startListening();
});
elements.enableMicrophone.addEventListener("click", () => void openMicrophonePermissionTab());
elements.micGrantAction.addEventListener("click", () => {
  if (state.microphoneGranted) void closeMicrophonePermissionTab();
  else void requestMicrophoneGrant();
});
elements.solveButton.addEventListener("click", () => void scanScreenForQuestions(true));
elements.shareScreenButton.addEventListener("click", () => void startScreenShare());
elements.stopScreenShare.addEventListener("click", () => stopScreenShare());
elements.askButton.addEventListener("click", () => void askCopilot(elements.question.value));
elements.endSession.addEventListener("click", endSession);
elements.autoAnswer.addEventListener("change", () => setAutoAnswerEnabled(elements.autoAnswer.checked));
elements.liveAutoAnswer.addEventListener("change", () => setAutoAnswerEnabled(elements.liveAutoAnswer.checked));
elements.apiToken.addEventListener("input", () => {
  if (state.settings) state.settings.apiToken = elements.apiToken.value.trim();
});
elements.backendOrigin.addEventListener("input", () => {
  if (state.settings) state.settings.apiOrigin = elements.backendOrigin.value.trim();
});
window.addEventListener("beforeunload", () => {
  stopScreenScan();
  stopListening();
  stopScreenShare(false);
  if (state.timer) clearInterval(state.timer);
});

void initialize();
