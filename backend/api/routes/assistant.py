"""
AI Assistant chatbot — routed through the backend so it uses the same LLM
(model/config) as the agent orchestrator, and can be enriched with the user's
full agent path context passed from the frontend.

POST /api/assistant/chat
  Body: { "messages": [{"role": "user"|"assistant", "content": str}],
          "context": optional str summary of the user's goals/path/norms }
  Returns: { "configured": bool, "reply": str }
"""
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from core import llm

router = APIRouter()

SYSTEM_PROMPT = (
    "You are the assistant inside Autinerary, a life-planning app for people who "
    "navigate neurodivergence, disability, and other systemic barriers (the app "
    'calls these "norms").\n\n'
    "Your job is to help the person get unstuck on a goal, milestone, or barrier. "
    "Be warm, concrete, and brief — a few short paragraphs or a tight list, not an "
    "essay. Offer practical next steps they can actually take, and options rather "
    "than a single prescription. Respect their autonomy and never be condescending. "
    "You are not a doctor, lawyer, or therapist: for medical, legal, or crisis "
    "situations, gently encourage them to reach out to a qualified professional or, "
    "in an emergency, local emergency services. Do not invent facts about their "
    "specific situation; if you're unsure, ask a short clarifying question."
)


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    context: Optional[str] = None


@router.post("/chat")
async def chat(req: ChatRequest):
    # Keep only well-formed user/assistant turns; cap history + length.
    history = [
        {"role": m.role, "content": m.content.strip()[:4000]}
        for m in req.messages
        if m.role in ("user", "assistant")
        and isinstance(m.content, str)
        and m.content.strip()
    ][-12:]

    if not history:
        raise HTTPException(status_code=400, detail="Say something first.")

    if not llm.is_enabled():
        return {
            "configured": False,
            "reply": (
                "I'm almost ready — the assistant just needs an LLM key configured "
                "on the server before I can chat."
            ),
        }

    context = (req.context or "").strip()[:2000]
    system = SYSTEM_PROMPT
    if context:
        system += (
            "\n\nWhat we know about this person (use it to personalise, don't "
            f"repeat it back verbatim):\n{context}"
        )

    reply = await llm.complete_chat(
        [{"role": "system", "content": system}] + history,
        max_tokens=700,
    )

    if not reply:
        return {"reply": "Sorry — I couldn't respond just now. Please try again."}

    return {"configured": True, "reply": reply}
