import fs from "node:fs";
import path from "node:path";

let loaded = false;

export function loadEnv({ cwd = process.cwd(), fileName = ".env" } = {}) {
  if (loaded) return;
  loaded = true;

  const envPath = path.join(cwd, fileName);
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = unquote(rawValue.trim());
  }
}

export function getProviderStatus() {
  const hostedEnabled = hostedProvidersEnabled();
  return {
    jarvis: {
      modelProvider: process.env.JARVIS_MODEL_PROVIDER || "local",
      hostedProvidersEnabled: hostedEnabled
    },
    openai: {
      configured: Boolean(process.env.OPENAI_API_KEY),
      enabled: Boolean(process.env.OPENAI_API_KEY && hostedEnabled),
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"
    },
    openaiEmbeddings: {
      configured: Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_EMBEDDING_MODEL),
      enabled: Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_EMBEDDING_MODEL && hostedEnabled),
      model: process.env.OPENAI_EMBEDDING_MODEL || null
    },
    ollama: {
      configured: Boolean(process.env.OLLAMA_BASE_URL),
      model: process.env.OLLAMA_MODEL || "llama3.1",
      baseUrl: process.env.OLLAMA_BASE_URL || null
    },
    search: {
      provider: process.env.BRAVE_SEARCH_API_KEY ? "brave" : process.env.TAVILY_API_KEY ? "tavily" : duckDuckGoEnabled() ? "duckduckgo" : null,
      configured: Boolean(process.env.BRAVE_SEARCH_API_KEY || process.env.TAVILY_API_KEY || duckDuckGoEnabled())
    }
  };
}

export function hostedProvidersEnabled() {
  return /^(1|true|yes)$/i.test(process.env.JARVIS_ALLOW_HOSTED_PROVIDERS || "");
}

function duckDuckGoEnabled() {
  return /^(1|true|yes)$/i.test(process.env.DUCKDUCKGO_SEARCH_FALLBACK || "");
}

function unquote(value) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1).replace(/\\n/g, "\n");
  }
  return value;
}
