# MediMind — Healthcare RAG Chatbot & AI Agent

> A production-style, polyglot microservices project that teaches modern GenAI
> patterns: **Retrieval-Augmented Generation (RAG)** and **LangGraph ReAct
> agents** — grounded in a healthcare Q&A use case.

Built with **FastAPI + LangChain + LangGraph + ChromaDB + Claude AI**, fronted
by a **.NET 8 API gateway** with **Redis caching**, all containerized with
**Docker Compose** and shipped through **GitHub Actions**.

> **Disclaimer** — This project is for **learning and demo purposes only**. It
> is **not** a medical device and must not be used for real clinical decisions.

---

## Table of contents

1. [What you will learn](#1-what-you-will-learn)
2. [Tech stack](#2-tech-stack)
3. [Architecture](#3-architecture)
4. [Repository layout](#4-repository-layout)
5. [Prerequisites](#5-prerequisites)
6. [Quick start (Docker)](#6-quick-start-docker)
7. [Using the app](#7-using-the-app)
8. [Running services locally (without Docker)](#8-running-services-locally-without-docker)
9. [Customizing the knowledge base](#9-customizing-the-knowledge-base)
10. [Troubleshooting](#10-troubleshooting)
11. [Learning resources in this repo](#11-learning-resources-in-this-repo)
12. [Roadmap / extend it](#12-roadmap--extend-it)

---

## 1. What you will learn

By reading the code, docs, and running the app you will pick up:

- **RAG end-to-end** — chunking, embeddings, vector search, grounded prompting.
- **AI agents (ReAct pattern)** — tool calling, LangGraph state machines, traces.
- **Polyglot microservices** — Python ML service behind a .NET gateway.
- **API gateway pattern** — caching, retries with Polly, orchestration.
- **Containerization** — multi-service Docker Compose with volumes and healthchecks.
- **CI/CD** — GitHub Actions building, testing, and smoke-testing the stack.
- **LLM cost/latency control** — Redis-backed response caching with TTLs.

See [docs/AGENTS.md](docs/AGENTS.md) for a deep dive on agents and
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for service-level design notes.

---

## 2. Tech stack

### Python RAG service — [fastapi-rag-service/](fastapi-rag-service/)

| Library | Purpose |
|---|---|
| **FastAPI** | HTTP framework, auto-generated Swagger, Pydantic validation |
| **LangChain** | Standard interfaces for LLMs, embeddings, vector stores |
| **LangGraph** | Stateful graph runtime for the ReAct agent |
| **langchain-anthropic** | Claude client for LangChain |
| **ChromaDB** | Local, persistent vector database (HNSW under the hood) |
| **sentence-transformers** (`all-MiniLM-L6-v2`) | 384-dim CPU-friendly embeddings |
| **pypdf / unstructured** | Load PDFs and other document formats |
| **tenacity / httpx** | Retries and async HTTP |

Full pinned versions in [fastapi-rag-service/requirements.txt](fastapi-rag-service/requirements.txt).

### .NET Gateway — [dotnet-gateway/](dotnet-gateway/)

| Library | Purpose |
|---|---|
| **ASP.NET Core 8** | Web API, DI, config, minimal hosting |
| **StackExchange.Redis** | Redis client for response caching |
| **Polly** + `Microsoft.Extensions.Http.Polly` | Retry with exponential backoff on `HttpClient` |
| **Swashbuckle.AspNetCore** | Swagger UI at `/swagger` |

Full package list in [dotnet-gateway/MediMind.Gateway.csproj](dotnet-gateway/MediMind.Gateway.csproj).

### Infrastructure

| Piece | Role |
|---|---|
| **Docker & Docker Compose** | Orchestrate all three services locally |
| **Redis 7 (alpine)** | Sub-millisecond response cache (SHA-256 keyed, 1h TTL) |
| **GitHub Actions** | Lint + build + docker-compose smoke test on every push |
| **Claude Opus 4.7 (Anthropic API)** | The LLM that generates answers |

---

## 3. Architecture

```
   ┌──────────────┐   HTTP    ┌─────────────────────┐   HTTP   ┌────────────────┐
   │   You /      │──────────▶│   .NET 8 Gateway    │─────────▶│  FastAPI RAG   │
   │   Frontend   │  :5000    │   (auth, caching,   │  :8000   │  (LangChain +  │
   │              │           │    orchestration)   │          │   ChromaDB)    │
   └──────────────┘           └──────────┬──────────┘          └───────┬────────┘
                                         │                             │
                                         ▼                             ▼
                                   ┌───────────┐                 ┌────────────┐
                                   │   Redis   │                 │  Claude AI │
                                   │  (cache)  │                 │  (LLM API) │
                                   └───────────┘                 └────────────┘
```

**Why two backends?** The .NET gateway owns cross-cutting concerns (caching,
rate limiting, auth). The Python FastAPI service owns the ML/RAG work. This is
a common real-world pattern — pick the language best suited to each job.

**Two endpoints, two mental models:**

| Endpoint | Behaviour |
|---|---|
| `POST /api/chat` (RAG) | Fixed pipeline: embed → search → generate. One LLM call. |
| `POST /api/agent` (Agent) | LangGraph ReAct loop: LLM picks tools (`emergency_triage`, `search_medical_docs`, `check_drug_interaction`, `list_available_topics`) and iterates until done. |

---

## 4. Repository layout

```
MediMind/
├── docker-compose.yml            # Orchestrates all 3 services
├── .env.example                  # Copy to .env and fill in secrets
├── .gitignore
├── MediMind.sln
├── README.md                     # You are here
│
├── .github/workflows/
│   └── ci-cd.yml                 # Lint, build, docker-compose smoke test
│
├── docs/
│   ├── AGENTS.md                 # Deep dive on LangGraph agents & ReAct
│   └── ARCHITECTURE.md           # Service boundaries, failure modes
│
├── fastapi-rag-service/          # Python RAG + Agent service
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── seed_data.py              # Loads sample docs into ChromaDB
│   └── app/
│       ├── main.py               # FastAPI entry point
│       ├── config.py             # Env-driven settings (pydantic-settings)
│       ├── agents/               # LangGraph ReAct agent + tools
│       ├── models/               # Pydantic request/response schemas
│       ├── routers/              # /chat, /agent-chat, /documents/*
│       ├── services/             # vector_store, claude_service, rag_service
│       └── data/medical_docs/    # Sample medical documents
│
└── dotnet-gateway/               # .NET 8 API Gateway
    ├── Dockerfile
    ├── MediMind.Gateway.csproj
    ├── Program.cs                # Startup, DI, Polly retry policy
    ├── appsettings.json
    ├── Controllers/
    │   ├── ChatController.cs     # POST /api/chat
    │   └── AgentController.cs    # POST /api/agent
    ├── Services/
    │   ├── RagServiceClient.cs   # Typed HttpClient to FastAPI
    │   └── CacheService.cs       # Redis wrapper
    └── Models/
```

---

## 5. Prerequisites

**For the Docker path (recommended):**

- **Docker Desktop** (Windows/macOS/Linux) — running and allocated ≥ 4 GB RAM
- **Anthropic API key** — grab one at https://console.anthropic.com/settings/keys
- **Git**

**For local (non-Docker) development, additionally:**

- **Python 3.11+**
- **.NET 8 SDK**
- **Redis** running locally on port 6379 (`redis-server` or a Docker container)

---

## 6. Quick start (Docker)

### Step 1 — Clone and configure

```bash
git clone https://github.com/<your-user>/MediMind.git
cd MediMind
cp .env.example .env
```

Open [.env](.env) and set your real Anthropic API key:

```env
ANTHROPIC_API_KEY=sk-ant-...your-key...
```

> `.env` is git-ignored — never commit it. See [.gitignore](.gitignore).

### Step 2 — Build and start all services

```bash
docker compose up --build
```

The first run takes several minutes (image pulls, pip install, embedding model
download). Wait for:

```
medimind-rag       | INFO:     Uvicorn running on http://0.0.0.0:8000
medimind-gateway   | Now listening on: http://0.0.0.0:5000
```

### Step 3 — Seed the vector store

In a second terminal:

```bash
docker compose exec fastapi-rag python seed_data.py
```

Expected output:

```
Ingested 6 docs -> ~30 chunks
Total in collection: ~30
```

### Step 4 — Verify

| URL | What it is |
|---|---|
| http://localhost:5000/swagger | .NET Gateway Swagger UI |
| http://localhost:8000/docs | FastAPI Swagger UI |
| http://localhost:5000/api/chat/health | Gateway → RAG health probe |

### Step 5 — Stop / clean up

```bash
docker compose down          # stop containers, keep volumes
docker compose down -v       # ALSO wipe ChromaDB + Redis volumes
```

---

## 7. Using the app

### RAG chat (through the gateway — cached)

```bash
curl -X POST http://localhost:5000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"query": "What is stage 2 hypertension and how is it treated?"}'
```

Sample response:

```json
{
  "answer": "Stage 2 hypertension is defined as blood pressure ≥ 140/90 mmHg [Hypertension]. First-line treatment includes... Please consult a licensed physician before starting or changing medication.",
  "sources": [
    { "content": "Stages (per ACC/AHA 2017 guidelines)...", "metadata": {"title": "Hypertension"}, "score": 0.24 }
  ],
  "model": "claude-opus-4-7",
  "cacheHit": false
}
```

Run it a second time — `cacheHit: true` and it returns in milliseconds.

### Agent chat (ReAct loop with tool trace)

```bash
curl -X POST http://localhost:5000/api/agent \
  -H "Content-Type: application/json" \
  -d '{"query": "Can my 78-year-old mother on warfarin take ibuprofen?"}'
```

Try these queries to exercise different tool paths:

| Query | Expected tool path |
|---|---|
| `"I have severe chest pain"` | `emergency_triage` → stop |
| `"What are symptoms of asthma?"` | `search_medical_docs` |
| `"Can I take amiodarone with digoxin?"` | `check_drug_interaction` |
| `"What can you help me with?"` | `list_available_topics` |

The response includes a full `trace` of Human/AI/Tool messages — great for
learning how the agent thinks. Full walkthrough in [docs/AGENTS.md](docs/AGENTS.md).

### Ingest your own documents

Raw text:

```bash
curl -X POST http://localhost:8000/documents/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "documents": ["Your medical text here..."],
    "metadatas": [{"title": "My Custom Doc", "source": "internal"}]
  }'
```

Or upload a `.txt` file:

```bash
curl -X POST http://localhost:8000/documents/upload \
  -F "file=@my_medical_notes.txt"
```

---

## 8. Running services locally (without Docker)

Useful when you want fast iteration on a single service.

### Redis

```bash
docker run --rm -p 6379:6379 redis:7-alpine
```

### FastAPI RAG service

```bash
cd fastapi-rag-service
python -m venv .venv
source .venv/bin/activate         # Windows: .venv\Scripts\activate
pip install -r requirements.txt

export ANTHROPIC_API_KEY=sk-ant-...
export CHROMA_PERSIST_DIR=./chroma_db

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
python seed_data.py               # in another terminal
```

### .NET Gateway

```bash
cd dotnet-gateway
dotnet restore
dotnet run
```

When running the gateway outside Docker, point it at the local RAG service:

```bash
export RAG_SERVICE_URL=http://localhost:8000
export REDIS_HOST=localhost
```

---

## 9. Customizing the knowledge base

Drop new `.txt` files into
[fastapi-rag-service/app/data/medical_docs/](fastapi-rag-service/app/data/medical_docs/)
and rerun the seeder:

```bash
docker compose exec fastapi-rag python seed_data.py
```

Each document is split into ~800-character chunks with 120-character overlap.

Tune knobs in [fastapi-rag-service/app/config.py](fastapi-rag-service/app/config.py):

- `top_k_results` — how many chunks retrieved per query
- `embedding_model` — swap in a bigger / multilingual model
- `claude_model` — e.g. `claude-sonnet-4-6` for lower cost

---

## 10. Troubleshooting

| Symptom | Cause / Fix |
|---|---|
| `ANTHROPIC_API_KEY is not set` | You didn't create `.env` from `.env.example`. `docker compose down && up`. |
| Answers say *"I don't have information about that..."* | You skipped the seed step. Run `docker compose exec fastapi-rag python seed_data.py`. |
| `Cache SET failed` warnings | Redis not healthy yet — wait ~10 s. Check `docker compose logs redis`. |
| FastAPI container OOM-killed on first boot | Embedding model download spikes memory. Give Docker Desktop ≥ 4 GB. |
| Gateway can't reach RAG service | Inside Docker, use hostname `fastapi-rag`. If running gateway outside Docker, set `RAG_SERVICE_URL=http://localhost:8000`. |
| Chroma persistence weird after schema tweaks | `docker compose down -v` to nuke the volume, then re-seed. |

More failure modes and mitigations in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## 11. Learning resources in this repo

Read them in this order:

1. **This README** — set up the stack, run a query, see it work.
2. **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — service boundaries, data
   flow, failure modes, security.
3. **[docs/AGENTS.md](docs/AGENTS.md)** — from "what is an agent?" through the
   ReAct pattern, LangGraph, tool calling, and how our MediMind agent is built.
4. **Code walkthrough** —
   [rag_service.py](fastapi-rag-service/app/services/rag_service.py) →
   [vector_store.py](fastapi-rag-service/app/services/vector_store.py) →
   [agents/](fastapi-rag-service/app/agents/) →
   [Program.cs](dotnet-gateway/Program.cs) →
   [CacheService.cs](dotnet-gateway/Services/CacheService.cs).

---

## 12. Roadmap / extend it

Great next steps to keep learning:

- **Frontend** — React or Blazor chat UI on top of `/api/chat` and `/api/agent`.
- **Streaming** — flip Claude to `stream=True` and pipe tokens through the
  gateway with Server-Sent Events.
- **Auth** — JWT-based auth on the .NET gateway.
- **Conversation memory** — thread `conversation_id`, keep history in Redis.
- **Better embeddings** — `BAAI/bge-large-en-v1.5` or Anthropic's Voyage.
- **Hybrid search** — combine vector similarity with BM25 for drug names / ICD codes.
- **Evaluation harness** — a set of gold Q&A pairs; measure recall@k and hallucination rate.
- **Observability** — OpenTelemetry traces across gateway ↔ RAG ↔ Claude.
- **Cloud deploy** — push images to `ghcr.io`; deploy to Azure Container Apps or AWS ECS.

---

## License & attribution

Learning project — use freely for study and experimentation. No warranty; not
for clinical use. Sample medical text is public reference material only.
