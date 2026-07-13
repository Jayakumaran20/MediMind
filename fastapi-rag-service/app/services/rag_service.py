"""Orchestrates: query -> retrieve top-k docs -> ask Claude to answer."""
from typing import List
from app.config import settings
from app.models.schemas import ChatResponse, Source
from app.services.vector_store import get_vector_store
from app.services.claude_service import get_claude


class RagService:
    def __init__(self) -> None:
        self.vs = get_vector_store()
        self.claude = get_claude()

    def answer(self, query: str, top_k: int | None = None, conversation_id: str | None = None) -> ChatResponse:
        k = top_k or settings.top_k_results
        results = self.vs.similarity_search(query, k=k)

        docs = [doc for doc, _ in results]
        answer_text = self.claude.generate(query, docs)

        sources: List[Source] = [
            Source(content=d.page_content[:400], metadata=d.metadata, score=float(score))
            for d, score in results
        ]
        return ChatResponse(
            answer=answer_text,
            sources=sources,
            model=settings.claude_model,
            conversation_id=conversation_id,
        )


_rag: RagService | None = None


def get_rag_service() -> RagService:
    global _rag
    if _rag is None:
        _rag = RagService()
    return _rag
