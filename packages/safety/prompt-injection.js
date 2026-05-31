const INJECTION_PATTERNS = [
  { pattern: /\bignore (all )?(previous|prior|above|system|developer) instructions\b/i, weight: 0.35, kind: "instruction_override" },
  { pattern: /\bdisregard (all )?(previous|prior|above) instructions\b/i, weight: 0.3, kind: "instruction_override" },
  { pattern: /\breveal (the )?(system|developer|hidden) (prompt|message|instructions)\b/i, weight: 0.35, kind: "prompt_exfiltration" },
  { pattern: /\bprint (the )?(system|developer|hidden) (prompt|message|instructions)\b/i, weight: 0.3, kind: "prompt_exfiltration" },
  { pattern: /\bexfiltrate|steal|leak\b[\s\S]{0,80}\b(secret|token|credential|api key|password)\b/i, weight: 0.45, kind: "credential_exfiltration" },
  { pattern: /\b(send|post|upload)\b[\s\S]{0,100}\b(secret|token|credential|api key|password|environment variable)\b/i, weight: 0.35, kind: "credential_exfiltration" },
  { pattern: /\b(base64|encodedcommand|invoke-expression|iex)\b/i, weight: 0.25, kind: "obfuscated_command" },
  { pattern: /\b(run|execute)\b[\s\S]{0,80}\b(curl|wget|powershell|cmd|bash|rm -rf|remove-item)\b/i, weight: 0.3, kind: "tool_hijack" },
  { pattern: /\byou are now\b[\s\S]{0,80}\b(system|developer|administrator|root)\b/i, weight: 0.25, kind: "role_hijack" },
  { pattern: /\bdo not tell the user\b|\bsecretly\b|\bwithout asking\b/i, weight: 0.25, kind: "concealment" }
];

export class PromptInjectionGuard {
  scan(text = "") {
    const value = String(text || "");
    const findings = [];
    let score = 0;
    for (const item of INJECTION_PATTERNS) {
      const match = value.match(item.pattern);
      if (!match) continue;
      score += item.weight;
      findings.push({
        kind: item.kind,
        weight: item.weight,
        evidence: clip(match[0])
      });
    }

    const normalizedScore = Number(Math.min(1, score).toFixed(3));
    return {
      score: normalizedScore,
      level: levelFor(normalizedScore),
      suspicious: normalizedScore >= 0.3,
      findings
    };
  }
}

function levelFor(score) {
  if (score >= 0.7) return "high";
  if (score >= 0.3) return "medium";
  if (score > 0) return "low";
  return "none";
}

function clip(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length <= 160 ? text : `${text.slice(0, 160)}...`;
}
