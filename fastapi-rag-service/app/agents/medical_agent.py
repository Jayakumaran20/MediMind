"""LangGraph ReAct agent for MediMind.

# The ReAct pattern in one paragraph
# ---------------------------------
# ReAct = REasoning + ACTing. The LLM alternates between:
#   Thought  — "I need to know what drugs the user is asking about."
#   Action   — call a tool, e.g. check_drug_interaction("warfarin", "ibuprofen")
#   Observation — read the tool's output
# ...and loops until it decides it can answer, at which point it outputs
# the final answer instead of another tool call.
#
# LangGraph makes this a proper state machine:
#     [agent] --tool call--> [tools] --tool result--> [agent] --final answer--> END
#
# `create_react_agent` gives you this graph pre-wired. Under the hood it
# uses Claude's native tool-use API — Claude decides which function to
# invoke, LangGraph executes it, feeds the result back, and the loop
# continues.
"""
from typing import Any, Dict, List
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.prebuilt import create_react_agent

from app.config import settings
from app.agents.tools import all_tools


AGENT_SYSTEM_PROMPT = """You are MediMind, a careful healthcare information assistant.

You have access to tools. Follow these rules:

1. If the user describes symptoms they are currently experiencing, ALWAYS
   call `emergency_triage` FIRST before doing anything else. If it returns
   an EMERGENCY verdict, tell the user to call emergency services and stop.

2. For any factual medical question, call `search_medical_docs` to ground
   your answer. Never answer from memory alone.

3. For any question involving two or more medications, call
   `check_drug_interaction`.

4. If unsure what the knowledge base covers, call `list_available_topics`.

5. After collecting information via tools, synthesize a clear, structured
   answer. Cite source documents in square brackets like [Hypertension].

6. Add a safety disclaimer whenever the topic involves treatment, dosage,
   or emergency symptoms: patients should consult a licensed physician.

7. If the tools return no relevant information, say honestly:
   "I don't have that information in my knowledge base."

Be concise. Use bullet points for multi-part answers."""


class MedicalAgent:
    def __init__(self) -> None:
        if not settings.anthropic_api_key:
            raise RuntimeError("ANTHROPIC_API_KEY is not set.")
        self.llm = ChatAnthropic(
            model=settings.claude_model,
            api_key=settings.anthropic_api_key,
            temperature=0.1,
            max_tokens=2048,
        )
        # create_react_agent builds a LangGraph state machine:
        # llm-node <-> tools-node, looping until the LLM stops calling tools.
        self.graph = create_react_agent(
            model=self.llm,
            tools=all_tools(),
            prompt=AGENT_SYSTEM_PROMPT,
        )

    def run(self, query: str) -> Dict[str, Any]:
        """Run the agent to completion and return the final message + trace.

        The trace is what makes agents *educational*: you can see every
        thought, tool call, and observation in order.
        """
        result = self.graph.invoke(
            {"messages": [HumanMessage(content=query)]},
            config={"recursion_limit": 15},  # hard cap on loops
        )

        messages = result["messages"]
        trace: List[Dict[str, Any]] = []
        final_answer = ""

        for msg in messages:
            msg_type = type(msg).__name__
            entry: Dict[str, Any] = {"type": msg_type}

            # AI messages may either contain a final answer or tool calls.
            if msg_type == "AIMessage":
                content = msg.content if isinstance(msg.content, str) else str(msg.content)
                entry["content"] = content
                tool_calls = getattr(msg, "tool_calls", None) or []
                if tool_calls:
                    entry["tool_calls"] = [
                        {"name": tc["name"], "args": tc["args"]} for tc in tool_calls
                    ]
                else:
                    final_answer = content
            elif msg_type == "ToolMessage":
                entry["tool"] = getattr(msg, "name", "unknown")
                # Truncate long tool outputs for the trace view.
                content = msg.content if isinstance(msg.content, str) else str(msg.content)
                entry["content"] = content[:500] + ("..." if len(content) > 500 else "")
            elif msg_type == "HumanMessage":
                entry["content"] = msg.content
            trace.append(entry)

        return {
            "answer": final_answer,
            "trace": trace,
            "tool_call_count": sum(1 for t in trace if t.get("tool_calls")),
            "steps": len(trace),
        }


_agent: MedicalAgent | None = None


def get_medical_agent() -> MedicalAgent:
    global _agent
    if _agent is None:
        _agent = MedicalAgent()
    return _agent
