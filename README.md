# Jarvis AI Platform MVP

Jarvis is a local-first AI operating layer scaffolded from the attached blueprint. It starts with a practical milestone: terminal chat, a small agent loop, model routing, permission-gated tools, chunking memory, workflows, web search hooks, and auditable execution.

This MVP uses only Node.js built-ins, so no package install is required.

## Quick Start

```powershell
npm run chat
```

Open the web console/API:

```powershell
npm run console
```

Inspect backend docks:

```powershell
npm run docks
npm run docks -- test memory.local-jsonl
```

Rebuild the memory index:

```powershell
npm run memory:rebuild -- docs
```

Then visit:

```text
http://localhost:8787
```

Useful terminal commands:

```text
/help
/tools
/ingest docs
/memory architecture
/memory-stats
/compact-memory
/doctor
/docks
/dock test memory.local-jsonl
/engine
/metrics
/session new project work
/runs
read README.md
list .
dry run npm ci
analyze command git reset --hard HEAD
run npm test
research current Node.js LTS
search current Node.js LTS
```

Search requires `BRAVE_SEARCH_API_KEY` or `TAVILY_API_KEY` in `.env` or your shell environment. Hosted model use requires `OPENAI_API_KEY`; local model use can point to Ollama with `OLLAMA_BASE_URL`.

## API Server

```powershell
npm run api
```

Endpoints:

```text
GET  /health
GET  /providers
GET  /tools
GET  /doctor
GET  /docking
POST /docking/:id/test
GET  /engine
GET  /metrics
POST /chat    { "message": "read README.md" }
POST /ingest  { "path": "docs" }
GET  /approvals
POST /approvals/:id { "approved": true }
GET  /sessions
POST /sessions { "title": "My session" }
GET  /sessions/:id
GET  /runs
POST /memory/query  { "query": "policy", "filters": { "extension": ".md" } }
GET  /memory/stats
POST /memory/compact
POST /memory/rebuild { "path": "docs" }
```

## What Is Built

- Terminal chat UX with modes, command history, tool status, and approval prompts.
- Agent orchestrator with planning, workflow selection, memory retrieval, and tool execution.
- Model router with OpenAI-compatible, Ollama, and offline local draft providers.
- File tools, shell tool, web search tool, and memory ingestion/query tools.
- API approval queue for risky actions requested outside the terminal.
- Web console for chat, approvals, memory search, and tool inventory.
- Doctor diagnostics, saved sessions, and run history.
- Backend Docking Station for model, search, memory, tool, session, run, approval, API, and console docks.
- Reasoning engine with task traits, evidence needs, risk notes, answer contracts, and logic graphs.
- Search engine with query planning, result dedupe, source ranking, source fetching, snippets, and citations.
- Structured answer formatter for clearer tool results, caveats, evidence, and next steps.
- Metrics store for backend timing, tool durations, cache visibility, and performance summaries.
- Policy engine with risk tiers, approval gates, dangerous action blocking, and audit logs.
- Chunking pipeline with metadata, line citations, hashing, local embeddings, filters, compaction, rebuilds, and persistent JSONL memory.
- Workflow templates for code changes, research, debugging, ingestion, OS downloads, security review, and deployment.
- Built-in test suite using `node --test`.

## Safety Defaults

Jarvis treats tools as capabilities that need policy checks.

```text
Tier 0: read-only actions
Tier 1: local safe writes and tests
Tier 2: network/package actions, approval required
Tier 3: system actions, approval required
Tier 4: dangerous actions, blocked by default
```

Audit events are stored in `.jarvis/logs/audit.jsonl`.

Pending API approvals are stored in `.jarvis/approvals/queue.json`.

Saved sessions live in `.jarvis/sessions/`, and agent runs are tracked in `.jarvis/runs/runs.jsonl`.

The latest Backend Docking Station report is stored at `.jarvis/docking/last-report.json`.
