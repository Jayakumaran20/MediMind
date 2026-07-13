from typing import List, Optional
from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    query: str = Field(..., min_length=1, description="User's medical question")
    top_k: Optional[int] = Field(None, ge=1, le=10, description="Docs to retrieve")
    conversation_id: Optional[str] = None


class Source(BaseModel):
    content: str
    metadata: dict
    score: Optional[float] = None


class ChatResponse(BaseModel):
    answer: str
    sources: List[Source]
    model: str
    conversation_id: Optional[str] = None


class IngestRequest(BaseModel):
    documents: List[str] = Field(..., description="Raw text documents to ingest")
    metadatas: Optional[List[dict]] = None


class IngestResponse(BaseModel):
    ingested_count: int
    collection: str


class HealthResponse(BaseModel):
    status: str
    vector_store_docs: int
    model: str


class AgentRequest(BaseModel):
    query: str = Field(..., min_length=1, description="User's medical question")
    conversation_id: Optional[str] = None


class TraceStep(BaseModel):
    type: str
    content: Optional[str] = None
    tool: Optional[str] = None
    tool_calls: Optional[List[dict]] = None


class AgentResponse(BaseModel):
    answer: str
    trace: List[TraceStep]
    tool_call_count: int
    steps: int
    model: str
    conversation_id: Optional[str] = None
