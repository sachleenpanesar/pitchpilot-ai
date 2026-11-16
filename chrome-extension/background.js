"use strict";

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {
    console.warn("Could not configure the PitchPilot side panel behavior.");
  });
});

function isAllowedWebsiteSender(sender) {
  if (!sender.tab || typeof sender.tab.id !== "number" || typeof sender.url !== "string") return false;
  try {
    const url = new URL(sender.url);
    return url.protocol === "https:" && url.hostname === "pitchpilot-ai-ruddy.vercel.app" ||
      url.protocol === "http:" && url.hostname === "localhost";
  } catch {
    return false;
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !["PITCHPILOT_EXTENSION_PING", "PITCHPILOT_OPEN_SIDE_PANEL"].includes(message.type)) {
    return false;
  }
  if (!isAllowedWebsiteSender(sender)) {
    sendResponse({ ok: false, error: "This website is not authorized to open the PitchPilot panel." });
    return false;
  }

  if (message.type === "PITCHPILOT_EXTENSION_PING") {
    sendResponse({ ok: true, available: true });
    return false;
  }

  chrome.sidePanel.open({ tabId: sender.tab.id })
    .then(() => sendResponse({ ok: true, opened: true }))
    .catch(() => sendResponse({ ok: false, opened: false, error: "Chrome could not open the side panel. Use the extension toolbar button instead." }));
  return true;
});
