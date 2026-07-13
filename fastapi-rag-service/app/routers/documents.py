from pathlib import Path
from fastapi import APIRouter, HTTPException, UploadFile, File
from app.models.schemas import IngestRequest, IngestResponse
from app.services.vector_store import get_vector_store
from app.services.document_loader import split_documents
from app.config import settings
from langchain.schema import Document

router = APIRouter(prefix="/documents", tags=["documents"])


@router.post("/ingest", response_model=IngestResponse)
def ingest(req: IngestRequest) -> IngestResponse:
    if not req.documents:
        raise HTTPException(status_code=400, detail="No documents provided")

    metadatas = req.metadatas or [{"source": f"upload_{i}"} for i in range(len(req.documents))]
    if len(metadatas) != len(req.documents):
        raise HTTPException(status_code=400, detail="documents/metadatas length mismatch")

    raw_docs = [Document(page_content=t, metadata=m) for t, m in zip(req.documents, metadatas)]
    chunks = split_documents(raw_docs)

    vs = get_vector_store()
    vs.add_documents(chunks)
    return IngestResponse(ingested_count=len(chunks), collection=settings.collection_name)


@router.post("/upload", response_model=IngestResponse)
async def upload_file(file: UploadFile = File(...)) -> IngestResponse:
    if not file.filename or not file.filename.endswith((".txt", ".md")):
        raise HTTPException(status_code=400, detail="Only .txt and .md files are supported")
    content = (await file.read()).decode("utf-8", errors="ignore")

    doc = Document(page_content=content, metadata={"source": file.filename, "title": Path(file.filename).stem})
    chunks = split_documents([doc])
    get_vector_store().add_documents(chunks)
    return IngestResponse(ingested_count=len(chunks), collection=settings.collection_name)


@router.get("/count")
def count() -> dict:
    return {"count": get_vector_store().count(), "collection": settings.collection_name}
