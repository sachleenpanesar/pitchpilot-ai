"use strict";

const DEFAULT_API_URL = "http://localhost:3000/api/copilot/answer";
const SETTINGS_KEY = "pitchpilotSettings";
const SILENCE_DELAY_MS = 1500;

const elements = {
  apiUrl: document.getElementById("api-url"),
  sessionId: document.getElementById("session-id"),
  apiToken: document.getElementById("api-token"),
  rememberToken: document.getElementById("remember-token"),
  saveSettings: document.getElementById("save-settings"),
  clearToken: document.getElementById("clear-token"),
  listenButton: document.getElementById("listen-button"),
  solveButton: document.getElementById("solve-button"),
  askButton: document.getElementById("ask-button"),
  question: document.getElementById("question"),
  autoAnswer: document.getElementById("auto-answer"),
  status: document.getElementById("status"),
  statusTitle: document.getElementById("status-title"),
  statusDetail: document.getElementById("status-detail"),
  message: document.getElementById("message"),
  results: document.getElementById("results"),
};

const state = {
  apiUrl: DEFAULT_API_URL,
  sessionId: "",
  token: "",
  listening: false,
  recognition: null,
  shouldRestartRecognition: false,
  requestInFlight: false,
  requestQueue: [],
  restartTimer: null,
  silenceTimer: null,
  speechDraft: "",
  interimDraft: "",
};

function showMessage(text, kind) {
  elements.message.textContent = text || "";
  elements.message.dataset.kind = kind || "";
}

function setStatus(title, detail, status) {
  elements.statusTitle.textContent = title;
  elements.statusDetail.textContent = detail;
  elements.status.dataset.state = status || "idle";
}

function normalizeApiUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Enter a valid backend URL.");
  }
  if (
    parsed.origin !== "http://localhost:3000" ||
    parsed.pathname !== "/api/copilot/answer" ||
    parsed.search ||
    parsed.hash ||
    parsed.username ||
    parsed.password
  ) {
    throw new Error("This extension build can connect only to http://localhost:3000/api/copilot/answer.");
  }
  return parsed.href;
}

async function loadSettings() {
  try {
    await chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
    const stored = await chrome.storage.local.get(SETTINGS_KEY);
    const settings = stored[SETTINGS_KEY] || {};
    state.apiUrl = typeof settings.apiUrl === "string" ? settings.apiUrl : DEFAULT_API_URL;
    state.sessionId = typeof settings.sessionId === "string" ? settings.sessionId : "";
    state.token = typeof settings.apiToken === "string" ? settings.apiToken : "";
    elements.apiUrl.value = state.apiUrl;
    elements.sessionId.value = state.sessionId;
    elements.apiToken.value = state.token;
    elements.rememberToken.checked = Boolean(settings.rememberToken && state.token);
    elements.autoAnswer.checked = Boolean(settings.autoAnswer);
  } catch {
    elements.apiUrl.value = DEFAULT_API_URL;
    showMessage("Could not read extension settings. Check Chrome storage access.", "error");
  }
}

async function saveSettings() {
  elements.saveSettings.disabled = true;
  try {
    state.apiUrl = normalizeApiUrl(elements.apiUrl.value.trim());
    state.sessionId = elements.sessionId.value.trim();
    state.token = elements.apiToken.value.trim();
    if (state.sessionId.length > 128) {
      throw new Error("Session IDs must be 128 characters or fewer.");
    }

    const settings = {
      apiUrl: state.apiUrl,
      sessionId: state.sessionId,
      rememberToken: elements.rememberToken.checked && Boolean(state.token),
      autoAnswer: elements.autoAnswer.checked,
    };
    if (settings.rememberToken) settings.apiToken = state.token;
    await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
    showMessage(
      settings.rememberToken
        ? "Settings saved. The bearer token is stored in this Chrome profile."
        : "Settings saved. The bearer token remains only in this panel session.",
      "success",
    );
  } catch (error) {
    showMessage(error instanceof Error ? error.message : "Could not save settings.", "error");
  } finally {
    elements.saveSettings.disabled = false;
  }
}

async function clearToken() {
  state.token = "";
  elements.apiToken.value = "";
  elements.rememberToken.checked = false;
  try {
    const stored = await chrome.storage.local.get(SETTINGS_KEY);
    const settings = stored[SETTINGS_KEY] || { apiUrl: state.apiUrl, sessionId: state.sessionId };
    delete settings.apiToken;
    settings.rememberToken = false;
    await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
    showMessage("Saved bearer token cleared from extension storage and this panel.", "success");
  } catch {
    showMessage("Could not clear the saved token from Chrome storage.", "error");
  }
}

function makeCard(title) {
  const card = document.createElement("article");
  card.className = "card";
  const heading = document.createElement("h2");
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
    copyButton.setAttribute("aria-label", "Copy optimal code");
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
  const time = document.createElement("p");
  time.append(document.createTextNode("Time"));
  const timeValue = document.createElement("strong");
  timeValue.textContent = String(codeSolution.timeComplexity || "Not specified");
  time.append(timeValue);
  const space = document.createElement("p");
  space.append(document.createTextNode("Space"));
  const spaceValue = document.createElement("strong");
  spaceValue.textContent = String(codeSolution.spaceComplexity || "Not specified");
  space.append(spaceValue);
  details.append(time, space);
  complexity.card.append(details);
  elements.results.append(complexity.card);
}

async function askCopilot(question, imageBase64) {
  if (state.requestInFlight) {
    if (state.requestQueue.length >= 10) {
      showMessage("The answer queue is full. Wait for a response before continuing.", "error");
      return;
    }
    state.requestQueue.push({ question, imageBase64 });
    setStatus("Answer queued", `${state.requestQueue.length} question(s) waiting.`, "working");
    return;
  }

  let apiUrl;
  try {
    apiUrl = normalizeApiUrl(state.apiUrl);
  } catch (error) {
    showMessage(error instanceof Error ? error.message : "Check the backend URL.", "error");
    return;
  }
  if (!state.token) {
    showMessage("Create a one-hour token at /extension-access, then paste it in Connection settings.", "error");
    return;
  }
  if (!question.trim()) {
    showMessage("Enter or dictate a question first.", "error");
    return;
  }

  state.requestInFlight = true;
  elements.solveButton.disabled = true;
  elements.askButton.disabled = true;
  setStatus("Thinking", "Sending the prompt to your configured backend.", "working");
  showMessage("");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${state.token}`,
      },
      body: JSON.stringify({
        question: question.trim(),
        imageBase64,
        sessionId: state.sessionId || undefined,
        mode: "COPILOT",
      }),
      signal: controller.signal,
      credentials: "omit",
    });
    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new Error(`The API returned an unreadable response (${response.status}).`);
    }
    if (!response.ok) {
      if (response.status === 401) throw new Error("Sign-in required: check the bearer token and its expiry.");
      if (response.status === 403) throw new Error("The API denied this request. Check the token and account access.");
      throw new Error(typeof payload.error === "string" ? payload.error : `API request failed (${response.status}).`);
    }
    renderResult(payload, question);
    setStatus("Answer ready", "Review the spoken approach, code, and Big-O below.", "ready");
  } catch (error) {
    const message = error && error.name === "AbortError"
      ? "The API request timed out. Check the server and try again."
      : error instanceof Error
        ? error.message
        : "Could not reach the configured backend.";
    showMessage(message, "error");
    setStatus("Connection issue", message, "error");
  } finally {
    clearTimeout(timeout);
    state.requestInFlight = false;
    elements.solveButton.disabled = false;
    elements.askButton.disabled = false;
    const nextRequest = state.requestQueue.shift();
    if (nextRequest) void askCopilot(nextRequest.question, nextRequest.imageBase64);
  }
}

async function solveCurrentTab() {
  elements.solveButton.disabled = true;
  try {
    setStatus("Capturing tab", "Chrome will capture the visible portion of the active tab.", "working");
    const imageBase64 = await chrome.tabs.captureVisibleTab(undefined, { format: "png" });
    await askCopilot(
      "Analyze the visible page or coding problem and provide a concise approach and solution.",
      imageBase64,
    );
  } catch (error) {
    const message = error instanceof Error && error.message
      ? error.message
      : "Could not capture this tab. Try a regular web page.";
    showMessage(`Screenshot unavailable: ${message}`, "error");
    setStatus("Capture unavailable", "Chrome may block screenshots on protected or internal pages.", "error");
  } finally {
    elements.solveButton.disabled = false;
  }
}

function getSpeechRecognitionConstructor() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function flushSpeechDraft() {
  clearTimeout(state.silenceTimer);
  const spokenQuestion = `${state.speechDraft} ${state.interimDraft}`.trim();
  state.speechDraft = "";
  state.interimDraft = "";
  if (!spokenQuestion) return;

  if (document.activeElement !== elements.question) {
    elements.question.value = spokenQuestion;
  }
  if (elements.autoAnswer.checked) {
    void askCopilot(spokenQuestion);
  } else {
    setStatus("Speech ready", "Review the recognized question, then choose Answer question.", "listening");
  }
}

function stopListening() {
  state.shouldRestartRecognition = false;
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

async function startListening() {
  const Recognition = getSpeechRecognitionConstructor();
  if (!Recognition) {
    showMessage("Speech recognition is not available in this Chrome version or profile.", "error");
    return;
  }
  elements.listenButton.disabled = true;
  try {
    const microphone = await navigator.mediaDevices.getUserMedia({ audio: true });
    microphone.getTracks().forEach((track) => track.stop());

    state.shouldRestartRecognition = true;
    state.listening = true;
    startRecognitionInstance(Recognition);
    elements.listenButton.textContent = "Stop listening";
    setStatus("Listening", "Speech is sent after 1.5 seconds of silence when Auto-Answer is on.", "listening");
  } catch (error) {
    const message = error instanceof Error && error.name === "NotAllowedError"
      ? "Microphone access was denied. Allow it in Chrome settings and try again."
      : "Could not start speech recognition. Check microphone access and try again.";
    showMessage(message, "error");
    setStatus("Microphone unavailable", message, "error");
    state.shouldRestartRecognition = false;
    state.listening = false;
    state.recognition = null;
    elements.listenButton.textContent = "Start listening";
  } finally {
    elements.listenButton.disabled = false;
  }
}

function startRecognitionInstance(Recognition) {
  if (!state.shouldRestartRecognition) return;
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
    const errorCode = event && event.error ? event.error : "unknown";
    if (errorCode === "not-allowed" || errorCode === "service-not-allowed") {
      state.shouldRestartRecognition = false;
      state.listening = false;
      elements.listenButton.textContent = "Start listening";
      setStatus("Microphone permission needed", "Allow microphone access in Chrome settings, then try again.", "error");
    } else {
      setStatus("Speech recognition issue", `Chrome reported: ${errorCode}. Recognition may resume automatically.`, "error");
    }
  };
  recognition.onend = () => {
    if (!state.shouldRestartRecognition) return;
    state.restartTimer = setTimeout(() => {
      if (!state.shouldRestartRecognition) return;
      const Constructor = getSpeechRecognitionConstructor();
      if (!Constructor) {
        stopListening();
        return;
      }
      try {
        startRecognitionInstance(Constructor);
      } catch {
        state.restartTimer = setTimeout(() => {
          if (!state.shouldRestartRecognition) return;
          try {
            startRecognitionInstance(Constructor);
          } catch {
            state.shouldRestartRecognition = false;
            state.listening = false;
            elements.listenButton.textContent = "Start listening";
            setStatus("Speech recognition stopped", "Could not restart recognition. Start listening again when ready.", "error");
          }
        }, 700);
      }
    }, 250);
  };
  state.recognition = recognition;
  recognition.start();
}

elements.saveSettings.addEventListener("click", () => void saveSettings());
elements.clearToken.addEventListener("click", () => void clearToken());
elements.solveButton.addEventListener("click", () => void solveCurrentTab());
elements.askButton.addEventListener("click", () => void askCopilot(elements.question.value));
elements.listenButton.addEventListener("click", () => {
  if (state.listening) stopListening();
  else void startListening();
});
elements.sessionId.addEventListener("input", () => {
  state.sessionId = elements.sessionId.value.trim();
});
elements.apiUrl.addEventListener("input", () => {
  state.apiUrl = elements.apiUrl.value.trim();
});
elements.apiToken.addEventListener("input", () => {
  state.token = elements.apiToken.value.trim();
});
elements.autoAnswer.addEventListener("change", async () => {
  if (!elements.autoAnswer.checked) state.requestQueue = [];
  try {
    const stored = await chrome.storage.local.get(SETTINGS_KEY);
    const settings = stored[SETTINGS_KEY] || { apiUrl: state.apiUrl, sessionId: state.sessionId };
    settings.autoAnswer = elements.autoAnswer.checked;
    await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
  } catch {
    showMessage("Could not save the Auto-Answer setting.", "error");
  }
});

void loadSettings();
