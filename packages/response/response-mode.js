export function chooseResponseMode({ message = "", taskType = "chat", toolIntent = null, runtimeProfile } = {}) {
  const text = String(message).toLowerCase();
  if (toolIntent) return mode("command", "Command Mode", "Report tool status, output, and next safe step.");
  if (taskType === "research") return mode("research_cite", "Research + Cite", "Answer with evidence, caveats, and citations.");
  if (taskType === "coding" || taskType === "debug") return mode("plan_execute", "Plan + Execute", "Summarize change path, verification, and files or commands touched.");
  if (/\b(explain|teach|why|how does)\b/.test(text)) return mode("teach", "Teach Mode", "Explain concepts clearly with practical examples.");
  if (/\b(draft|write|proposal|report|spec)\b/.test(text)) return mode("artifact", "Draft Artifact", "Produce a polished artifact with structure.");
  if (runtimeProfile?.id === "instant") return mode("direct", "Direct Answer", "Keep the response short and immediately useful.");
  if (runtimeProfile?.id === "deep") return mode("executive", "Executive Summary", "Lead with outcome, then verified details and risks.");
  return mode("direct", "Direct Answer", "Answer directly with only useful supporting context.");
}

export function listResponseModes() {
  return [
    mode("direct", "Direct Answer", "Simple answer."),
    mode("plan_execute", "Plan + Execute", "Work tasks with tools and verification."),
    mode("research_cite", "Research + Cite", "Source-backed answers."),
    mode("command", "Command Mode", "Tool-oriented operations."),
    mode("teach", "Teach Mode", "Explanations."),
    mode("artifact", "Draft Artifact", "Documents and specs."),
    mode("executive", "Executive Summary", "High-level summary plus risks.")
  ];
}

function mode(id, label, instruction) {
  return { id, label, instruction };
}
