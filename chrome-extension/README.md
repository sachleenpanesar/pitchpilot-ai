# PitchPilot Sidekick

## Install locally

1. Start the Next.js app with `npm run dev` and sign in at `http://localhost:3000`.
2. Visit `http://localhost:3000/extension-access`, create a one-hour extension token, and copy it. The token is scoped to the copilot answer endpoint.
3. In Chrome, open `chrome://extensions`, enable **Developer mode**, select **Load unpacked**, and choose this `chrome-extension` folder.
4. Click the extension toolbar icon. Set the backend URL to `http://localhost:3000/api/copilot/answer`, paste the temporary bearer token, optionally enter a PitchPilot session ID, and choose **Save settings**.
5. Use **Solve current tab** to submit a screenshot, enter a prompt under **Ask a question**, or use **Start listening**. With **Auto-Answer** enabled, recognized speech is submitted after 1.5 seconds of silence.

The manifest grants backend host access only to `http://localhost:3000/*`; this source build does not support a remote backend. For a deployed server, change the host permission and the URL validation in `sidepanel.js`, then reload the extension.

## Privacy and permissions

- Screenshots and recognized text are sent only to the configured localhost API. The API uses the signed-in account's document context and server-side AI configuration; the extension never receives or stores `GEMINI_API_KEY`.
- Speech recognition is provided by Chrome's Web Speech API and may use Chrome's speech service. The extension does not record microphone audio to a file. Recognized text is sent only when Auto-Answer is enabled.
- Extension settings use `chrome.storage.local`. A bearer token is kept in panel memory by default. Persisting it requires checking **Remember this token**; local extension storage is not encrypted. Tokens issued by `/extension-access` expire after one hour.
- An optional session ID is resolved by the backend using both the ID and authenticated user ID. Only owned sessions are accepted; title, role/client, mode, language, and the last 6,000 transcript characters are added as answer context.
- Microphone access is requested only after **Start listening**. Tab capture is initiated by the **Solve active tab** button; Chrome can block screenshots of protected pages.
- The manifest declares `sidePanel`, `activeTab`, and `storage`, with a localhost-only host permission; it does not request broad page-reading access.
