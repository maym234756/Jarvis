import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ContextCompactor } from "../packages/context/index.js";
import { SessionStore } from "../packages/session/index.js";

test("session store compacts long chat history into a summary", async (t) => {
  const root = path.join(process.cwd(), ".test-output", `context-${Date.now()}`);
  t.after(async () => {
    await fs.promises.rm(root, { recursive: true, force: true });
  });

  const sessionStore = new SessionStore({
    projectRoot: root,
    contextCompactor: new ContextCompactor({ maxMessages: 3, keepMessages: 2, maxSummaryChars: 1000 })
  });
  const session = await sessionStore.createSession({ title: "compact me" });

  for (let index = 0; index < 5; index++) {
    await sessionStore.appendMessage(session.id, {
      role: index % 2 ? "assistant" : "user",
      content: `message ${index} with useful project context`
    });
  }

  const full = await sessionStore.getSession(session.id);
  assert.ok(full.messages.length <= 3);
  assert.ok(full.compaction.compacted_messages > 0);
  assert.match(full.compaction.summary, /message 0/);
});
