export function composeGroundedAnswer(request = {}) {
  if (request.taskType !== "research") return "";
  const research = (request.toolResults || []).find((result) => result.tool === "research.run" && result.ok);
  if (!research?.sources?.length) return "";

  const currentOffice = answerCurrentOfficeQuestion(request.message, research.sources);
  if (currentOffice) return currentOffice;
  return "";
}

function answerCurrentOfficeQuestion(message = "", sources = []) {
  const text = String(message).toLowerCase();
  if (!/\b(who is|who's|whos|name)\b/.test(text)) return "";
  if (!/\bpresident\b/.test(text)) return "";
  if (!/\b(us|u\.s\.?|usa|u\.s\.a\.?|united states|america)\b/.test(text)) return "";

  const candidates = [];
  for (const source of sources.filter((item) => item.ok)) {
    const candidate = extractUsPresidentCandidate(source);
    if (candidate) candidates.push(candidate);
  }
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  if (!best || best.score < 3) return "";

  const supporting = candidates
    .filter((candidate) => candidate.name === best.name)
    .slice(0, 3);
  const sourceLines = supporting.map((candidate, index) => {
    return `${index + 1}. ${candidate.title} - ${candidate.url}`;
  });

  return [
    `${best.name} is the current President of the United States.`,
    sourceLines.length ? `Sources:\n${sourceLines.join("\n")}` : ""
  ].filter(Boolean).join("\n\n");
}

function extractUsPresidentCandidate(source) {
  const host = safeHost(source.url);
  const haystack = [
    source.title,
    source.description,
    ...(source.snippets || []),
    source.text || ""
  ].join(" ");
  const currentWhiteHouse = host === "whitehouse.gov" || host.endsWith(".whitehouse.gov");
  const archived = /archives\.gov|trumpwhitehouse\.archives\.gov|obamawhitehouse\.archives\.gov/i.test(source.url);

  let match = String(source.title || "").match(/^President\s+([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){1,4})\s+-\s+The White House/i);
  if (match) {
    return {
      name: cleanupName(match[1]),
      title: source.title,
      url: source.url,
      score: (currentWhiteHouse && !archived ? 8 : 3) + (source.source_type === "authoritative" ? 2 : 0)
    };
  }

  match = haystack.match(/([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){1,4})\s+\d+(?:st|nd|rd|th)\s*&\s*\d+(?:st|nd|rd|th)\s+President of the United States/i);
  if (match) {
    return {
      name: cleanupName(match[1]),
      title: source.title,
      url: source.url,
      score: (currentWhiteHouse && !archived ? 7 : 2) + (source.source_type === "authoritative" ? 2 : 0)
    };
  }

  match = haystack.match(/President of the United States is\s+([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){1,4})/i);
  if (match) {
    return {
      name: cleanupName(match[1]),
      title: source.title,
      url: source.url,
      score: (source.source_type === "authoritative" ? 4 : 2)
    };
  }

  return null;
}

function cleanupName(value = "") {
  return String(value).replace(/\s+/g, " ").replace(/[.,;:]+$/, "").trim();
}

function safeHost(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}
