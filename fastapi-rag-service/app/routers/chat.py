from fastapi import APIRouter, HTTPException
from app.models.schemas import ChatRequest, ChatResponse
from app.services.rag_service import get_rag_service

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
def chat(req: ChatRequest) -> ChatResponse:
    try:
        return get_rag_service().answer(
            query=req.query,
            top_k=req.top_k,
            conversation_id=req.conversation_id,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"RAG pipeline error: {e}")
