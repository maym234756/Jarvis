export function classifyTask(message, mode = "agent") {
  const text = message.toLowerCase();
  if (mode === "research" || /\b(search|research|look up|current|latest|source|cite)\b/.test(text)) return "research";
  if (mode === "code" || /\b(code|test|bug|fix|repo|file|function|api|build)\b/.test(text)) return "coding";
  if (/\b(error|failing|stack trace|debug)\b/.test(text)) return "debug";
  if (/\b(ingest|chunk|index|document|memory)\b/.test(text)) return "ingestion";
  if (/\b(download|iso|installer|os image)\b/.test(text)) return "os-download";
  if (/\b(security|threat|permission|audit|secret)\b/.test(text)) return "security";
  return "chat";
}

export function createPlan(message, taskType) {
  const base = ["Understand the request", "Retrieve relevant project memory"];
  if (taskType === "research") return [...base, "Use approved search if needed", "Compare evidence", "Summarize with source notes"];
  if (taskType === "coding") return [...base, "Inspect requested files", "Make the smallest useful change", "Run focused verification"];
  if (taskType === "debug") return [...base, "Reproduce or inspect the failure", "Patch the cause", "Verify the fix"];
  if (taskType === "ingestion") return [...base, "Chunk target documents", "Store retrievable metadata", "Report indexed chunks"];
  if (taskType === "os-download") return [...base, "Identify official source", "Ask permission before download", "Verify checksum before use"];
  if (taskType === "security") return [...base, "Check policy boundaries", "Prefer least-privilege tools", "Log decisions"];
  return [...base, "Answer directly or suggest a safe tool action"];
}

export function parseToolIntent(message) {
  const text = message.trim();
  let match = text.match(/^read\s+(.+)$/i);
  if (match) return { tool: "file.read", args: { path: match[1].trim() } };

  match = text.match(/^(?:list|ls)\s*(.*)$/i);
  if (match) return { tool: "file.list", args: { path: match[1].trim() || "." } };

  match = text.match(/^write\s+(.+?)\s*:\s*([\s\S]+)$/i);
  if (match) return { tool: "file.write", args: { path: match[1].trim(), content: match[2] } };

  match = text.match(/^(?:run|shell)\s+([\s\S]+)$/i);
  if (match) return { tool: "shell.run", args: { command: match[1].trim() } };

  match = text.match(/^(?:dry run|preview command)\s+([\s\S]+)$/i);
  if (match) return { tool: "shell.run", args: { command: match[1].trim(), dryRun: true } };

  match = text.match(/^(?:analyze command|explain command)\s+([\s\S]+)$/i);
  if (match) return { tool: "shell.analyze", args: { command: match[1].trim() } };

  match = text.match(/^(?:search|look up)\s+(.+)$/i);
  if (match) return { tool: "search.web", args: { query: match[1].trim() } };

  match = text.match(/^research\s+(.+)$/i);
  if (match) return { tool: "research.run", args: { query: match[1].trim(), limit: 5, maxSources: 3 } };

  match = text.match(/^(?:tool search|find tool|which tool|tools for)\s+(.+)$/i);
  if (match) return { tool: "tool.search", args: { query: match[1].trim(), limit: 8 } };

  match = text.match(/^(?:evals|run evals|backend evals)(?:\s+(.+))?$/i);
  if (match) return { tool: "evals.run", args: { filter: match[1]?.trim() || undefined } };

  match = text.match(/^ingest\s+(.+)$/i);
  if (match) return { tool: "memory.ingest", args: { path: match[1].trim() } };

  match = text.match(/^rebuild memory\s*(.*)$/i);
  if (match) return { tool: "memory.rebuild", args: { path: match[1].trim() || "." } };

  match = text.match(/^compact memory$/i);
  if (match) return { tool: "memory.compact", args: {} };

  match = text.match(/^memory stats$/i);
  if (match) return { tool: "memory.stats", args: {} };

  match = text.match(/^(?:docks|dock status|backend docks|backend docking station)$/i);
  if (match) return { tool: "docking.status", args: {} };

  match = text.match(/^(?:test dock|dock test)\s+(.+)$/i);
  if (match) return { tool: "docking.test", args: { id: match[1].trim() } };

  match = text.match(/^(?:connectors|connector list)$/i);
  if (match) return { tool: "connector.list", args: {} };

  match = text.match(/^connector add\s+([a-z0-9._-]+)\s+(\S+)(?:\s+(.+))?$/i);
  if (match) return { tool: "connector.add", args: { id: match[1].trim(), url: match[2].trim(), name: match[3]?.trim() || match[1].trim() } };

  match = text.match(/^connector test\s+(.+)$/i);
  if (match) return { tool: "connector.test", args: { id: match[1].trim() } };

  match = text.match(/^remember\s+(.+)$/i);
  if (match) return { tool: "memory.add", args: { text: match[1].trim(), sourcePath: "user-memory" } };

  return null;
}
