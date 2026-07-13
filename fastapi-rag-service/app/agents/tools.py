"""Tools the medical agent can call.

Each @tool-decorated function becomes a "callable capability" that the LLM
can invoke by name. LangChain builds the JSON schema from the type hints
and docstring, then hands that schema to Claude so Claude knows:
- what the tool is called
- what arguments it takes (name, type, description)
- when to call it (from the docstring)

The docstring is CRITICAL — it's the tool description the model actually reads.
Write it like a mini API doc for a very literal-minded reader.
"""
from typing import List
from langchain_core.tools import tool

from app.services.vector_store import get_vector_store


@tool
def search_medical_docs(query: str, top_k: int = 4) -> str:
    """Search the medical knowledge base for information about a topic.

    Use this tool whenever the user asks a factual medical question:
    diseases, symptoms, treatments, guidelines, vaccinations.

    Args:
        query: A short natural-language search query, e.g. "hypertension stages".
        top_k: How many document chunks to return (1-6). Default 4.

    Returns:
        A newline-separated list of relevant document snippets, each
        prefixed with its source title in square brackets.
    """
    vs = get_vector_store()
    results = vs.similarity_search(query, k=min(max(top_k, 1), 6))
    if not results:
        return "No relevant documents found in the knowledge base."
    lines = []
    for doc, score in results:
        title = doc.metadata.get("title", doc.metadata.get("source", "Unknown"))
        lines.append(f"[{title}] (relevance={1-score:.2f})\n{doc.page_content}")
    return "\n\n---\n\n".join(lines)


@tool
def check_drug_interaction(drug_a: str, drug_b: str) -> str:
    """Look up interactions between two medications.

    Use this whenever the user asks whether two drugs are safe to take
    together, or mentions taking multiple medications.

    Args:
        drug_a: First drug name (generic or brand), e.g. "warfarin".
        drug_b: Second drug name, e.g. "ibuprofen".

    Returns:
        Any documented interactions found in the knowledge base, or a
        note that no interaction was documented.
    """
    vs = get_vector_store()
    query = f"{drug_a} {drug_b} interaction contraindication"
    results = vs.similarity_search(query, k=3)
    if not results:
        return f"No documented interactions found between {drug_a} and {drug_b} in the knowledge base."

    a, b = drug_a.lower(), drug_b.lower()
    snippets = []
    for doc, _ in results:
        text_lower = doc.page_content.lower()
        # Only surface passages that actually mention at least one of the drugs.
        if a in text_lower or b in text_lower:
            title = doc.metadata.get("title", "Unknown")
            snippets.append(f"[{title}]\n{doc.page_content}")

    if not snippets:
        return (
            f"No direct interaction found between '{drug_a}' and '{drug_b}' "
            "in the knowledge base. Recommend the user verify with a pharmacist."
        )
    return "\n\n---\n\n".join(snippets)


# Symptoms that indicate a medical emergency. Kept simple and explicit so the
# LLM can't rationalize its way past them.
EMERGENCY_KEYWORDS = [
    "chest pain", "difficulty breathing", "shortness of breath at rest",
    "stroke", "slurred speech", "one-sided weakness", "face drooping",
    "severe headache", "worst headache of my life",
    "vision loss", "sudden vision changes",
    "unconscious", "loss of consciousness", "seizure",
    "severe bleeding", "coughing up blood", "vomiting blood",
    "suicidal", "self harm",
    "anaphylaxis", "throat swelling", "trouble swallowing",
    "blood pressure over 180", "bp > 180",
]


@tool
def emergency_triage(symptoms: str) -> str:
    """Check whether described symptoms are a medical emergency.

    Use this tool FIRST whenever the user describes symptoms they are
    currently experiencing, before doing any other lookup. If it returns
    an emergency verdict, you MUST tell the user to call emergency
    services immediately and stop trying to give clinical advice.

    Args:
        symptoms: Free-text description of what the user is feeling.

    Returns:
        Either "EMERGENCY: ..." or "NON_EMERGENCY: ..." with reasoning.
    """
    s = symptoms.lower()
    hits = [kw for kw in EMERGENCY_KEYWORDS if kw in s]
    if hits:
        return (
            "EMERGENCY: symptoms match red-flag criteria: "
            f"{', '.join(hits)}. Advise user to call emergency services "
            "(911 in the US) immediately. Do NOT provide non-urgent advice."
        )
    return (
        "NON_EMERGENCY: no red-flag symptoms detected. Safe to continue "
        "with informational lookup, but always recommend professional "
        "evaluation for persistent symptoms."
    )


@tool
def list_available_topics() -> str:
    """List the medical topics currently available in the knowledge base.

    Use this when the user asks "what can you help with?" or when you
    need to decide whether the knowledge base likely has an answer.

    Returns:
        A newline-separated list of topic titles.
    """
    vs = get_vector_store()
    try:
        # Chroma's internal collection has a .get() that returns metadata.
        raw = vs.store._collection.get(include=["metadatas"])
        titles = set()
        for md in raw.get("metadatas", []) or []:
            if md and "title" in md:
                titles.add(md["title"])
        if not titles:
            return "Knowledge base is empty. Please seed documents first."
        return "Available topics:\n- " + "\n- ".join(sorted(titles))
    except Exception as e:
        return f"Unable to list topics: {e}"


def all_tools() -> List:
    """Return every tool the agent can use."""
    return [
        emergency_triage,
        search_medical_docs,
        check_drug_interaction,
        list_available_topics,
    ]
