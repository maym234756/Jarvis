import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { EnvironmentInspector } from "../packages/environment/index.js";
import { FeedbackStore } from "../packages/learning/index.js";
import { ModelMesh } from "../packages/model-mesh/index.js";

test("environment inspector reports workspace and package manager", async (t) => {
  const root = path.join(process.cwd(), ".test-output", `environment-${Date.now()}`);
  t.after(async () => {
    await fs.promises.rm(root, { recursive: true, force: true });
  });
  await fs.promises.mkdir(root, { recursive: true });
  await fs.promises.writeFile(path.join(root, "package.json"), JSON.stringify({ name: "env-test" }), "utf8");

  const environment = await new EnvironmentInspector({ projectRoot: root }).inspect();

  assert.equal(environment.workspace, root);
  assert.equal(environment.packageManager, "npm");
  assert.ok(environment.os.platform);
});

test("feedback store feeds model mesh routing confidence", async (t) => {
  const root = path.join(process.cwd(), ".test-output", `feedback-${Date.now()}`);
  t.after(async () => {
    await fs.promises.rm(root, { recursive: true, force: true });
  });

  const feedbackStore = new FeedbackStore({ projectRoot: root });
  await feedbackStore.record({ taskType: "coding", runtimeProfile: "balanced", ok: true, score: 1 });
  const route = await new ModelMesh({ feedbackStore }).route({ taskType: "coding", runtimeProfile: "balanced" });

  assert.equal(route.primaryRole, "code-specialist");
  assert.equal(route.feedbackSignals.task.total, 1);
});
