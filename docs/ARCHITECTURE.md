# MediMind — Architecture Notes

## Service boundaries

| Service       | Language   | Port  | Responsibility                                    |
|---------------|------------|-------|---------------------------------------------------|
| Gateway       | .NET 8     | 5000  | Auth, caching, orchestration, retries             |
| RAG service   | Python 3.11| 8000  | Embed → retrieve → generate                       |
| Redis         | Redis 7    | 6379  | Response cache                                    |
| Vector store  | ChromaDB   | (fs)  | Persistent local vector index                     |
| Claude API    | Anthropic  | (net) | LLM generation                                    |

## Request lifecycle

Client -> Gateway -> (Redis lookup) -> RAG service -> ChromaDB + Claude -> RAG service -> Gateway -> (Redis write) -> Client

## Data flow — ingestion

1. Text file loaded from disk (or POSTed via API).
2. Split into ~800-char chunks with 120-char overlap
   (`RecursiveCharacterTextSplitter`).
3. Each chunk embedded via `all-MiniLM-L6-v2` (384-dim vector).
4. Vector + text + metadata written to Chroma collection `medimind_docs`.
5. Persisted to `/app/chroma_db` (mounted Docker volume).

## Data flow — query

1. Query string embedded with the same model.
2. Chroma returns top-k nearest chunks + cosine distance scores.
3. Chunks concatenated into a `<context>` block.
4. Sent to Claude with a strict system prompt: "answer only from context".
5. Response parsed; sources returned alongside the answer.

## Failure modes & mitigations

| Failure                         | Mitigation                                          |
|---------------------------------|-----------------------------------------------------|
| Claude API 5xx or timeout       | Polly retry (3 tries, exponential backoff) in gateway |
| Redis unreachable               | Try/catch in cache service — pipeline still serves, uncached |
| ChromaDB corrupted              | Volume mount lets you delete `chroma_data` and re-seed |
| Query returns no relevant chunks| System prompt makes Claude respond "I don't have info" |
| Rate limits from Anthropic      | Cache absorbs repeat queries; long TTL              |

## Security considerations

- API key lives only in `.env`, injected as an env var into the RAG container.
- Gateway is the public entry point — RAG service is not exposed outside the
  compose network in production (remove `ports:` block for `fastapi-rag`).
- No PHI is stored — the sample docs are public reference material. If you
  extend this to real patient data, you need HIPAA controls
  (BAA with Anthropic, encryption at rest, audit logs, access control).
- Prompt injection: a malicious document could try "ignore previous
  instructions". Mitigate by (a) trusting your document source, (b) escaping
  document content in the prompt, (c) using Claude's tool-use guardrails.

## Where the caching decision lives

Query cache is at the **gateway** layer, not the RAG service. Rationale:
- Gateway is the natural place for cross-cutting concerns.
- If we later add a second consumer (e.g., a mobile-optimized service),
  they share the cache.
- Keeps the RAG service stateless and horizontally scalable.
