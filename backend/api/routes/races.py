"""
Race API Routes
Step 2: Race View
"""

from fastapi import APIRouter, HTTPException
from typing import List
# Types are in TypeScript, using dicts for Python

router = APIRouter()

@router.get("/path/{path_id}")
async def get_races_for_path(path_id: str):
    """Get all races for a path"""
    # In production: Query database
    return [
        {
            "id": "race_1",
            "name": "Race 1",
            "goal": "Graduate University",
            "progress": 80.0,
            "models": ["autism_adult_education_model", "adhd_study_model"],
            "milestones": [],
            "stats": [],
            "createdAt": None,
            "updatedAt": None
        },
        {
            "id": "race_2",
            "name": "Race 2",
            "goal": "Build Career",
            "progress": 25.0,
            "models": ["minority_networking_model"],
            "milestones": [],
            "stats": [],
            "createdAt": None,
            "updatedAt": None
        }
    ]

@router.get("/{race_id}")
async def get_race(race_id: str):
    """Get specific race"""
    # In production: Query database
    return {
        "id": race_id,
        "name": "Race 1",
        "goal": "Graduate University",
        "progress": 80.0,
        "models": ["autism_adult_education_model"],
        "milestones": [],
        "stats": [],
        "createdAt": None,
        "updatedAt": None
    }
