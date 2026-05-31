#!/usr/bin/env node
import { loadEnv } from "../packages/config/env.js";
import { createBackendKernel } from "../packages/backend/index.js";
import { formatDockReport } from "../packages/docking/index.js";

const projectRoot = process.cwd();
loadEnv({ cwd: projectRoot });

const { dockingStation } = createBackendKernel({ projectRoot, port: Number(process.env.JARVIS_PORT || 8787) });

const [command, id] = process.argv.slice(2);
if (command === "test") {
  if (!id) {
    console.error("Usage: npm run docks -- test <dock-id>");
    process.exit(1);
  }
  console.log(await dockingStation.testDock(id));
} else {
  console.log(formatDockReport(await dockingStation.report()));
}
