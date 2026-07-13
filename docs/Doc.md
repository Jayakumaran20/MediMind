# MediMind — Healthcare RAG Chatbot

A production-style Retrieval-Augmented Generation (RAG) chatbot **plus a
LangGraph ReAct agent** for healthcare Q&A. Built with **FastAPI + LangChain
+ LangGraph + ChromaDB + Claude AI**, fronted by a **.NET 8 API gateway**
with **Redis caching**, all containerized with **Docker** and shipped via
**GitHub Actions**.

> 📚 **Learning-focused project.** For an in-depth tutorial on the agent
> parts, see [docs/AGENTS.md](docs/AGENTS.md).

> ⚠️ This project is for **learning and demo purposes only**. It is **not**
> a medical device and must not be used for real clinical decisions.

---

## Table of contents

1. [What this project does](#1-what-this-project-does)
2. [Architecture at a glance](#2-architecture-at-a-glance)
3. [The concepts, explained for learners](#3-the-concepts-explained-for-learners)
   - 3.1 [What is RAG?](#31-what-is-rag)
   - 3.2 [Embeddings & vector search](#32-embeddings--vector-search)
   - 3.3 [ChromaDB](#33-chromadb)
   - 3.4 [LangChain](#34-langchain)
   - 3.5 [Claude AI](#35-claude-ai)
   - 3.6 [FastAPI](#36-fastapi)
   - 3.7 [.NET Core API gateway pattern](#37-net-core-api-gateway-pattern)
   - 3.8 [Redis caching](#38-redis-caching)
   - 3.9 [Docker & docker-compose](#39-docker--docker-compose)
   - 3.10 [GitHub Actions CI/CD](#310-github-actions-cicd)
4. [Project structure](#4-project-structure)
5. [Prerequisites](#5-prerequisites)
6. [Setup & run](#6-setup--run)
7. [Using the app](#7-using-the-app)
8. [How a single question flows through the system](#8-how-a-single-question-flows-through-the-system)
9. [Customizing the knowledge base](#9-customizing-the-knowledge-base)
10. [Troubleshooting](#10-troubleshooting)
11. [Where to go next](#11-where-to-go-next)

---

## 1. What this project does

You type a medical question like:

> *"What is stage 2 hypertension and what's the first-line treatment?"*

The system:

1. Converts your question into a mathematical vector (an **embedding**).
2. Searches a **vector database (ChromaDB)** for the medical documents that
   are semantically most similar to your question.
3. Feeds those documents + your question to **Claude AI** as context.
4. Claude answers using ONLY that context (this is the "grounding" — it stops
   the model from making things up).
5. Returns the answer + the source snippets so you can verify it.

If you ask the same question twice, the second call is served from **Redis
cache** in milliseconds.

---

## 2. Architecture at a glance

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

**Why two backends?**
The .NET gateway handles cross-cutting concerns (caching, rate limiting,
auth). The Python FastAPI service does the actual ML/RAG work. This is a
common real-world pattern — polyglot microservices, each in the language
best-suited to the job.

---

## 3. The concepts, explained for learners

### 3.1 What is RAG?

**Retrieval-Augmented Generation** = *look things up, then let the LLM write
the answer*.

A raw LLM (like Claude) only knows what it was trained on. Ask it about
*your* company's medical protocol PDF and it has no idea. Two options:

- **Fine-tune** the LLM on your data — expensive, slow, hard to update.
- **RAG** — keep the LLM frozen, but at query time, **retrieve** the relevant
  chunks from your own documents and **stuff** them into the prompt as
  context. The LLM answers from that context.

RAG is now the dominant pattern for building chatbots on top of private
knowledge bases.

**Why it matters for healthcare:** hallucinations (LLMs inventing facts) are
unacceptable when a wrong dosage could hurt someone. RAG forces the model
to cite real documents, and if the answer isn't in the corpus, we make it
say "I don't know."

### 3.2 Embeddings & vector search

An **embedding** is a list of numbers (a vector) that represents the meaning
of a piece of text. Two texts with similar meaning have vectors that are
**close together** in high-dimensional space.

Example:
- `"blood pressure"` → `[0.11, -0.82, 0.34, ..., 0.09]` (384 numbers)
- `"hypertension"` → `[0.13, -0.79, 0.31, ..., 0.11]`
- `"pizza recipe"` → `[-0.55, 0.20, -0.61, ..., 0.44]`

The first two are near each other; the third is far away.

**Vector search** = given a query vector, find the K nearest document
vectors. This is how the system knows a question about "high blood pressure"
should retrieve the "hypertension" document.

We use **`sentence-transformers/all-MiniLM-L6-v2`** — a small, fast,
open-source embedding model that runs on CPU. Good enough for learning; in
production you might use OpenAI/Cohere/Voyage embeddings or Anthropic's
Voyage.

### 3.3 ChromaDB

A **vector database** designed to store embeddings and do fast similarity
search. Alternatives: Pinecone (SaaS), Weaviate, Qdrant, pgvector (Postgres
extension), FAISS (library).

We picked Chroma because:
- Runs locally, no external service required
- Persistent to disk (a folder in your project)
- Simple Python API, native LangChain integration

Under the hood it uses HNSW (Hierarchical Navigable Small World) — an
approximate nearest neighbor index that trades tiny accuracy loss for
huge speed gains.

### 3.4 LangChain

An SDK that glues LLM apps together. It provides standard interfaces for:
- LLMs (`ChatAnthropic`, `ChatOpenAI`, ...)
- Vector stores (`Chroma`, `Pinecone`, ...)
- Embeddings (`HuggingFaceEmbeddings`, ...)
- Document loaders, text splitters, chains, agents.

You *could* write the same code without LangChain by calling Claude's HTTP
API and Chroma's Python client directly. LangChain saves boilerplate and
makes it easy to swap components (change one line to switch from Chroma to
Pinecone).

### 3.5 Claude AI

Anthropic's family of LLMs. We use `claude-opus-4-7` (their most capable
model as of this project). Claude is a good fit for healthcare demos
because it's tuned to be careful about safety and to follow instructions
precisely (like "answer only from the given context").

You get an API key from https://console.anthropic.com/, put it in `.env`,
and the `langchain-anthropic` package handles the HTTP calls.

### 3.6 FastAPI

A modern Python web framework. What it gives us:
- Automatic OpenAPI/Swagger docs at `/docs`
- Pydantic request/response validation (type-safe request bodies)
- Async endpoints, fast (built on Starlette + uvicorn)
- Clean dependency injection

Our RAG service exposes:
- `POST /chat` — ask a question
- `POST /documents/ingest` — add raw text docs
- `POST /documents/upload` — upload a .txt file
- `GET /documents/count` — how many chunks are in the store
- `GET /health` — health check

### 3.7 .NET Core API gateway pattern

An **API Gateway** is a single entry point that sits in front of one or more
backend services. Common jobs:

- Authentication / authorization
- Rate limiting
- Caching (what we do here)
- Request/response transformation
- Aggregating multiple backend calls
- Logging & metrics

Real production systems have gateways like Kong, AWS API Gateway, or
Ocelot. Here we build a **minimal custom one in ASP.NET Core 8**, which
is a common pattern in enterprise .NET shops. It:

1. Receives the chat request from the client.
2. Hashes the query and checks Redis for a cached response.
3. If missing, forwards to the FastAPI RAG service via `HttpClient`.
4. Stores the response back in Redis with a TTL.
5. Uses **Polly** for automatic retry with exponential backoff — if the
   RAG service blips, the gateway retries transparently.

### 3.8 Redis caching

Redis is an in-memory key-value store — sub-millisecond reads. We cache
the entire `ChatResponse` keyed by a SHA-256 hash of the normalized query.

Why:
- LLM calls cost money and take seconds.
- Many users ask similar questions.
- A 1-hour TTL means "answer this identical question fast for the next hour."

Cache key format: `chat:<first-16-hex-chars-of-SHA256>`.

### 3.9 Docker & docker-compose

**Docker** packages each service (Python app, .NET app, Redis) into an
isolated container with its own dependencies. No "works on my machine" pain.

**docker-compose** orchestrates multiple containers as a single app.
`docker compose up` starts Redis, the FastAPI service, and the .NET
gateway together, wires them onto a shared network, and mounts persistent
volumes so ChromaDB and Redis data survive restarts.

### 3.10 GitHub Actions CI/CD

Every push to `main` or `develop` triggers `.github/workflows/ci-cd.yml`:

1. Lint & compile-check the Python service.
2. Restore & build the .NET service.
3. Build both Docker images.
4. Run a smoke test with docker-compose.

Extend it to publish images to a registry (ghcr.io) and deploy to a cluster
when you're ready.

---

## 4. Project structure

```
MediMind/
├── docker-compose.yml            # Orchestrates all 3 services
├── .env.example                  # Copy to .env and fill in secrets
├── .github/workflows/ci-cd.yml   # GitHub Actions pipeline
│
├── fastapi-rag-service/          # Python RAG service
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── seed_data.py              # Loads sample docs into ChromaDB
│   └── app/
│       ├── main.py               # FastAPI app entry point
│       ├── config.py             # Env-driven settings
│       ├── models/schemas.py     # Pydantic request/response types
│       ├── routers/
│       │   ├── chat.py           # POST /chat
│       │   └── documents.py      # POST /documents/{ingest,upload}
│       ├── services/
│       │   ├── vector_store.py   # ChromaDB wrapper
│       │   ├── claude_service.py # Claude client (via LangChain)
│       │   ├── rag_service.py    # The orchestrator: retrieve + generate
│       │   └── document_loader.py# File loading & chunk splitting
│       └── data/medical_docs/    # Sample medical documents
│
└── dotnet-gateway/               # .NET 8 API Gateway
    ├── Dockerfile
    ├── MediMind.Gateway.csproj
    ├── Program.cs                # Startup, DI, Polly retry policy
    ├── appsettings.json
    ├── Controllers/ChatController.cs
    ├── Services/
    │   ├── RagServiceClient.cs   # Typed HttpClient to FastAPI
    │   └── CacheService.cs       # Redis wrapper
    └── Models/ChatModels.cs
```

---

## 5. Prerequisites

- **Docker Desktop** installed and running (Windows/macOS/Linux)
- **Anthropic API key** from https://console.anthropic.com/settings/keys
- (Optional, only if running services outside Docker):
  - Python 3.11+
  - .NET 8 SDK
  - Redis (local)

---

## 6. Setup & run

### Step 1 — Clone & configure

```bash
# From the MediMind directory
cp .env.example .env
```

Open `.env` and put your real Anthropic API key in `ANTHROPIC_API_KEY`.

> **Never commit `.env`**. It's in `.gitignore` already.

### Step 2 — Start everything with Docker

```bash
docker compose up --build
```

First run takes several minutes: Docker downloads base images, installs
Python/dotnet packages, and the FastAPI container downloads the embedding
model on first boot.

Wait until you see:
```
medimind-rag       | INFO:     Uvicorn running on http://0.0.0.0:8000
medimind-gateway   | Now listening on: http://0.0.0.0:5000
```

### Step 3 — Seed the vector store with sample medical documents

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

- FastAPI Swagger: http://localhost:8000/docs
- .NET Gateway Swagger: http://localhost:5000/swagger
- Health check: http://localhost:5000/api/chat/health

---

## 7. Using the app

### Ask a question through the .NET gateway (recommended path)

```bash
curl -X POST http://localhost:5000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"query": "What is stage 2 hypertension and how is it treated?"}'
```

Response:

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

Run it again — this time `cacheHit: true` and it returns in milliseconds.

### Direct call to the FastAPI service (bypass gateway)

```bash
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"query": "What are the classic symptoms of type 2 diabetes?"}'
```

### Ask the AGENT instead of plain RAG

The agent version (`/api/agent` or direct `/agent-chat`) lets Claude choose
which tools to call — emergency triage, vector search, drug-interaction
lookup, or topic listing — and returns the full step-by-step **trace**.

```bash
curl -X POST http://localhost:5000/api/agent \
  -H "Content-Type: application/json" \
  -d '{"query": "Can my 78-year-old mother on warfarin take ibuprofen?"}'
```

Response includes:
```json
{
  "answer": "Warfarin and ibuprofen have a documented interaction...",
  "trace": [
    { "type": "HumanMessage", "content": "..." },
    { "type": "AIMessage", "toolCalls": [{"name": "check_drug_interaction", ...}] },
    { "type": "ToolMessage", "tool": "check_drug_interaction", "content": "..." },
    { "type": "AIMessage", "content": "Final answer here..." }
  ],
  "toolCallCount": 1,
  "steps": 4,
  "model": "claude-opus-4-7"
}
```

Try these to see different agent paths:
- `"I have severe chest pain"` → agent calls `emergency_triage` first, stops.
- `"What are symptoms of asthma?"` → agent calls `search_medical_docs`.
- `"Can I take amiodarone with digoxin?"` → agent calls `check_drug_interaction`.
- `"What can you help me with?"` → agent calls `list_available_topics`.

**👉 Read [docs/AGENTS.md](docs/AGENTS.md) for the full explanation of
agents, ReAct, tool calling, LangGraph, and safety guardrails.**

### Add your own documents

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

## 8. How a single question flows through the system

```
1. Client            POST /api/chat  {"query": "What is stage 2 hypertension?"}
                              │
                              ▼
2. .NET Gateway      Hash query → cache key: chat:a3f9b2c1d4e5f678
                     Check Redis: MISS
                              │
                              ▼
3. Gateway           HTTP POST http://fastapi-rag:8000/chat  (with Polly retry)
                              │
                              ▼
4. FastAPI /chat     rag_service.answer(query, k=4)
                              │
                              ▼
5. VectorStore       embeddings.embed("What is stage 2 hypertension?")
                                     → [0.11, -0.82, 0.34, ...]
                     chroma.similarity_search(vector, k=4)
                                     → 4 chunks about hypertension
                              │
                              ▼
6. ClaudeService     System: "Answer only from <context>. Cite sources..."
                     Human:  "<context> ... </context>  Question: What is..."
                                     → HTTP call to api.anthropic.com
                              │
                              ▼
7. Response          {answer, sources[], model} bubbles back up
                              │
                              ▼
8. Gateway           SET redis chat:a3f9... = <response> EX 3600
                     Return to client
```

The **first** call takes 2-5 seconds (Claude API round trip).
The **second** identical call returns in 5-20 ms (Redis hit).

---

## 9. Customizing the knowledge base

Drop new `.txt` files into `fastapi-rag-service/app/data/medical_docs/` and
rerun the seeder:

```bash
docker compose exec fastapi-rag python seed_data.py
```

Or ingest via the API (Step 3 examples above). Each document is split into
~800-character chunks with 120-character overlap — small enough for
precise retrieval, overlapping so semantic units aren't cut in half.

Tune in [app/config.py](fastapi-rag-service/app/config.py):
- `top_k_results` — how many chunks retrieved per query
- `embedding_model` — swap for a bigger multilingual one
- `claude_model` — switch to `claude-sonnet-4-6` for lower cost

---

## 10. Troubleshooting

**"ANTHROPIC_API_KEY is not set"**
→ You didn't create `.env` from `.env.example`, or Docker didn't pick it up.
Restart with `docker compose down && docker compose up`.

**"Cache SET failed" warnings**
→ Redis container isn't healthy yet. Wait ~10 seconds after startup. If it
persists, check `docker compose logs redis`.

**Answers say "I don't have information about that in my medical knowledge base"**
→ You didn't seed the docs. Run `docker compose exec fastapi-rag python seed_data.py`.

**FastAPI container OOM-killed during first boot**
→ Embedding model download can spike memory. Increase Docker Desktop memory
allocation to 4 GB+.

**.NET gateway can't reach RAG service**
→ Inside Docker, use hostname `fastapi-rag` (not `localhost`). This is set
in docker-compose already; if you're running the gateway outside Docker,
set `RAG_SERVICE_URL=http://localhost:8000`.

---

## 11. Where to go next

Ideas to extend this as a learning project:

- **Frontend**: build a React or Blazor chat UI that talks to `/api/chat`.
- **Streaming**: switch Claude call to `stream=True` and stream tokens through
  the gateway with Server-Sent Events.
- **Auth**: add JWT authentication in the .NET gateway.
- **Conversation memory**: use `conversation_id` to store chat history in
  Redis and include prior turns in the Claude prompt.
- **Better embeddings**: try `BAAI/bge-large-en-v1.5` or Anthropic's Voyage.
- **Hybrid search**: combine vector similarity with BM25 keyword search for
  better precision on drug names and ICD codes.
- **Evaluation**: build a set of gold-standard Q&A pairs and measure recall
  @k, answer accuracy, and hallucination rate as you tweak.
- **Monitoring**: add OpenTelemetry traces across the gateway ↔ RAG boundary.
- **Cloud deploy**: push images to ghcr.io, deploy to Azure Container Apps
  or AWS ECS.

Happy learning! 🧠
