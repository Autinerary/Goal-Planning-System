"""
Path API Routes
Step 1: Path View
"""

from fastapi import APIRouter, HTTPException
from typing import List
# Types are in TypeScript, using dicts for Python

router = APIRouter()

@router.get("/{user_id}")
async def get_user_path(user_id: str):
    """Get user's path"""
    # In production: Query database
    return {
        "id": "path_123",
        "userId": user_id,
        "name": "My Personal Path",
        "description": "Path toward your goals",
        "races": [],
        "stats": [
            {
                "name": "Mentality",
                "value": 3,
                "maxValue": 100,
                "color": "green"
            },
            {
                "name": "Happiness",
                "value": 8,
                "maxValue": 100,
                "color": "green"
            }
        ],
        "motivationWheel": {
            "id": "wheel_1",
            "options": ["Focus", "Energy", "Confidence", "Growth", "Resilience", "Connection"],
            "currentMotivation": None
        },
        "createdAt": None,
        "updatedAt": None
    }

@router.post("/{path_id}/motivation-wheel/spin")
async def spin_motivation_wheel(path_id: str):
    """Spin the motivation wheel"""
    # In production: Randomly select from options
    return {
        "motivation": "Focus",
        "message": "Today's motivation: Focus on one task at a time"
    }
