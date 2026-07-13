"""Load local medical text files, split into chunks, prepare for ingestion."""
import os
from pathlib import Path
from typing import List
from langchain.schema import Document
from langchain.text_splitter import RecursiveCharacterTextSplitter


def load_directory(dir_path: str) -> List[Document]:
    docs: List[Document] = []
    p = Path(dir_path)
    if not p.exists():
        return docs
    for file in p.glob("*.txt"):
        text = file.read_text(encoding="utf-8")
        docs.append(Document(
            page_content=text,
            metadata={"source": file.name, "title": file.stem.replace("_", " ").title()},
        ))
    return docs


def split_documents(docs: List[Document], chunk_size: int = 800, overlap: int = 120) -> List[Document]:
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=overlap,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    return splitter.split_documents(docs)
