"""
Goal Planning System - FastAPI Backend
Multi-Agent Orchestration System with AutoGen
"""

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os
from dotenv import load_dotenv

from api.routes import auth, onboarding, paths, races, milestones, tasks, calendar, reflections, tools, messaging, calls, memes
from database.connection import init_db

load_dotenv()

# Choose orchestrator based on environment
USE_AUTOGEN = os.getenv("USE_AUTOGEN", "false").lower() == "true"

if USE_AUTOGEN:
    from core.autogen_orchestrator import AutoGenOrchestrator
    orchestrator = AutoGenOrchestrator()
    print("🤖 Using AutoGen Multi-Agent Orchestrator")
else:
    from core.orchestrator import Orchestrator
    orchestrator = Orchestrator()
    print("🔧 Using Custom Multi-Agent Orchestrator")

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
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:3001").split(","),
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

@app.get("/")
async def root():
    return {
        "message": "Goal Planning System API",
        "version": "1.0.0",
        "status": "operational",
        "orchestrator": "AutoGen" if USE_AUTOGEN else "Custom"
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "orchestrator_type": "AutoGen" if USE_AUTOGEN else "Custom",
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
