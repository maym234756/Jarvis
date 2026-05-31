const FRESH_PATTERNS = [
  {
    category: "public_office",
    authorityHints: ["official", "government", "primary source"],
    pattern: /\b(who is|who's|whos|name)\b[\s\S]{0,100}\b(president|prime minister|governor|mayor|senator|representative|secretary|ceo|cfo|cto|chair|chairman|head coach|leader|director)\b/i
  },
  {
    category: "public_office",
    authorityHints: ["official", "government", "primary source"],
    pattern: /\b(president|prime minister|governor|mayor|senator|representative|secretary|ceo|cfo|cto|chair|chairman|head coach|leader|director)\b[\s\S]{0,100}\b(of|for|at|in)\b/i
  },
  {
    category: "news",
    authorityHints: ["latest", "news", "official statement"],
    pattern: /\b(latest|current|today|tonight|yesterday|tomorrow|right now|up to date|real[- ]?time|news|breaking|recent)\b/i
  },
  {
    category: "market",
    authorityHints: ["exchange", "official", "market data"],
    pattern: /\b(price|stock|crypto|exchange rate|interest rate|inflation|mortgage rate|market cap|earnings)\b/i
  },
  {
    category: "software",
    authorityHints: ["official docs", "release notes", "changelog"],
    pattern: /\b(version|release|changelog|deprecated|support policy|security advisory|cve|nvd)\b/i
  },
  {
    category: "law_policy",
    authorityHints: ["law", "regulation", "official agency", "effective date"],
    pattern: /\b(law|regulation|policy|rule|standard|guideline|tax|visa|permit|compliance)\b[\s\S]{0,100}\b(current|latest|new|changed|updated|effective|required)\b/i
  },
  {
    category: "time_sensitive",
    authorityHints: ["schedule", "official", "live"],
    pattern: /\b(schedule|weather|score|standings|flight|shipping|tracking|availability|inventory)\b/i
  }
];

const CONNECTOR_PATTERNS = [
  {
    connector: "salesforce",
    category: "crm_account",
    pattern: /\b(salesforce|crm|opportunit(?:y|ies)|lead|leads|account|accounts|case|cases|contact|contacts|soql)\b/i
  }
];

export function analyzeFreshness(message = "", { taskType = "chat" } = {}) {
  const text = String(message || "");
  const matches = FRESH_PATTERNS
    .filter((item) => item.pattern.test(text))
    .map((item) => ({
      category: item.category,
      authorityHints: item.authorityHints,
      reason: `${item.category} information can change and should be checked against current sources.`
    }));
  const connectorMatches = CONNECTOR_PATTERNS
    .filter((item) => item.pattern.test(text))
    .map((item) => ({
      connector: item.connector,
      category: item.category,
      reason: `${item.connector} questions may need account-scoped connector access.`
    }));
  const requiresFreshResearch = taskType === "research" || matches.length > 0;
  const categories = [...new Set(matches.map((item) => item.category))];
  const authorityHints = [...new Set(matches.flatMap((item) => item.authorityHints))];

  return {
    requiresFreshResearch,
    categories,
    authorityHints,
    reasons: matches.map((item) => item.reason),
    connectorMatches,
    maxAgeMs: requiresFreshResearch ? 2 * 60 * 1000 : 10 * 60 * 1000,
    searchDepth: requiresFreshResearch ? "deep" : "standard"
  };
}

export function requiresFreshResearch(message = "", context = {}) {
  return analyzeFreshness(message, context).requiresFreshResearch;
}
