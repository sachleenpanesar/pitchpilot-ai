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

  async function getTokenFromSignedInTab(apiOrigin) {
    const tab = await chrome.tabs.create({
      url: `${apiOrigin}/extension-access`,
      active: false,
    });
    if (typeof tab.id !== "number") {
      throw new Error("Could not open a temporary account tab.");
    }

    try {
      await new Promise((resolve, reject) => {
        let timeoutId;
        const cleanup = () => {
          clearTimeout(timeoutId);
          chrome.tabs.onUpdated.removeListener(onUpdated);
        };
        const onUpdated = (tabId, changeInfo) => {
          if (tabId !== tab.id || changeInfo.status !== "complete") return;
          cleanup();
          resolve();
        };
        timeoutId = setTimeout(() => {
          cleanup();
          reject(new Error("The account page did not finish loading."));
        }, 20000);
        chrome.tabs.onUpdated.addListener(onUpdated);
        void chrome.tabs.get(tab.id).then((currentTab) => {
          if (currentTab.status === "complete") {
            cleanup();
            resolve();
          }
        }, (error) => {
          cleanup();
          reject(error);
        });
      });

      const currentTab = await chrome.tabs.get(tab.id);
      if (!currentTab.url || new URL(currentTab.url).origin !== apiOrigin) {
        throw new Error("The account page navigated away from the configured backend.");
      }

      const [execution] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: "MAIN",
        func: async () => {
          const response = await fetch("/api/extension/token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{}",
            credentials: "include",
          });
          let payload;
          try {
            payload = await response.json();
          } catch {
            return { error: `The account service returned an unreadable response (${response.status}).` };
          }
          return response.ok
            ? payload
            : { error: payload.error || `Account connection failed (${response.status}).` };
        },
      });

      if (!execution?.result || typeof execution.result.token !== "string") {
        throw new Error(
          typeof execution?.result?.error === "string"
            ? execution.result.error
            : "The account page did not return an extension token.",
        );
      }
      return execution.result.token;
    } finally {
      try {
        await chrome.tabs.remove(tab.id);
      } catch (error) {
        console.warn("Could not close the temporary account tab:", error);
      }
    }
  }

  async function connectAccount(settings) {
    const current = settings || await loadSettings();
    const apiOrigin = normalizeApiOrigin(current.apiOrigin);
    await ensureOriginPermission(apiOrigin);

    let response;
    try {
      response = await fetch(`${apiOrigin}/api/extension/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
        credentials: "include",
      });
    } catch {
      throw new Error("Could not reach the account service. Check the backend URL and Chrome origin permission.");
    }

    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new Error(`The account service returned an unreadable response (${response.status}).`);
    }
    let token;
    if (response.status === 401) {
      token = await getTokenFromSignedInTab(apiOrigin);
    } else if (!response.ok) {
      throw new Error(
        typeof payload.error === "string"
          ? payload.error
          : `Automatic account connection failed (${response.status}).`,
      );
    } else {
      token = payload.token;
    }
    if (typeof token !== "string" || !token.trim()) {
      throw new Error("The account service did not return an extension token.");
    }

    return saveSettings({
      ...current,
      apiOrigin,
      apiToken: token,
      rememberToken: current.rememberToken,
    });
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
    connectAccount,
    requestJson,
    openFullSidePanel,
    openAppPage,
    normalizeApiOrigin,
  };
})();
