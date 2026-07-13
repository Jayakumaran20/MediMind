from fastapi import APIRouter, HTTPException

from app.config import settings
from app.models.schemas import AgentRequest, AgentResponse, TraceStep
from app.agents.medical_agent import get_medical_agent

router = APIRouter(prefix="/agent-chat", tags=["agent"])


@router.post("", response_model=AgentResponse)
def agent_chat(req: AgentRequest) -> AgentResponse:
    """Run the ReAct medical agent.

    Unlike /chat (single retrieval + generate), this endpoint lets the LLM
    autonomously choose which tools to call, in what order, and when to stop.
    The full step-by-step trace is returned so you can see the reasoning.
    """
    try:
        result = get_medical_agent().run(req.query)
        return AgentResponse(
            answer=result["answer"],
            trace=[TraceStep(**t) for t in result["trace"]],
            tool_call_count=result["tool_call_count"],
            steps=result["steps"],
            model=settings.claude_model,
            conversation_id=req.conversation_id,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent error: {e}")
