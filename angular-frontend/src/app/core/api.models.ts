// Shape mirrors the .NET Gateway records + FastAPI schemas.

export interface ChatRequest {
  query: string;
  topK?: number | null;
  conversationId?: string | null;
}

export interface Source {
  content: string;
  metadata: Record<string, unknown>;
  score?: number | null;
}

export interface ChatResponse {
  answer: string;
  sources: Source[];
  model: string;
  conversationId?: string | null;
  cacheHit?: boolean;
}

export interface HealthResponse {
  status: string;
  vectorStoreDocs: number;
  model: string;
}

export interface AgentRequest {
  query: string;
  conversationId?: string | null;
}

export interface TraceStep {
  type: string;
  content?: string | null;
  tool?: string | null;
  toolCalls?: Array<Record<string, unknown>> | null;
}

export interface AgentResponse {
  answer: string;
  trace: TraceStep[];
  toolCallCount: number;
  steps: number;
  model: string;
  conversationId?: string | null;
  cacheHit?: boolean;
}

// FastAPI direct (documents)
export interface IngestRequest {
  documents: string[];
  metadatas?: Array<Record<string, unknown>>;
}

export interface IngestResponse {
  ingested_count: number;
  collection: string;
}

export interface CountResponse {
  count: number;
  collection: string;
}

// FastAPI raw health (snake_case)
export interface RawHealthResponse {
  status: string;
  vector_store_docs: number;
  model: string;
}
