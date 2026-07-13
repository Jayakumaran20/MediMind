"""ChromaDB-backed vector store wrapper.

Handles: creating the persistent collection, embedding docs with a
sentence-transformer, and running similarity search that powers RAG retrieval.
"""
from typing import List, Optional
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain.schema import Document

from app.config import settings


class VectorStoreService:
    def __init__(self) -> None:
        self.embeddings = HuggingFaceEmbeddings(
            model_name=settings.embedding_model,
            model_kwargs={"device": "cpu"},
            encode_kwargs={"normalize_embeddings": True},
        )
        self.store = Chroma(
            collection_name=settings.collection_name,
            embedding_function=self.embeddings,
            persist_directory=settings.chroma_persist_dir,
        )

    def add_texts(self, texts: List[str], metadatas: Optional[List[dict]] = None) -> int:
        if metadatas is None:
            metadatas = [{"source": "user_upload"} for _ in texts]
        self.store.add_texts(texts=texts, metadatas=metadatas)
        return len(texts)

    def add_documents(self, docs: List[Document]) -> int:
        self.store.add_documents(docs)
        return len(docs)

    def similarity_search(self, query: str, k: int) -> List[tuple[Document, float]]:
        # Returns (document, distance) — lower distance = closer match.
        return self.store.similarity_search_with_score(query, k=k)

    def count(self) -> int:
        try:
            return self.store._collection.count()
        except Exception:
            return 0


_vector_store: Optional[VectorStoreService] = None


def get_vector_store() -> VectorStoreService:
    global _vector_store
    if _vector_store is None:
        _vector_store = VectorStoreService()
    return _vector_store
