"use strict";

chrome.action.onClicked.addListener((tab) => {
  if (typeof tab.windowId !== "number") return;
  chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {
    // Chrome can reject panel opening for windows without a supported tab.
  });
});
