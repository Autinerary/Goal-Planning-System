"""
Goal Planning System - FastAPI Backend
Multi-Agent Orchestration System with AutoGen
"""

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os
from dotenv import load_dotenv

from api.routes import auth, onboarding, paths, races, milestones, tasks, calendar, reflections, tools, messaging, calls, memes, memory, assistant
from database.connection import init_db

load_dotenv()

def _cors_origins() -> list:
    """Browser origins allowed to call this API.

    Local dev origins are always included, and CORS_ORIGINS is merged on top
    rather than replacing them. Previously CORS_ORIGINS overrode the defaults
    entirely, so setting it to the production domain silently locked out
    localhost — the request reaches the server, the browser discards the
    response, and the app reports "cannot connect to server" about a backend
    that is healthy.
    """
    defaults = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ]
    configured = [
        o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()
    ]
    # dict.fromkeys keeps order and drops duplicates.
    return list(dict.fromkeys(defaults + configured))


# Choose orchestrator based on environment
USE_AUTOGEN = os.getenv("USE_AUTOGEN", "false").lower() == "true"

if USE_AUTOGEN:
    from core.autogen_orchestrator import AutoGenOrchestrator
    orchestrator = AutoGenOrchestrator()
    print("🤖 Using AutoGen Multi-Agent Orchestrator")
else:
    from core.orchestrator import Orchestrator
    orchestrator = Orchestrator()
    print("� Using LangGraph Multi-Agent Orchestrator")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    await orchestrator.initialize()
    yield
    # Shutdown
    await orchestrator.cleanup()

app = FastAPI(
    title="Goal Planning System API",
    description="Agentic AI system for personalized life planning with AutoGen support",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    # Vercel gives every preview deployment its own hostname, so an explicit
    # allow-list can never cover them. Scope the pattern to OUR two projects
    # rather than all of *.vercel.app, which would let any Vercel app call
    # this API with credentials attached.
    allow_origin_regex=r"https://(goal-planning-app|servicehub-six|servicehub-mvp)[a-z0-9\-]*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(onboarding.router, prefix="/api/onboarding", tags=["onboarding"])
app.include_router(paths.router, prefix="/api/paths", tags=["paths"])
app.include_router(races.router, prefix="/api/races", tags=["races"])
app.include_router(milestones.router, prefix="/api/milestones", tags=["milestones"])
app.include_router(tasks.router, prefix="/api/tasks", tags=["tasks"])
app.include_router(calendar.router, prefix="/api/calendar", tags=["calendar"])
app.include_router(reflections.router, prefix="/api/reflections", tags=["reflections"])
app.include_router(tools.router, prefix="/api/tools", tags=["tools"])
app.include_router(messaging.router, tags=["messaging"])
app.include_router(calls.router, tags=["calls"])
app.include_router(memes.router, prefix="/api/memes", tags=["memes"])
app.include_router(memory.router, prefix="/api/memory", tags=["memory"])
app.include_router(assistant.router, prefix="/api/assistant", tags=["assistant"])

@app.get("/")
async def root():
    return {
        "message": "Goal Planning System API",
        "version": "1.0.0",
        "status": "operational",
        "orchestrator": "AutoGen" if USE_AUTOGEN else "LangGraph"
    }

@app.get("/health")
async def health_check():
    """Health + CAPABILITY.

    `status: healthy` used to mean only "the agents constructed", which is true
    whether or not a model is reachable. Without an LLM every agent silently
    falls back to templates, so the check now reports what the agents can
    actually do — otherwise there is no way to tell from outside the server
    whether the product is generating plans or serving canned ones.
    """
    from core import llm
    from database.supabase_client import get_supabase

    llm_on = llm.is_enabled()
    catalogue = get_supabase() is not None

    if llm_on and catalogue:
        capability, note = "full", "Generating plans and ranking real resources."
    elif llm_on:
        capability, note = "degraded", "LLM live, but no resource catalogue — tool recommendations will be empty."
    elif catalogue:
        capability, note = "degraded", "No LLM: milestones fall back to templates and tools rank on ratings only."
    else:
        capability, note = "templates_only", "No LLM and no catalogue — output is template text, not generated."

    return {
        "status": "healthy",
        "capability": capability,
        "note": note,
        "llm_enabled": llm_on,
        "resource_catalogue": catalogue,
        "orchestrator_type": "AutoGen" if USE_AUTOGEN else "LangGraph",
        "orchestrator": await orchestrator.health_check()
    }

@app.get("/config")
async def get_config():
    """Get current configuration"""
    return {
        "use_autogen": USE_AUTOGEN,
        "simulation_mode": os.getenv("APP_MODE", "simulation") == "simulation",
        "agents": [
            "Path Planning Agent",
            "Pattern Recognition Agent", 
            "Tool Recommendation Agent",
            "Reflection Analysis Agent",
            "Adaptation Agent",
            "Calendar Optimization Agent"
        ]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
