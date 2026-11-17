async function pushToStealthHUD(questionText, renderedHtml) {
  try {
    await fetch("http://127.0.0", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: questionText,
        html: renderedHtml,
      }),
    });
  } catch {
    // Stealth desktop HUD is not running; extension popup still displays the answer normally
  }
}

async function triggerAiQuery(promptText) {
  if (!promptText.trim()) return;
  const loadingHtml = '<div class="placeholder-result">AI copilot is generating prompt solution…</div>';
  elements.aiResponse.innerHTML = loadingHtml;
  pushToStealthHUD(promptText, loadingHtml);

  const settings = await PitchPilotExtension.loadSettings();
  const selectedDocIds = Array.from(elements.documentSelect.selectedOptions).map(o => o.value);

  try {
    const res = await PitchPilotExtension.requestJson("/api/copilot/answer", settings, {
      method: "POST",
      body: JSON.stringify({
        question: promptText,
        mode: currentSession.type,
        contextText: elements.jobDescription.value,
        documentIds: selectedDocIds,
        sessionId: currentSession.sessionId
      })
    });

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
        ${data.suggestedPhrases.map(p => `<li>"${escapeHtml(p)}"</li>`).join("")}
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

async function triggerAiQueryWithScreenshot(promptText, imageBase64) {
  const loadingHtml = '<div class="placeholder-result">Scanning screen and solving with AI…</div>';
  elements.aiResponse.innerHTML = loadingHtml;
  pushToStealthHUD(promptText, loadingHtml);

  const settings = await PitchPilotExtension.loadSettings();
  const selectedDocIds = Array.from(elements.documentSelect.selectedOptions).map(o => o.value);

  try {
    const res = await PitchPilotExtension.requestJson("/api/copilot/answer", settings, {
      method: "POST",
      body: JSON.stringify({
        question: promptText,
        imageBase64,
        mode: currentSession.type,
        contextText: elements.jobDescription.value,
        documentIds: selectedDocIds,
        sessionId: currentSession.sessionId
      })
    });

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
