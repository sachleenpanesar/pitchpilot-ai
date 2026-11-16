"use strict";

(() => {
  const PAGE_SOURCE = "pitchpilot-website";
  const EXTENSION_SOURCE = "pitchpilot-extension";
  window.__PITCHPILOT_EXTENSION_INSTALLED__ = true;
  const { protocol, hostname } = window.location;
  const isAllowedOrigin = protocol === "https:" && hostname === "pitchpilot-ai-ruddy.vercel.app" ||
    protocol === "http:" && hostname === "localhost";
  if (!isAllowedOrigin) return;

  window.addEventListener("message", (event) => {
    const request = event.data;
    if (
      event.source !== window ||
      event.origin !== window.location.origin ||
      !request ||
      request.source !== PAGE_SOURCE ||
      typeof request.requestId !== "string" ||
      request.requestId.length > 100
    ) return;

    const responseType = request.type === "PITCHPILOT_DETECT"
      ? "PITCHPILOT_EXTENSION_PING"
      : request.type === "OPEN_PITCHPILOT_EXTENSION"
        ? "PITCHPILOT_OPEN_SIDE_PANEL"
        : "";
    if (!responseType) return;

    chrome.runtime.sendMessage({ type: responseType }, (result) => {
      const runtimeError = chrome.runtime.lastError;
      window.postMessage({
        source: EXTENSION_SOURCE,
        type: request.type === "PITCHPILOT_DETECT" ? "PITCHPILOT_DETECTED" : "PITCHPILOT_LAUNCH_RESULT",
        requestId: request.requestId,
        available: Boolean(result?.available && !runtimeError),
        opened: Boolean(result?.opened && !runtimeError),
        error: runtimeError?.message || result?.error,
      }, window.location.origin);
    });
  });
})();
