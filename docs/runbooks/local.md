# Local Runbook

## Start Terminal Chat

```powershell
npm run chat
```

## Start API

```powershell
npm run api
```

The same command serves the web console:

```text
http://localhost:8787
```

## Ingest Project Docs

```powershell
npm run ingest -- docs
```

Rebuild instead of appending:

```powershell
npm run memory:rebuild -- docs
```

## Run Tests

```powershell
npm test
```

## Run Doctor

```powershell
npm run doctor
```

## Inspect Backend Docks

```powershell
npm run docks
npm run docks -- test tools.registry
```

## Check Backend Readiness

```text
GET http://localhost:8787/ready
GET http://localhost:8787/backend
```

Inside terminal chat:

```text
/ready
/backend
```

## Memory Operations

```powershell
npm run ingest -- docs
npm run memory:rebuild -- docs
```

Inside terminal chat:

```text
/memory policy
/memory-stats
/compact-memory
/rebuild-memory docs
/doctor
/docks
/dock test memory.local-jsonl
/ready
/backend
/engine
/metrics
/session new bug hunt
/history
/runs
```

## Enable Search

Set one provider key:

```powershell
$env:BRAVE_SEARCH_API_KEY="..."
```

Search prompts are approval-gated because they call an external service.

## Enable A Hosted Model

```powershell
$env:OPENAI_API_KEY="..."
$env:OPENAI_MODEL="gpt-4.1-mini"
```

Optional hosted embeddings:

```powershell
$env:OPENAI_EMBEDDING_MODEL="text-embedding-3-small"
```

## Enable Ollama

```powershell
$env:OLLAMA_BASE_URL="http://localhost:11434"
$env:OLLAMA_MODEL="llama3.1"
```
