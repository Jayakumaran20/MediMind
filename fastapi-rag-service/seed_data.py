"""One-shot script: reads .txt files from app/data/medical_docs
and pushes them into ChromaDB. Run once after `docker compose up`.

Usage:
    python seed_data.py                     # inside the container
    docker compose exec fastapi-rag python seed_data.py
"""
import sys
from app.services.document_loader import load_directory, split_documents
from app.services.vector_store import get_vector_store


def main() -> int:
    docs = load_directory("app/data/medical_docs")
    if not docs:
        print("No .txt files found in app/data/medical_docs")
        return 1

    chunks = split_documents(docs)
    vs = get_vector_store()
    vs.add_documents(chunks)
    print(f"Ingested {len(docs)} docs -> {len(chunks)} chunks")
    print(f"Total in collection: {vs.count()}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
