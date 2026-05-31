#!/usr/bin/env node
import { existsSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import os from "node:os";

const projectRoot = process.cwd();
const python = findPython();

if (!python) {
  console.error("Python 3 was not found. Install Python 3.11+ and make sure python or py is on PATH, then run npm run chat:python again.");
  process.exit(1);
}

const requestedPort = Number(process.env.JARVIS_PORT || 8787);
const maxPort = Number(process.env.JARVIS_PORT_MAX || requestedPort + 20);
const backendScript = path.join(projectRoot, "apps", "api-server", "server.js");
const pythonApp = path.join(projectRoot, "apps", "python-chat", "jarvis_chat.py");
const backendInstanceId = randomUUID();

let backend = null;
let frontend = null;
let shuttingDown = false;

const port = await findAvailablePort(requestedPort, maxPort);
const backendUrl = `http://localhost:${port}`;

if (port !== requestedPort) {
  console.log(`Jarvis backend port ${requestedPort} is busy; using ${port}.`);
}

backend = spawn(process.execPath, [backendScript], {
  cwd: projectRoot,
  env: { ...process.env, JARVIS_PORT: String(port), JARVIS_BACKEND_URL: backendUrl, JARVIS_INSTANCE_ID: backendInstanceId },
  stdio: ["ignore", "pipe", "pipe"]
});

backend.stdout.on("data", (chunk) => {
  const text = chunk.toString().trim();
  if (text) console.log(`[backend] ${text}`);
});

backend.stderr.on("data", (chunk) => {
  const text = chunk.toString().trim();
  if (text) console.error(`[backend] ${text}`);
});

backend.on("exit", (code, signal) => {
  if (!shuttingDown && !frontend) {
    console.error(`Jarvis backend exited before Python chat started (${formatExit(code, signal)}).`);
    process.exit(code || 1);
  }
});

try {
  await waitForHealth(backendUrl, backendInstanceId);
  console.log(`Jarvis backend ready at ${backendUrl}`);
  console.log("Starting Python chat UX...");
  frontend = spawn(python.command, [...python.args, pythonApp, backendUrl], {
    cwd: projectRoot,
    env: { ...process.env, JARVIS_PORT: String(port), JARVIS_BACKEND_URL: backendUrl },
    stdio: "inherit"
  });
  frontend.on("exit", (code, signal) => shutdown(code ?? signalToExitCode(signal)));
  process.on("SIGINT", () => shutdown(130));
  process.on("SIGTERM", () => shutdown(143));
  process.on("exit", () => stopBackend());
} catch (error) {
  console.error(error.message);
  stopBackend();
  process.exit(1);
}

function findPython() {
  const candidates = [];
  if (process.env.PYTHON) candidates.push({ command: process.env.PYTHON, args: [] });
  candidates.push(...localPythonCandidates());
  candidates.push({ command: "py", args: ["-3"] });
  candidates.push({ command: "python", args: [] });
  candidates.push({ command: "python3", args: [] });

  for (const candidate of candidates) {
    const result = spawnSync(candidate.command, [...candidate.args, "--version"], { encoding: "utf8", shell: false });
    const output = `${result.stdout || ""}${result.stderr || ""}`.trim();
    if (result.status === 0 && /^Python 3\./.test(output)) return candidate;
  }
  return null;
}

function localPythonCandidates() {
  if (process.platform !== "win32") return [];
  const roots = [
    path.join(os.homedir(), "AppData", "Local", "Programs", "Python"),
    path.join(process.env.LOCALAPPDATA || "", "Programs", "Python")
  ].filter(Boolean);
  const candidates = [];
  for (const root of roots) {
    for (const version of ["Python314", "Python313", "Python312", "Python311"]) {
      const exe = path.join(root, version, "python.exe");
      if (existsSync(exe)) candidates.push({ command: exe, args: [] });
    }
  }
  return candidates;
}

async function findAvailablePort(start, end) {
  for (let current = start; current <= end; current += 1) {
    if (await isPortAvailable(current)) return current;
  }
  throw new Error(`No available Jarvis backend port found between ${start} and ${end}.`);
}

function isPortAvailable(portToCheck) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => server.close(() => resolve(true)));
    server.listen(portToCheck);
  });
}

async function waitForHealth(baseUrl, expectedInstanceId) {
  const deadline = Date.now() + Number(process.env.JARVIS_BACKEND_START_TIMEOUT_MS || 15000);
  while (Date.now() < deadline) {
    if (backend?.exitCode !== null) throw new Error("Jarvis backend exited before it became healthy.");
    if (await healthOk(`${baseUrl}/health`, expectedInstanceId)) {
      await delay(100);
      if (backend?.exitCode !== null) throw new Error("Jarvis backend exited after reporting healthy.");
      return;
    }
    await delay(250);
  }
  throw new Error(`Jarvis backend did not become healthy at ${baseUrl}/health.`);
}

function healthOk(url, expectedInstanceId) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          resolve(false);
          return;
        }
        if (!expectedInstanceId) {
          resolve(true);
          return;
        }
        try {
          const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          resolve(payload.instanceId === expectedInstanceId);
        } catch {
          resolve(false);
        }
      });
    });
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
    req.on("error", () => resolve(false));
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  stopBackend();
  process.exit(exitCode);
}

function stopBackend() {
  if (backend && backend.exitCode === null) backend.kill();
}

function signalToExitCode(signal) {
  if (signal === "SIGINT") return 130;
  if (signal === "SIGTERM") return 143;
  return 0;
}

function formatExit(code, signal) {
  return signal || `code ${code}`;
}
