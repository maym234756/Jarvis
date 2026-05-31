# Jarvis Architecture Overview

Jarvis is structured as an AI operating layer rather than a single chatbot.

```text
Terminal UX / Web Console / API
  -> Backend Kernel + Supervisor
  -> Agent Orchestrator
  -> Workflow Engine
  -> Model Router
  -> Tool Runtime
  -> Policy Engine
  -> File, Shell, Search, Memory Tools
  -> Chunking + Project Memory
  -> Audit Logs
  -> Sessions + Run History + Doctor
  -> Backend Docking Station
  -> Reasoning Engine + Search Engine + Answer Contracts
  -> Metrics + Caches
```

## MVP Boundaries

The current build is local-first and dependency-free. Hosted LLMs, local model servers, and search providers are optional integrations configured through environment variables.

The API server also serves a web console at `http://localhost:8787` with chat, approvals, memory search, tool inventory, doctor checks, saved sessions, and run history views.

## Backend Kernel

Shared local surfaces now boot through a backend kernel so the API server, terminal chat, doctor script, and docking script construct the same stores, engines, tools, policy layers, eval runner, docking station, agent, and supervisor.

The backend supervisor reports:

- required service readiness
- degraded optional or configuration-dependent service states
- dependency topology edges between backend components
- tool/runtime/store details for debugging wiring issues

Primary surfaces:

```text
GET /ready
GET /backend
/ready
/backend
backend.ready
backend.status
```

## Model Routing

The router chooses the safest available provider:

- `private` privacy prefers Ollama when configured.
- non-private requests use OpenAI-compatible hosting when `OPENAI_API_KEY` is available.
- otherwise Jarvis uses the local draft provider so tools and workflows still work.

## Tool Runtime

Tools are explicit capabilities with risk levels. The registry asks the policy engine before execution, requests approval when needed, and writes audit events for started, completed, denied, pending, blocked, and failed runs.

Terminal requests can prompt inline. API requests are queued with an approval id and can be approved through `POST /approvals/:id` or from the web console.

## Memory

Memory is stored as JSONL chunks with source metadata, line ranges, citations, local hash embeddings by default, and optional OpenAI-compatible embeddings when `OPENAI_EMBEDDING_MODEL` is configured.

The memory store supports:

- metadata filters
- source citations
- compacting duplicate chunks
- rebuilding the index from a path
- stats for chunks, sources, docs, tokens, and index size

## Operations

Every agent call can be attached to a session and recorded as a run. Sessions are JSON files under `.jarvis/sessions/`; run history is JSONL under `.jarvis/runs/runs.jsonl`.

Doctor checks summarize provider configuration, memory status, registered tools, approvals, sessions, and runs.

## Backend Docking Station

The docking station is Jarvis's backend hub. It inventories the local runtime, API server, web console, model providers, embedding providers, search providers, local memory, tool registry, approval queue, sessions, and run history.

Each dock includes:

- stable id
- backend type
- configured status
- health state
- endpoint or local path
- capabilities
- relevant environment keys
- setup guidance
- optional live test

Primary surfaces:

```text
npm run docks
/docks
/dock test <dock-id>
GET /docking
POST /docking/:id/test
```

## Reasoning Engine

The reasoning engine builds a structured frame before tool execution:

- task traits
- assumptions
- constraints
- evidence needs
- risks
- answer contract
- logic graph

This frame is returned from agent responses, stored with run context, and passed to the model router so hosted/local models receive a consistent answer contract.

## Search Engine

The search engine is designed for more precise research answers:

- generates query variants
- deduplicates URLs
- scores source authority and term coverage
- prefers primary/official sources when possible
- fetches top sources after approval
- extracts query-adjacent snippets
- returns citations and precision metadata

Live search still requires `BRAVE_SEARCH_API_KEY` or `TAVILY_API_KEY`.

## Performance

Jarvis now tracks timing and cache state for backend work:

- memory JSONL cache
- search result/source cache
- tool duration metrics
- metrics summary endpoint
- metrics dock in the Backend Docking Station

Primary surfaces:

```text
/metrics
GET /metrics
GET /engine
```
