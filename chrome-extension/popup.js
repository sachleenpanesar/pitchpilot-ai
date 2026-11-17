"use strict";

const DEFAULT_API_ORIGIN = "https://pitchpilot-ai-ruddy.vercel.app";
const STEALTH_BRIDGE_BASE = "http://127.0.0.1:4789";

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

  stepItems: document.querySelectorAll(".step-item"),
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
  listenToggle: document.getElementById("listen-toggle-btn") || Array.from(document.querySelectorAll("button")).find((b) => b.textContent.includes("Start Listening")),
  solveScreen: document.getElementById("solve-screen-btn"),
  aiResponse: document.getElementById("ai-response-container"),
  liveStatusText: document.getElementById("live-status-text"),
};

let currentSession = { type: "INTERVIEW", sessionId: "", step: "context" };
let isListening = false;
let recognition = null;
let silenceTimer = null;

function setPanelVisible(el, visible) {
  if (!el) return;
  el.hidden = !visible;
  if (visible) {
    el.style.removeProperty("display");
  } else {
    el.style.setProperty("display", "none", "important");
  }
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function syncContextToStealthHUD() {
  try {
    const settings = await PitchPilotExtension.loadSettings();
    const activeOrigin = (settings.apiOrigin || DEFAULT_API_ORIGIN).trim().replace(/\/+$/, "");
    const selectedDocIds = Array.from(elements.documentSelect?.selectedOptions || []).map((o) => o.value);

    await fetch(`${STEALTH_BRIDGE_BASE}/sync-context`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiOrigin: activeOrigin,
        apiToken: settings.apiToken || "",
        mode: currentSession.type,
        contextText: elements.jobDescription?.value || "",
        documentIds: selectedDocIds,
      }),
    });
  } catch {
    // Stealth HUD not currently open
  }
}

async function pushToStealthHUD(questionText, renderedHtml) {
  try {
    await fetch(`${STEALTH_BRIDGE_BASE}/push-prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: questionText,
        html: renderedHtml,
      }),
    });
  } catch {
    // Stealth HUD not currently open
  }
}

function setLiveStatus(text) {
  if (elements.liveStatusText) {
    elements.liveStatusText.textContent = text;
  }
}

function showSettingsMessage(message, kind = "") {
  if (!elements.settingsMessage) return;
  elements.settingsMessage.textContent = message;
  elements.settingsMessage.dataset.kind = kind;
}

function updateStealthUI() {
  const isVsCode = localStorage.getItem("pp-theme") === "vscode";
  document.body.classList.toggle("vscode-theme", isVsCode);

  if (elements.opacitySlider && elements.opacityValue) {
    document.body.style.opacity = elements.opacitySlider.value;
    elements.opacityValue.textContent = `${Math.round(elements.opacitySlider.value * 100)}%`;
  }

  if (elements.titleDisguise) {
    document.title = elements.titleDisguise.checked
      ? "README.md - Visual Studio Code"
      : "PitchPilot Stealth Copilot";
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

function navigateStep(stepName) {
  currentSession.step = stepName;
  elements.stepItems.forEach((item) => {
    const s = item.dataset.step;
    if (s === stepName || (stepName === "copilot" && s === "preferences")) {
      item.classList.add("active");
    } else {
      item.classList.remove("active");
    }
  });

  if (stepName === "copilot") {
    setPanelVisible(elements.setupPanel, false);
    setPanelVisible(elements.livePanel, true);
  } else {
    setPanelVisible(elements.setupPanel, true);
    setPanelVisible(elements.livePanel, false);
  }
}

async function loadPopup() {
  try {
    const settings = await PitchPilotExtension.loadSettings();
    const activeOrigin = (settings.apiOrigin || DEFAULT_API_ORIGIN).trim().replace(/\/+$/, "");

    if (elements.backendOrigin) elements.backendOrigin.value = activeOrigin;
    if (elements.extensionToken) elements.extensionToken.value = settings.apiToken || "";
    if (elements.rememberToken) elements.rememberToken.checked = Boolean(settings.rememberToken);
    if (elements.upgradeLink) elements.upgradeLink.href = `${activeOrigin}/pricing`;
    if (elements.supportLink) elements.supportLink.href = `${activeOrigin}/dashboard`;
    if (elements.manualTokenLink) elements.manualTokenLink.href = `${activeOrigin}/extension-access`;
    if (elements.autoAnswer) elements.autoAnswer.checked = Boolean(settings.autoAnswer);

    if (settings.apiToken) {
      setPanelVisible(elements.settingsPanel, false);
      try {
        const payload = await PitchPilotExtension.requestJson("/api/extension/context", {
          ...settings,
          apiOrigin: activeOrigin,
        });
        const credits = Number(payload.user?.credits);
        if (elements.creditBadge) {
          elements.creditBadge.textContent = Number.isFinite(credits)
            ? `${credits.toLocaleString()} credits`
            : "Active";
        }

        if (elements.documentSelect) {
          elements.documentSelect.innerHTML = (payload.documents || [])
            .map((d) => `<option value="${escapeHtml(d.id)}">${escapeHtml(d.title)} (${escapeHtml(d.docType)})</option>`)
            .join("");
        }
        await syncContextToStealthHUD();
      } catch (err) {
        console.warn("Context fetch warning:", err);
        if (elements.creditBadge) elements.creditBadge.textContent = "Token issue";
      }
    } else {
      if (elements.creditBadge) elements.creditBadge.textContent = "Connect token";
    }
  } catch (err) {
    console.error("Popup load failed:", err);
  }
}

elements.settingsToggle?.addEventListener("click", () => {
  const isCurrentlyOpen = !elements.settingsPanel.hidden && elements.settingsPanel.style.display !== "none";
  setPanelVisible(elements.settingsPanel, !isCurrentlyOpen);
  elements.settingsToggle.setAttribute("aria-expanded", String(!isCurrentlyOpen));
});

elements.settingsClose?.addEventListener("click", () => {
  setPanelVisible(elements.settingsPanel, false);
  elements.settingsToggle?.setAttribute("aria-expanded", "false");
});

elements.saveSettings?.addEventListener("click", async () => {
  try {
    const cleanOrigin = (elements.backendOrigin?.value || DEFAULT_API_ORIGIN).trim().replace(/\/+$/, "");
    if (elements.backendOrigin) elements.backendOrigin.value = cleanOrigin;

    await PitchPilotExtension.saveSettings({
      apiOrigin: cleanOrigin,
      apiToken: elements.extensionToken?.value.trim() || "",
      rememberToken: Boolean(elements.rememberToken?.checked),
      autoAnswer: Boolean(elements.autoAnswer?.checked),
    });
    showSettingsMessage("Saved successfully.", "success");
    setPanelVisible(elements.settingsPanel, false);
    elements.settingsToggle?.setAttribute("aria-expanded", "false");
    await loadPopup();
    await syncContextToStealthHUD();
  } catch (e) {
    showSettingsMessage(e.message, "error");
  }
});

elements.panicBtn?.addEventListener("click", togglePanic);

elements.themeBtn?.addEventListener("click", () => {
  const isVsCode = localStorage.getItem("pp-theme") === "vscode";
  localStorage.setItem("pp-theme", isVsCode ? "default" : "vscode");
  updateStealthUI();
});

elements.opacitySlider?.addEventListener("input", updateStealthUI);
elements.titleDisguise?.addEventListener("change", updateStealthUI);

elements.stepItems.forEach((item) => {
  item.addEventListener("click", () => {
    const step = item.dataset.step;
    if (step === "context" || step === "preferences") {
      navigateStep("context");
    } else if (step === "copilot") {
      syncContextToStealthHUD();
      navigateStep("copilot");
    }
  });
});

elements.sessionTypeTabs.forEach((btn) =>
  btn.addEventListener("click", (e) => {
    elements.sessionTypeTabs.forEach((t) => t.classList.remove("active"));
    e.currentTarget.classList.add("active");
    currentSession.type = e.currentTarget.dataset.sessionType;
    syncContextToStealthHUD();
  })
);

elements.importTab?.addEventListener("click", async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("No active tab found.");
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => document.body.innerText.slice(0, 5000),
    });
    if (results?.[0]?.result) {
      elements.jobDescription.value = results[0].result;
      await syncContextToStealthHUD();
    }
  } catch (err) {
    console.error("Tab import failed:", err);
    elements.jobDescription.value = "Failed to import tab text. Paste context manually.";
  }
});

elements.startSession?.addEventListener("click", async () => {
  await syncContextToStealthHUD();
  navigateStep("copilot");
  setLiveStatus("Synced to Stealth HUD! Close this popup & use HUD.");
});

elements.backToSetup?.addEventListener("click", () => {
  navigateStep("context");
});

async function triggerAiQuery(promptText) {
  if (!promptText.trim()) return;
  const loadingHtml = '<div class="placeholder-result">AI copilot is generating prompt solution…</div>';
  elements.aiResponse.innerHTML = loadingHtml;
  pushToStealthHUD(promptText, loadingHtml);

  const settings = await PitchPilotExtension.loadSettings();
  const activeOrigin = (settings.apiOrigin || DEFAULT_API_ORIGIN).trim().replace(/\/+$/, "");
  const selectedDocIds = Array.from(elements.documentSelect?.selectedOptions || []).map((o) => o.value);

  try {
    const res = await PitchPilotExtension.requestJson(
      "/api/copilot/answer",
      { ...settings, apiOrigin: activeOrigin },
      {
        method: "POST",
        body: JSON.stringify({
          question: promptText,
          mode: currentSession.type,
          contextText: elements.jobDescription?.value || "",
          documentIds: selectedDocIds,
          sessionId: currentSession.sessionId,
        }),
      }
    );

    const data = res.data;
    if (!data) throw new Error("No response data received from AI.");

    let html = `<div style="font-weight:700; margin-bottom:6px; color:#38bdf8;">💡 Overview / Summary</div>
    <div style="margin-bottom:10px;">${escapeHtml(data.summary || "")}</div>`;

    if (data.starAnswer && (data.starAnswer.situation || data.starAnswer.task)) {
      html += `<div style="font-weight:700; margin-bottom:4px; color:#4ade80;">⭐ STAR Story Framework</div>
      <ul style="margin-left:16px; margin-bottom:10px; display:grid; gap:4px;">
        <li><strong>Situation:</strong> ${escapeHtml(data.starAnswer.situation)}</li>
        <li><strong>Task:</strong> ${escapeHtml(data.starAnswer.task)}</li>
        <li><strong>Action:</strong> ${escapeHtml(data.starAnswer.action)}</li>
        <li><strong>Result:</strong> ${escapeHtml(data.starAnswer.result)}</li>
      </ul>`;
    }

    if (data.codingSolution && data.codingSolution.code) {
      html += `<div style="font-weight:700; margin-bottom:4px;">💻 Code Solution (${escapeHtml(data.codingSolution.language || "code")})</div>
      <pre style="background:rgba(15,23,42,0.9); padding:8px; border-radius:6px; overflow-x:auto; margin-bottom:8px; font-family:monospace; font-size:11px;"><code>${escapeHtml(data.codingSolution.code)}</code></pre>
      <div style="font-size:11px; color:#94a3b8; margin-bottom:10px;">Time: ${escapeHtml(data.codingSolution.timeComplexity || "O(n)")} | Space: ${escapeHtml(data.codingSolution.spaceComplexity || "O(1)")}</div>`;
    }

    if (data.suggestedPhrases && data.suggestedPhrases.length > 0) {
      html += `<div style="font-weight:700; margin-bottom:4px;">💬 Suggested Speaking Points</div>
      <ul style="margin-left:16px; display:grid; gap:2px; font-size:11px;">
        ${data.suggestedPhrases.map((p) => `<li>"${escapeHtml(p)}"</li>`).join("")}
      </ul>`;
    }

    elements.aiResponse.innerHTML = html;
    await pushToStealthHUD(promptText, html);
  } catch (e) {
    const errHtml = `<div style="color:#f87171;">Error: ${escapeHtml(e.message)}</div>`;
    elements.aiResponse.innerHTML = errHtml;
    await pushToStealthHUD(promptText, errHtml);
  }
}

elements.askBtn?.addEventListener("click", () => {
  triggerAiQuery(elements.questionInput.value);
});

elements.questionInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
    triggerAiQuery(elements.questionInput.value);
  }
});

function toggleListening() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    setLiveStatus("Use Start Listening inside the Stealth HUD window.");
    return;
  }

  if (isListening) {
    isListening = false;
    if (recognition) {
      try {
        recognition.stop();
      } catch {}
    }
    if (elements.listenToggle) elements.listenToggle.textContent = "🎤 Start Listening";
    setLiveStatus("Live Copilot Active (Paused)");
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = "en-US";

  recognition.onstart = () => {
    isListening = true;
    if (elements.listenToggle) elements.listenToggle.textContent = "⏹ Stop Listening";
    setLiveStatus("Listening… (Use Stealth HUD so closing popup won't stop)");
  };

  recognition.onresult = (event) => {
    let transcript = "";
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      transcript += event.results[i][0].transcript;
    }
    if (elements.questionInput) {
      elements.questionInput.value = transcript.trim();
    }

    if (elements.autoAnswer?.checked && event.results[event.results.length - 1].isFinal) {
      if (silenceTimer) clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => {
        if (elements.questionInput?.value.trim()) {
          triggerAiQuery(elements.questionInput.value);
        }
      }, 1500);
    }
  };

  recognition.onerror = (event) => {
    if (event.error !== "no-speech") {
      setLiveStatus(`Use Stealth HUD mic (${event.error})`);
    }
  };

  recognition.onend = () => {
    if (isListening) {
      try {
        recognition.start();
      } catch {}
    }
  };

  try {
    recognition.start();
  } catch {
    setLiveStatus("Use Start Listening inside the Stealth HUD window.");
  }
}

elements.listenToggle?.addEventListener("click", toggleListening);

elements.solveScreen?.addEventListener("click", async () => {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: { mediaSource: "screen" } });
    const track = stream.getVideoTracks()[0];
    const imageCapture = new ImageCapture(track);
    const bitmap = await imageCapture.grabFrame();
    track.stop();

    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0);
    const imageBase64 = canvas.toDataURL("image/png");

    elements.questionInput.value = "Analyze the shared screen code or meeting question.";
    await triggerAiQueryWithScreenshot("Analyze the shared screen code or meeting question.", imageBase64);
  } catch (err) {
    console.error("Screen capture failed:", err);
  }
});

async function triggerAiQueryWithScreenshot(promptText, imageBase64) {
  const loadingHtml = '<div class="placeholder-result">Scanning screen and solving with AI…</div>';
  elements.aiResponse.innerHTML = loadingHtml;
  pushToStealthHUD(promptText, loadingHtml);

  const settings = await PitchPilotExtension.loadSettings();
  const activeOrigin = (settings.apiOrigin || DEFAULT_API_ORIGIN).trim().replace(/\/+$/, "");
  const selectedDocIds = Array.from(elements.documentSelect?.selectedOptions || []).map((o) => o.value);

  try {
    const res = await PitchPilotExtension.requestJson(
      "/api/copilot/answer",
      { ...settings, apiOrigin: activeOrigin },
      {
        method: "POST",
        body: JSON.stringify({
          question: promptText,
          imageBase64,
          mode: currentSession.type,
          contextText: elements.jobDescription?.value || "",
          documentIds: selectedDocIds,
          sessionId: currentSession.sessionId,
        }),
      }
    );

    const data = res.data;
    if (!data) throw new Error("No response data received from AI.");
    const html = `<div style="font-weight:700; margin-bottom:6px; color:#38bdf8;">📸 Screen Scan Analysis</div>
    <div style="margin-bottom:10px;">${escapeHtml(data.summary || "")}</div>`;

    elements.aiResponse.innerHTML = html;
    await pushToStealthHUD(promptText, html);
  } catch (e) {
    const errHtml = `<div style="color:#f87171;">Error: ${escapeHtml(e.message)}</div>`;
    elements.aiResponse.innerHTML = errHtml;
    await pushToStealthHUD(promptText, errHtml);
  }
}

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" || (e.ctrlKey && e.shiftKey && e.key === "H")) {
    togglePanic();
  }
});

elements.connectAccount?.addEventListener("click", async () => {
  try {
    await PitchPilotExtension.connectAccount();
    setPanelVisible(elements.settingsPanel, false);
    await loadPopup();
    await syncContextToStealthHUD();
    showSettingsMessage("Connected successfully.", "success");
  } catch (e) {
    showSettingsMessage(e.message, "error");
  }
});

setPanelVisible(elements.settingsPanel, false);
navigateStep("context");
loadPopup();
updateStealthUI();
