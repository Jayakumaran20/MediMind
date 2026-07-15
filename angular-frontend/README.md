# MediMind Frontend (Angular 19)

Attractive, dark-themed Angular SPA covering every MediMind backend endpoint.

## Pages

| Page | Route | Endpoints exercised |
| --- | --- | --- |
| **Chat** | `/chat` | `POST /api/chat` (via .NET gateway) |
| **Agent** | `/agent` | `POST /api/agent` (with full ReAct trace) |
| **Documents** | `/documents` | `POST /rag/documents/ingest`, `POST /rag/documents/upload`, `GET /rag/documents/count` |
| **Health** | `/health` | `GET /api/chat/health`, `GET /rag/health`, `GET /rag/documents/count` |

The sidebar also polls `/api/chat/health` and `/rag/health` on load for a live status pill.

## Requirements

- Node.js 18+
- The .NET gateway running on `http://localhost:5000`
- The FastAPI RAG service running on `http://localhost:8000`

The dev server proxies:
- `/api/*` → gateway (5000)
- `/rag/*` → FastAPI (8000, prefix stripped)

## Run

```bash
npm install
npm start          # http://localhost:4200
npm run build      # dist/medimind-frontend
```

## Stack

- Angular 19 (standalone components, signals, new control flow)
- Zero external UI library — pure CSS glassmorphism theme
- Lazy-loaded feature routes
