"""
Tools API Routes
Step 3.5: Pit Stop View
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
# Types are in TypeScript, using dicts for Python

router = APIRouter()

class ToolSearchRequest(BaseModel):
    query: str
    barrierTypes: List[str] = []
    toolType: str = "all"  # service, commentary, product, other, all

@router.get("/pit-stop")
async def get_pit_stop_tools():
    """Get all tools for pit stop view"""
    # In production: Query knowledge base
    return {
        "services": [],
        "commentaries": [],
        "products": [],
        "other": []
    }

@router.post("/search")
async def search_tools(request: ToolSearchRequest):
    """Magic searchbar - search for tools"""
    # In production: Use semantic search on knowledge base
    return {
        "results": [
            {
                "id": "tool_1",
                "type": "service",
                "name": "Example Service",
                "description": "A helpful service",
                "url": "https://example.com",
                "relevanceScore": 0.9
            }
        ]
    }

@router.get("/milestone/{milestone_id}")
async def get_tools_for_milestone(milestone_id: str):
    """Get recommended tools for a milestone"""
    # In production: Query database
    return {
        "services": [],
        "commentaries": [],
        "products": [],
        "other": []
    }
