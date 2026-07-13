"""Claude LLM client wired through LangChain.

The RAG pipeline stuffs retrieved context into the prompt and asks Claude
to answer strictly from that context — this is what makes it "grounded".
"""
from typing import List
from langchain_anthropic import ChatAnthropic
from langchain.schema import Document, SystemMessage, HumanMessage

from app.config import settings


SYSTEM_PROMPT = """You are MediMind, a healthcare information assistant.

Rules:
1. Answer ONLY using facts from the provided <context> block. If the context
   does not contain the answer, say: "I don't have information about that in
   my medical knowledge base."
2. Never invent drug dosages, symptoms, or diagnoses.
3. Add a short safety disclaimer when the question involves treatment,
   dosage, or emergency care: patients should consult a licensed physician.
4. Cite the source document titles in square brackets, e.g. [Hypertension Guide].
5. Be concise and structured. Use bullet points for multi-part answers."""


class ClaudeService:
    def __init__(self) -> None:
        if not settings.anthropic_api_key:
            raise RuntimeError(
                "ANTHROPIC_API_KEY is not set. Add it to your .env file."
            )
        self.llm = ChatAnthropic(
            model=settings.claude_model,
            api_key=settings.anthropic_api_key,
            temperature=0.2,
            max_tokens=1024,
        )

    @staticmethod
    def _format_context(docs: List[Document]) -> str:
        parts = []
        for i, doc in enumerate(docs, start=1):
            title = doc.metadata.get("title") or doc.metadata.get("source") or f"Doc {i}"
            parts.append(f"[{title}]\n{doc.page_content}")
        return "\n\n---\n\n".join(parts)

    def generate(self, query: str, context_docs: List[Document]) -> str:
        context_block = self._format_context(context_docs) if context_docs else "(no relevant context found)"
        user_msg = (
            f"<context>\n{context_block}\n</context>\n\n"
            f"Question: {query}"
        )
        resp = self.llm.invoke([
            SystemMessage(content=SYSTEM_PROMPT),
            HumanMessage(content=user_msg),
        ])
        return resp.content if isinstance(resp.content, str) else str(resp.content)


_claude: ClaudeService | None = None


def get_claude() -> ClaudeService:
    global _claude
    if _claude is None:
        _claude = ClaudeService()
    return _claude
