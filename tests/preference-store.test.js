import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PreferenceStore } from "../packages/preferences/index.js";

test("preference store saves active preferences and garbage-collects expired records", async (t) => {
  const root = path.join(process.cwd(), ".test-output", `preferences-${Date.now()}`);
  t.after(async () => {
    await fs.promises.rm(root, { recursive: true, force: true });
  });

  const store = new PreferenceStore({ projectRoot: root });
  await store.set({ key: "answer.length", value: "concise" });
  await store.set({ key: "expired.preference", value: "old", expiresAt: "2000-01-01T00:00:00.000Z" });

  assert.equal((await store.list()).length, 1);
  assert.equal((await store.effective())["answer.length"], "concise");

  const gc = await store.garbageCollect();
  assert.equal(gc.removed, 1);
});
