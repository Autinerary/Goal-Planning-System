"""
Task API Routes
Step 5: Task View
"""

from fastapi import APIRouter, HTTPException
# Types are in TypeScript, using dicts for Python

router = APIRouter()

@router.get("/milestone/{milestone_id}", response_model=list)
async def get_tasks_for_milestone(milestone_id: str):
    """Get tasks for a milestone"""
    # In production: Query database
    return [
        {
            "id": "task_1",
            "milestoneId": milestone_id,
            "name": "Task 1",
            "description": "Complete this task",
            "scheduledDate": None,
            "estimatedDuration": 30,
            "status": "pending",
            "helperTricks": ["ADHD Trick: Break into 5-minute chunks"],
            "motivation": "You've got this!",
            "createdAt": None,
            "updatedAt": None
        }
    ]

@router.get("/{task_id}")
async def get_task(task_id: str):
    """Get specific task"""
    # In production: Query database
    return {
        "id": task_id,
        "milestoneId": "milestone_1",
        "name": "Task 1",
        "description": "Complete this task",
        "scheduledDate": None,
        "estimatedDuration": 30,
        "status": "pending",
        "helperTricks": [],
        "createdAt": None,
        "updatedAt": None
    }

@router.post("/{task_id}/complete")
async def complete_task(task_id: str):
    """Mark task as complete"""
    # In production: Update database
    return {"message": "Task completed", "taskId": task_id}
