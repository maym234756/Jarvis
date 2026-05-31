#!/usr/bin/env node
import { spawn } from "node:child_process";
import http from "node:http";
import net from "node:net";
import path from "node:path";

const projectRoot = process.cwd();
const requestedPort = Number(process.env.JARVIS_PORT || 8787);
const maxPort = Number(process.env.JARVIS_PORT_MAX || requestedPort + 20);
const backendScript = path.join(projectRoot, "apps", "api-server", "server.js");
const chatScript = path.join(projectRoot, "apps", "terminal-chat", "index.js");

let backend = null;
let chat = null;
let shuttingDown = false;

const port = await findAvailablePort(requestedPort, maxPort);
const backendUrl = `http://localhost:${port}`;

if (port !== requestedPort) {
  console.log(`Jarvis backend port ${requestedPort} is busy; using ${port}.`);
}

backend = spawn(process.execPath, [backendScript], {
  cwd: projectRoot,
  env: {
    ...process.env,
    JARVIS_PORT: String(port),
    JARVIS_BACKEND_URL: backendUrl
  },
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
  if (!shuttingDown && !chat) {
    console.error(`Jarvis backend exited before chat started (${formatExit(code, signal)}).`);
    process.exit(code || 1);
  }
  if (!shuttingDown && chat) {
    console.error(`Jarvis backend exited while chat was running (${formatExit(code, signal)}).`);
  }
});

try {
  await waitForHealth(backendUrl);
  console.log(`Jarvis backend ready at ${backendUrl}`);
  console.log("Starting terminal chat...");

  chat = spawn(process.execPath, [chatScript], {
    cwd: projectRoot,
    env: {
      ...process.env,
      JARVIS_PORT: String(port),
      JARVIS_BACKEND_URL: backendUrl
    },
    stdio: "inherit"
  });

  chat.on("exit", (code, signal) => shutdown(code ?? signalToExitCode(signal)));

  process.on("SIGINT", () => shutdown(130));
  process.on("SIGTERM", () => shutdown(143));
  process.on("exit", () => stopBackend());
} catch (error) {
  console.error(error.message);
  stopBackend();
  process.exit(1);
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
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(portToCheck, "127.0.0.1");
  });
}

async function waitForHealth(baseUrl) {
  const deadline = Date.now() + Number(process.env.JARVIS_BACKEND_START_TIMEOUT_MS || 15000);
  while (Date.now() < deadline) {
    if (backend?.exitCode !== null) {
      throw new Error("Jarvis backend exited before it became healthy.");
    }
    if (await healthOk(`${baseUrl}/health`)) return;
    await delay(250);
  }
  throw new Error(`Jarvis backend did not become healthy at ${baseUrl}/health.`);
}

function healthOk(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(res.statusCode >= 200 && res.statusCode < 300);
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
  if (backend && backend.exitCode === null) {
    backend.kill();
  }
}

function signalToExitCode(signal) {
  if (signal === "SIGINT") return 130;
  if (signal === "SIGTERM") return 143;
  return 0;
}

function formatExit(code, signal) {
  if (signal) return signal;
  return `code ${code}`;
}
