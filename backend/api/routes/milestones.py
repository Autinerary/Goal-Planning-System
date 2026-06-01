"""
Milestone API Routes
Step 3: Milestone View
"""

from fastapi import APIRouter, HTTPException
# Types are in TypeScript, using dicts for Python

router = APIRouter()

@router.get("/race/{race_id}", response_model=list)
async def get_milestones_for_race(race_id: str):
    """Get milestones for a race"""
    # In production: Query database
    return [
        {
            "id": "milestone_1",
            "raceId": race_id,
            "name": "Current Milestone",
            "description": "Details about current milestone",
            "order": 1,
            "status": "in_progress",
            "recommendedChoices": [
                {
                    "id": "choice_1",
                    "name": "Recommended Choice 1",
                    "description": "High success rate approach",
                    "successPercentage": 90.0,
                    "attempts": 1000
                }
            ],
            "tools": [],
            "createdAt": None,
            "updatedAt": None
        }
    ]

@router.get("/{milestone_id}")
async def get_milestone(milestone_id: str):
    """Get specific milestone"""
    # In production: Query database
    return {
        "id": milestone_id,
        "raceId": "race_1",
        "name": "Current Milestone",
        "description": "Details about milestone",
        "order": 1,
        "status": "in_progress",
        "recommendedChoices": [],
        "tools": [],
        "createdAt": None,
        "updatedAt": None
    }
