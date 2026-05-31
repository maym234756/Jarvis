import test from "node:test";
import assert from "node:assert/strict";
import { ModelRouter } from "../packages/model-router/index.js";

test("model router keeps Jarvis local-first when hosted connector is disabled", () => {
  withEnv({
    OPENAI_API_KEY: "test-key",
    JARVIS_ALLOW_HOSTED_PROVIDERS: "false",
    JARVIS_MODEL_PROVIDER: "openai",
    OLLAMA_BASE_URL: "http://localhost:11434",
    OLLAMA_MODEL: "llama3.2:3b"
  }, () => {
    const route = new ModelRouter().describe({ privacyLevel: "project" });
    assert.equal(route.selected, "jarvis-local");
    assert.equal(route.providers.openai.configured, true);
    assert.equal(route.providers.openai.available, false);
  });
});

test("model router can use hosted connector only when explicitly enabled", () => {
  withEnv({
    OPENAI_API_KEY: "test-key",
    JARVIS_ALLOW_HOSTED_PROVIDERS: "true",
    JARVIS_MODEL_PROVIDER: "openai",
    OLLAMA_BASE_URL: undefined
  }, () => {
    const route = new ModelRouter().describe({ privacyLevel: "project" });
    assert.equal(route.selected, "openai-compatible");
    assert.equal(route.providers.openai.available, true);
  });
});

function withEnv(values, fn) {
  const previous = {};
  for (const [key, value] of Object.entries(values)) {
    previous[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    fn();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}
