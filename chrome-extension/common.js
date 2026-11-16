"use strict";

(() => {
  const DEFAULT_API_ORIGIN = "https://pitchpilot-ai-ruddy.vercel.app";
  const SETTINGS_KEY = "pitchpilotSettings";
  const SESSION_TOKEN_KEY = "pitchpilotSessionToken";

  function normalizeApiOrigin(value) {
    let url;
    try {
      url = new URL(value.trim());
    } catch {
      throw new Error("Enter a valid backend origin.");
    }

    const isLocalHttp = url.protocol === "http:" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1");
    if (
      (url.protocol !== "https:" && !isLocalHttp) ||
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      url.username ||
      url.password
    ) {
      throw new Error("Use an HTTPS backend origin, or HTTP localhost for development.");
    }
    return url.origin;
  }

  function originPermissionPattern(origin) {
    const url = new URL(origin);
    return `${url.protocol}//${url.hostname}/*`;
  }

  async function ensureOriginPermission(origin) {
    const pattern = originPermissionPattern(origin);
    const alreadyGranted = await chrome.permissions.contains({ origins: [pattern] });
    if (alreadyGranted) return;
    const granted = await chrome.permissions.request({ origins: [pattern] });
    if (!granted) {
      throw new Error("Chrome needs permission to connect to this backend.");
    }
  }

  async function loadSettings() {
    await chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
    await chrome.storage.session.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
    const [stored, session] = await Promise.all([
      chrome.storage.local.get(SETTINGS_KEY),
      chrome.storage.session.get(SESSION_TOKEN_KEY),
    ]);
    const settings = stored[SETTINGS_KEY] || {};
    return {
      apiOrigin: normalizeApiOrigin(
        typeof settings.apiOrigin === "string" ? settings.apiOrigin : DEFAULT_API_ORIGIN,
      ),
      sessionId: typeof settings.sessionId === "string" ? settings.sessionId : "",
      autoAnswer: Boolean(settings.autoAnswer),
      sessionType: settings.sessionType === "MEETING" ? "MEETING" : "INTERVIEW",
      language: typeof settings.language === "string" ? settings.language : "English",
      answerStyle: typeof settings.answerStyle === "string" ? settings.answerStyle : "Concise",
      rememberToken: Boolean(settings.rememberToken),
      apiToken: typeof settings.apiToken === "string"
        ? settings.apiToken
        : typeof session[SESSION_TOKEN_KEY] === "string"
          ? session[SESSION_TOKEN_KEY]
          : "",
    };
  }

  async function saveSettings(values) {
    const apiOrigin = normalizeApiOrigin(values.apiOrigin);
    await ensureOriginPermission(apiOrigin);

    const [stored, session] = await Promise.all([
      chrome.storage.local.get(SETTINGS_KEY),
      chrome.storage.session.get(SESSION_TOKEN_KEY),
    ]);
    const previous = stored[SETTINGS_KEY] || {};
    const token = typeof values.apiToken === "string"
      ? values.apiToken.trim()
      : previous.apiToken || session[SESSION_TOKEN_KEY] || "";
    const settings = {
      apiOrigin,
      sessionId: typeof values.sessionId === "string" ? values.sessionId.trim() : previous.sessionId || "",
      autoAnswer: typeof values.autoAnswer === "boolean" ? values.autoAnswer : Boolean(previous.autoAnswer),
      sessionType: values.sessionType === "MEETING" ? "MEETING" : previous.sessionType || "INTERVIEW",
      language: typeof values.language === "string" ? values.language : previous.language || "English",
      answerStyle: typeof values.answerStyle === "string" ? values.answerStyle : previous.answerStyle || "Concise",
      rememberToken: Boolean(values.rememberToken),
    };

    if (settings.rememberToken && token) {
      settings.apiToken = token;
      await chrome.storage.session.remove(SESSION_TOKEN_KEY);
    } else {
      delete settings.apiToken;
      if (token) {
        await chrome.storage.session.set({ [SESSION_TOKEN_KEY]: token });
      } else {
        await chrome.storage.session.remove(SESSION_TOKEN_KEY);
      }
    }
    await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
    return { ...settings, apiToken: token };
  }

  async function clearToken() {
    const stored = await chrome.storage.local.get(SETTINGS_KEY);
    const settings = stored[SETTINGS_KEY] || {};
    delete settings.apiToken;
    settings.rememberToken = false;
    await Promise.all([
      chrome.storage.local.set({ [SETTINGS_KEY]: settings }),
      chrome.storage.session.remove(SESSION_TOKEN_KEY),
    ]);
  }

  async function requestJson(path, settings, options = {}) {
    if (!settings.apiToken) {
      throw new Error("Add an extension token in Settings. You can create one from Extension Access.");
    }
    const response = await fetch(`${settings.apiOrigin}${path}`, {
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        Authorization: `Bearer ${settings.apiToken}`,
        ...(options.headers || {}),
      },
      credentials: "omit",
    });
    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new Error(`The backend returned an unreadable response (${response.status}).`);
    }
    if (!response.ok) {
      if (response.status === 401) throw new Error("Your extension token is invalid or expired. Create a new one.");
      throw new Error(typeof payload.error === "string" ? payload.error : `Backend request failed (${response.status}).`);
    }
    return payload;
  }

  async function openFullSidePanel() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (typeof tab?.windowId !== "number") {
      throw new Error("Could not find the active Chrome window.");
    }
    await chrome.sidePanel.open({ windowId: tab.windowId });
  }

  async function openAppPage(path) {
    const settings = await loadSettings();
    await chrome.tabs.create({ url: `${settings.apiOrigin}${path}` });
  }

  globalThis.PitchPilotExtension = {
    DEFAULT_API_ORIGIN,
    loadSettings,
    saveSettings,
    clearToken,
    requestJson,
    openFullSidePanel,
    openAppPage,
    normalizeApiOrigin,
  };
})();
