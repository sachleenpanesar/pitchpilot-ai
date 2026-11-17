"use strict";

const COPILOT_WINDOW_WIDTH = 940;
const COPILOT_WINDOW_HEIGHT = 660;
const TARGET_TAB_STORAGE_KEY = "pitchpilotTargetTabId";

async function getCenteredCoordinates(width, height) {
  try {
    const currentWindow = await chrome.windows.getCurrent();
    if (
      currentWindow &&
      typeof currentWindow.left === "number" &&
      typeof currentWindow.top === "number" &&
      typeof currentWindow.width === "number" &&
      typeof currentWindow.height === "number"
    ) {
      const left = Math.max(0, Math.round(currentWindow.left + (currentWindow.width - width) / 2));
      const top = Math.max(0, Math.round(currentWindow.top + (currentWindow.height - height) / 2));
      return { left, top };
    }
  } catch {
    // Fallback if current window coordinates cannot be queried
  }
  return {};
}

async function findCopilotWindow(copilotUrl) {
  const expected = new URL(copilotUrl);
  const windows = await chrome.windows.getAll({ populate: true });
  for (const candidate of windows) {
    const copilotTab = candidate.tabs?.find((tab) => {
      if (!tab.url) return false;
      try {
        const url = new URL(tab.url);
        return url.origin === expected.origin
          && url.pathname === expected.pathname
          && url.searchParams.get("grantMic") !== "1";
      } catch {
        return false;
      }
    });
    if (copilotTab && typeof candidate.id === "number") {
      return { window: candidate, tab: copilotTab };
    }
  }
  return null;
}

async function openCopilotWindow(targetTabId) {
  if (typeof targetTabId === "number") {
    await chrome.storage.session.set({ [TARGET_TAB_STORAGE_KEY]: targetTabId });
  }

  const copilotUrl = chrome.runtime.getURL("sidepanel.html");
  const existing = await findCopilotWindow(copilotUrl);
  const { left, top } = await getCenteredCoordinates(COPILOT_WINDOW_WIDTH, COPILOT_WINDOW_HEIGHT);

  if (existing) {
    const updateInfo = {
      width: COPILOT_WINDOW_WIDTH,
      height: COPILOT_WINDOW_HEIGHT,
      focused: true,
      state: "normal",
    };
    if (typeof left === "number" && typeof top === "number") {
      updateInfo.left = left;
      updateInfo.top = top;
    }
    await chrome.windows.update(existing.window.id, updateInfo);
    await chrome.tabs.update(existing.tab.id, { active: true });
    return;
  }

  const createInfo = {
    url: copilotUrl,
    type: "popup",
    width: COPILOT_WINDOW_WIDTH,
    height: COPILOT_WINDOW_HEIGHT,
    focused: true,
  };
  if (typeof left === "number" && typeof top === "number") {
    createInfo.left = left;
    createInfo.top = top;
  }

  await chrome.windows.create(createInfo);
}

function isAllowedWebsiteSender(sender) {
  if (!sender.tab || typeof sender.tab.id !== "number" || typeof sender.url !== "string") return false;
  try {
    const url = new URL(sender.url);
    return (url.protocol === "https:" && url.hostname === "pitchpilot-ai-ruddy.vercel.app")
      || (url.protocol === "http:" && url.hostname === "localhost");
  } catch {
    return false;
  }
}

function isExtensionPageSender(sender) {
  if (sender.id !== chrome.runtime.id || typeof sender.url !== "string") return false;
  try {
    return new URL(sender.url).origin === new URL(chrome.runtime.getURL("")).origin;
  } catch {
    return false;
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !["PITCHPILOT_EXTENSION_PING", "PITCHPILOT_OPEN_WINDOW"].includes(message.type)) {
    return false;
  }

  if (message.type === "PITCHPILOT_EXTENSION_PING") {
    if (!isAllowedWebsiteSender(sender)) {
      sendResponse({ ok: false, error: "This website is not authorized to open PitchPilot." });
      return false;
    }
    sendResponse({ ok: true, available: true });
    return false;
  }

  const websiteRequest = isAllowedWebsiteSender(sender);
  const extensionRequest = isExtensionPageSender(sender);
  if (!websiteRequest && !extensionRequest) {
    sendResponse({ ok: false, opened: false, error: "This website is not authorized to open PitchPilot." });
    return false;
  }

  const targetTabId = websiteRequest
    ? sender.tab.id
    : Number.isInteger(message.tabId) ? message.tabId : undefined;
  openCopilotWindow(targetTabId)
    .then(() => sendResponse({ ok: true, opened: true }))
    .catch((error) => {
      console.error("Could not open the PitchPilot window:", error);
      sendResponse({ ok: false, opened: false, error: "Chrome could not open the PitchPilot window." });
    });
  return true;
});

chrome.action.onClicked.addListener((tab) => {
  openCopilotWindow(tab?.id).catch((error) => {
    console.error("Could not open the PitchPilot window:", error);
  });
});
