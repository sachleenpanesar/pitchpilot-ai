# PitchPilot AI Chrome Extension

## Install

1. Download the extension ZIP from `/extension-access` and extract it, or use this `chrome-extension` folder directly. In Chrome, open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select the extracted folder.
2. Sign in to the configured backend in the same Chrome profile. The extension attempts to connect automatically when the Side Panel opens; use **Connect account** in the popup or Side Panel to retry. If automatic connection is unavailable, create a 30-day token from **Extension Access** and paste it into Settings. Tokens remain in session storage unless **Remember token on this device** is selected.
3. Use **Open Full Side Panel** to prepare a session and start the Live Copilot. The website's **Launch Copilot** button checks for the installed extension and opens its side panel; if it is not detected, it opens the installation and token page.

The default backend is `https://pitchpilot-ai-ruddy.vercel.app`. A local development backend can be set to `http://localhost:3000`. Selecting a different backend asks Chrome for access to that origin.

## Prepare and use a session

- **Context:** choose Interview or Regular Meeting, paste a job description/brief, import visible text from the active tab, upload a plain-text or Markdown brief, and select saved CV/resume or documents.
- **Preferences:** select response language and answer style, then enable Auto-Answer if desired.
- **Live Copilot:** ask or dictate a question, or solve the visible tab. Auto-Answer submits recognized speech after 1.5 seconds of silence. Results include a spoken approach, code when relevant, and time/space complexity.
- The popup shows the account credit balance, links to Support and `/pricing`, and provides connection settings.

## Privacy and permissions

- Screenshots, recognized text, job descriptions, and selected document IDs are sent only to the configured backend. The backend verifies document ownership and applies account credits.
- Page text is read only after **Import from Current Tab** is clicked and uses Chrome's `activeTab`/`scripting` permissions.
- Speech recognition is provided by Chrome's Web Speech API and may use Chrome's speech service. The extension does not record microphone audio to a file.
- A bearer token expires after 30 days. Session-only tokens use Chrome session storage; remembered tokens use local extension storage, which is not encrypted. Use **Clear token** or remove the extension to clear it.
- The extension never receives or stores `GEMINI_API_KEY`. AI requests use the account's server-side configuration.
