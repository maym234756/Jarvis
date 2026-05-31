export class ContextCompactor {
  constructor({ maxMessages = 40, keepMessages = 16, maxSummaryChars = 4000 } = {}) {
    this.maxMessages = maxMessages;
    this.keepMessages = keepMessages;
    this.maxSummaryChars = maxSummaryChars;
  }

  shouldCompact(session) {
    return (session.messages?.length || 0) > this.maxMessages;
  }

  compact(session) {
    if (!this.shouldCompact(session)) return { session, compacted: false };

    const previousSummary = session.compaction?.summary || "";
    const messages = session.messages || [];
    const toCompact = messages.slice(0, Math.max(0, messages.length - this.keepMessages));
    const kept = messages.slice(-this.keepMessages);
    const summary = mergeSummaries(previousSummary, summarizeMessages(toCompact), this.maxSummaryChars);

    return {
      compacted: true,
      session: {
        ...session,
        messages: kept,
        compaction: {
          summary,
          compacted_messages: (session.compaction?.compacted_messages || 0) + toCompact.length,
          last_compacted_at: new Date().toISOString()
        }
      }
    };
  }
}

function summarizeMessages(messages) {
  const facts = [];
  const toolNotes = [];
  const decisions = [];

  for (const message of messages) {
    const content = String(message.content || "").replace(/\s+/g, " ").trim();
    if (!content) continue;
    if (message.role === "user") facts.push(`User: ${content.slice(0, 260)}`);
    if (message.role === "assistant") decisions.push(`Assistant: ${content.slice(0, 260)}`);
    for (const tool of message.toolResults || []) {
      toolNotes.push(`Tool ${tool.tool}: ${tool.ok ? "ok" : "not ok"} ${tool.summary || tool.error || ""}`.trim());
    }
  }

  return [
    facts.length ? `Important user context:\n${facts.slice(-12).map((item) => `- ${item}`).join("\n")}` : "",
    decisions.length ? `Recent assistant outcomes:\n${decisions.slice(-12).map((item) => `- ${item}`).join("\n")}` : "",
    toolNotes.length ? `Tool outcomes:\n${toolNotes.slice(-16).map((item) => `- ${item}`).join("\n")}` : ""
  ].filter(Boolean).join("\n\n");
}

function mergeSummaries(previous, next, limit) {
  const merged = [previous, next].filter(Boolean).join("\n\n");
  if (merged.length <= limit) return merged;
  return merged.slice(Math.max(0, merged.length - limit));
}
