const $ = (selector) => document.querySelector(selector);
const conversation = $("#conversation");
let activeSessionId = null;

document.querySelectorAll("nav button").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("nav button").forEach((item) => item.classList.remove("active"));
    document.querySelectorAll(".tab").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    $(`#${button.dataset.tab}`).classList.add("active");
  });
});

$("#chatForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = $("#message");
  const message = input.value.trim();
  if (!message) return;
  input.value = "";
  addMessage("user", message);
  const response = await api("/chat", {
    method: "POST",
    body: {
      message,
      mode: $("#mode").value,
      privacyLevel: $("#privacy").value,
      sessionId: activeSessionId,
      title: "Jarvis web session"
    }
  });
  activeSessionId = response.sessionId || activeSessionId;
  addMessage("jarvis", formatChatResponse(response));
  await refreshApprovals();
});

$("#refreshApprovals").addEventListener("click", refreshApprovals);
$("#refreshTools").addEventListener("click", refreshTools);
$("#refreshDocks").addEventListener("click", refreshDocks);
$("#memorySearch").addEventListener("click", searchMemory);
$("#memoryStats").addEventListener("click", showMemoryStats);
$("#memoryCompact").addEventListener("click", compactMemory);
$("#runDoctor").addEventListener("click", showDoctor);
$("#showEngine").addEventListener("click", showEngine);
$("#showMetrics").addEventListener("click", showMetrics);
$("#refreshRuns").addEventListener("click", showRuns);
$("#refreshSessions").addEventListener("click", showSessions);
$("#newSession").addEventListener("click", createSession);

async function api(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || "GET",
    headers: { "content-type": "application/json" },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

function addMessage(role, text) {
  const node = document.createElement("div");
  node.className = `message ${role}`;
  node.innerHTML = `<div class="meta">${role}</div><pre></pre>`;
  node.querySelector("pre").textContent = text;
  conversation.appendChild(node);
  conversation.scrollTop = conversation.scrollHeight;
}

function formatChatResponse(response) {
  const tools = (response.toolResults || []).map((tool) => {
    const state = tool.ok ? "ok" : tool.pendingApproval ? `pending approval ${tool.approvalId || ""}` : "failed";
    return `${tool.tool}: ${state}\n${tool.summary || tool.error || ""}`;
  }).join("\n\n");
  return [
    response.runId ? `Run: ${response.runId}` : "",
    response.sessionId ? `Session: ${response.sessionId}` : "",
    `Workflow: ${response.workflow?.name || "none"}`,
    tools,
    response.answer
  ].filter(Boolean).join("\n\n");
}

async function refreshApprovals() {
  const data = await api("/approvals?status=pending");
  const list = $("#approvalList");
  list.innerHTML = "";
  if (!data.approvals.length) {
    list.innerHTML = `<div class="item"><p>No pending approvals.</p></div>`;
    return;
  }
  for (const approval of data.approvals) {
    const node = document.createElement("div");
    node.className = `item ${approval.riskLevel >= 3 ? "danger" : "warn"}`;
    node.innerHTML = `
      <div class="meta">Tier ${approval.riskLevel} - ${approval.tool} - ${approval.id}</div>
      <pre>${escapeHtml(approval.summary || "")}</pre>
      <p>${escapeHtml(approval.reason || "")}</p>
      <div class="actions">
        <button data-action="approve">Approve</button>
        <button data-action="deny">Deny</button>
      </div>
    `;
    node.querySelector('[data-action="approve"]').addEventListener("click", () => resolveApproval(approval.id, true));
    node.querySelector('[data-action="deny"]').addEventListener("click", () => resolveApproval(approval.id, false));
    list.appendChild(node);
  }
}

async function resolveApproval(id, approved) {
  const result = await api(`/approvals/${id}`, { method: "POST", body: { approved } });
  addMessage("tool", `${approved ? "Approved" : "Denied"} ${id}\n${result.summary || result.error || ""}`);
  await refreshApprovals();
}

async function refreshTools() {
  const data = await api("/tools");
  $("#toolList").innerHTML = data.tools.map((tool) => `
    <div class="item">
      <div class="meta">Tier ${tool.riskLevel} - ${escapeHtml(tool.name)}</div>
      <p>${escapeHtml(tool.description)}</p>
    </div>
  `).join("");
}

async function refreshDocks() {
  const report = await api("/docking");
  $("#dockList").innerHTML = `
    <div class="item">
      <div class="meta">Backend Docking Station</div>
      <pre>${escapeHtml(`${report.summary.ok} ok, ${report.summary.warn} warning, ${report.summary.error} error`)}</pre>
    </div>
    ${report.docks.map((dock) => `
      <div class="item ${dock.health === "error" ? "danger" : dock.health === "warn" ? "warn" : ""}">
        <div class="meta">${escapeHtml(dock.health.toUpperCase())} - ${escapeHtml(dock.id)} - ${escapeHtml(dock.type)}</div>
        <pre>${escapeHtml(dock.name)}
Status: ${escapeHtml(dock.status)}
Endpoint: ${escapeHtml(dock.endpoint || "local")}
Capabilities: ${escapeHtml((dock.capabilities || []).join(", ") || "none")}
${dock.guidance ? `Guidance: ${escapeHtml(dock.guidance)}` : ""}</pre>
        <div class="actions"><button data-dock="${escapeHtml(dock.id)}">Test</button></div>
      </div>
    `).join("")}
  `;
  document.querySelectorAll("[data-dock]").forEach((button) => {
    button.addEventListener("click", () => testDock(button.dataset.dock));
  });
}

async function testDock(id) {
  const result = await api(`/docking/${encodeURIComponent(id)}/test`, { method: "POST", body: {} });
  addMessage("dock", `${id}\n${result.ok ? "OK" : "Not ready"}: ${result.message || result.status}`);
}

async function searchMemory() {
  const query = $("#memoryQuery").value;
  const sourceIncludes = $("#memoryFilter").value.trim();
  const data = await api("/memory/query", {
    method: "POST",
    body: {
      query,
      limit: 8,
      filters: sourceIncludes ? { sourceIncludes } : {}
    }
  });
  $("#memoryResults").innerHTML = data.matches.map((match) => `
    <div class="item">
      <div class="meta">${escapeHtml(match.citation?.label || match.metadata.source_path)} - ${Number(match.score || 0).toFixed(3)}</div>
      <pre>${escapeHtml(match.text.slice(0, 1200))}</pre>
    </div>
  `).join("") || `<div class="item"><p>No memory matches.</p></div>`;
}

async function showMemoryStats() {
  const data = await api("/memory/stats");
  $("#memoryResults").innerHTML = `<div class="item"><pre>${escapeHtml(JSON.stringify(data.stats, null, 2))}</pre></div>`;
}

async function compactMemory() {
  const data = await api("/memory/compact", { method: "POST", body: {} });
  $("#memoryResults").innerHTML = `<div class="item"><pre>${escapeHtml(JSON.stringify(data.result, null, 2))}</pre></div>`;
}

async function showDoctor() {
  const report = await api("/doctor");
  $("#opsPanel").innerHTML = `
    <div class="item">
      <div class="meta">${escapeHtml(report.summary)}</div>
      <pre>${escapeHtml(report.checks.map((item) => `[${item.status.toUpperCase()}] ${item.name}: ${item.message}`).join("\n"))}</pre>
    </div>
  `;
}

async function showEngine() {
  const status = await api("/engine");
  $("#opsPanel").innerHTML = `<div class="item"><div class="meta">Engine Status</div><pre>${escapeHtml(JSON.stringify(status, null, 2))}</pre></div>`;
}

async function showMetrics() {
  const metrics = await api("/metrics?limit=25");
  $("#opsPanel").innerHTML = `
    <div class="item"><div class="meta">Metrics Summary</div><pre>${escapeHtml(JSON.stringify(metrics.summary, null, 2))}</pre></div>
    ${metrics.events.map((event) => `
      <div class="item">
        <div class="meta">${escapeHtml(event.timestamp)} - ${escapeHtml(event.type || "")}</div>
        <pre>${escapeHtml(JSON.stringify(event, null, 2))}</pre>
      </div>
    `).join("")}
  `;
}

async function showRuns() {
  const data = await api("/runs?limit=20");
  $("#opsPanel").innerHTML = `
    <div class="item"><div class="meta">Run stats</div><pre>${escapeHtml(JSON.stringify(data.stats, null, 2))}</pre></div>
    ${data.runs.map((run) => `
      <div class="item">
        <div class="meta">${escapeHtml(run.status)} - ${escapeHtml(run.taskType || "")}/${escapeHtml(run.workflow || "")} - ${escapeHtml(run.id)}</div>
        <pre>${escapeHtml(run.message || "")}</pre>
      </div>
    `).join("")}
  `;
}

async function showSessions() {
  const data = await api("/sessions?limit=20");
  $("#opsPanel").innerHTML = data.sessions.map((session) => `
    <div class="item">
      <div class="meta">${escapeHtml(session.updated_at)} - ${session.messages} messages</div>
      <pre>${escapeHtml(session.title)}\n${escapeHtml(session.id)}</pre>
      <div class="actions"><button data-session="${escapeHtml(session.id)}">Use</button></div>
    </div>
  `).join("") || `<div class="item"><p>No saved sessions.</p></div>`;
  document.querySelectorAll("[data-session]").forEach((button) => {
    button.addEventListener("click", () => {
      activeSessionId = button.dataset.session;
      addMessage("system", `Using session ${activeSessionId}`);
    });
  });
}

async function createSession() {
  const data = await api("/sessions", {
    method: "POST",
    body: {
      title: "Jarvis web session",
      mode: $("#mode").value,
      privacyLevel: $("#privacy").value
    }
  });
  activeSessionId = data.session.id;
  addMessage("system", `Started session ${activeSessionId}`);
  await showSessions();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function init() {
  const health = await api("/health");
  const providers = health.providers;
  $("#providerLine").textContent = [
    providers.openai.configured ? `OpenAI ${providers.openai.model}` : providers.ollama.configured ? `Ollama ${providers.ollama.model}` : "Local draft",
    providers.search.configured ? `Search ${providers.search.provider}` : "Search off",
    providers.openaiEmbeddings.configured ? `Embeddings ${providers.openaiEmbeddings.model}` : "Local memory"
  ].join(" | ");
  await refreshTools();
  await refreshDocks();
  await refreshApprovals();
  await showDoctor();
}

init().catch((error) => addMessage("error", error.message));
