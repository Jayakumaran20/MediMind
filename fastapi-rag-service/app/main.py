from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.models.schemas import HealthResponse
from app.routers import chat, documents, agent
from app.services.vector_store import get_vector_store


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Warm up the vector store (loads embedding model once) at boot.
    get_vector_store()
    yield


app = FastAPI(
    title="MediMind RAG Service",
    description="Healthcare Q&A powered by LangChain + ChromaDB + Claude",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router)
app.include_router(documents.router)
app.include_router(agent.router)


@app.get("/", tags=["root"])
def root() -> dict:
    return {"service": "MediMind RAG", "docs": "/docs", "health": "/health"}


@app.get("/health", response_model=HealthResponse, tags=["root"])
def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        vector_store_docs=get_vector_store().count(),
        model=settings.claude_model,
    )
