"use strict";

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {
    console.warn("Could not configure the PitchPilot side panel behavior.");
  });
});
