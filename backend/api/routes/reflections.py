"""
Reflection API Routes
Step 6: Journal/Reflection View
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import uuid

router = APIRouter()

# In-memory storage for reflections (use database in production)
reflections_store: List[dict] = []

class ReflectionRequest(BaseModel):
    contextType: str
    contextId: str
    questions: List[dict]
    freeFormText: Optional[str] = None

class ReflectionResponse(BaseModel):
    reflectionId: str
    insights: dict
    adaptations: Optional[dict] = None

def analyze_sentiment(text: str) -> str:
    """Simple keyword-based sentiment analysis"""
    text_lower = text.lower()
    positive_words = ['good', 'great', 'amazing', 'excellent', 'happy', 'productive', 'better', 'progress', 'success', 'accomplished']
    negative_words = ['bad', 'terrible', 'awful', 'stressed', 'overwhelmed', 'tired', 'exhausted', 'failed', 'struggling', 'difficult']
    
    positive_count = sum(1 for word in positive_words if word in text_lower)
    negative_count = sum(1 for word in negative_words if word in text_lower)
    
    if positive_count > negative_count:
        return 'positive'
    elif negative_count > positive_count:
        return 'negative'
    return 'neutral'

def generate_insights(questions: List[dict], sentiment: str) -> List[str]:
    """Generate AI-like insights from reflection"""
    insights = []
    
    if sentiment == 'positive':
        insights.append('Positive momentum detected')
        insights.append('Keep up the good work!')
    elif sentiment == 'negative':
        insights.append('Challenging period identified')
        insights.append('Consider reaching out for support')
    else:
        insights.append('Steady progress noted')
        insights.append('Consistency is key')
    
    return insights

@router.post("/", response_model=ReflectionResponse)
async def create_reflection(request: ReflectionRequest, user_id: str = "user_123"):
    """Create reflection and trigger adaptation"""
    
    # Analyze sentiment from all answers
    all_text = request.freeFormText or ""
    for q in request.questions:
        all_text += " " + q.get('answer', '')
    
    sentiment = analyze_sentiment(all_text)
    insights = generate_insights(request.questions, sentiment)
    
    # Generate summary from first answer
    summary = ""
    if request.questions and len(request.questions) > 0:
        first_answer = request.questions[0].get('answer', '')
        summary = first_answer[:100] + "..." if len(first_answer) > 100 else first_answer
    
    # Create reflection record
    reflection_id = str(uuid.uuid4())
    reflection = {
        "id": reflection_id,
        "userId": user_id,
        "date": datetime.now().strftime("%Y-%m-%d"),
        "contextType": request.contextType,
        "contextId": request.contextId,
        "contextName": f"{request.contextType.capitalize()} Reflection",
        "sentiment": sentiment,
        "summary": summary or "Reflection recorded",
        "questions": [
            {"q": q.get('question', ''), "a": q.get('answer', '')}
            for q in request.questions
        ],
        "insights": insights,
        "freeFormText": request.freeFormText
    }
    
    # Store reflection
    reflections_store.insert(0, reflection)  # Add to beginning (newest first)
    
    return ReflectionResponse(
        reflectionId=reflection_id,
        insights={"sentiment": sentiment, "patterns": insights},
        adaptations={"recommendations": ["Keep journaling!", "Review your progress weekly"]}
    )

@router.get("/user/{user_id}")
async def get_user_reflections(user_id: str):
    """Get user's previous reflections"""
    # Filter by user_id (for demo, return all)
    user_reflections = [r for r in reflections_store if r.get("userId") == user_id]
    
    # If no reflections yet, return some seed data
    if not user_reflections:
        return [
            {
                "id": "seed_1",
                "date": "2026-01-17",
                "contextType": "path",
                "contextName": "Graduate University Path",
                "sentiment": "positive",
                "summary": "Feeling good about progress on accommodation requests. The disability office was helpful!",
                "questions": [
                    {"q": "How was today?", "a": "Really productive! Got a lot done."},
                    {"q": "How well done do you think it was?", "a": "8/10 - better than expected"},
                    {"q": "What would you improve?", "a": "Start earlier in the day next time"},
                ],
                "insights": ["Positive momentum detected", "Morning routines working well"],
            },
            {
                "id": "seed_2",
                "date": "2026-01-16",
                "contextType": "task",
                "contextName": "Group Project Meeting",
                "sentiment": "negative",
                "summary": "Struggled with the group project. Feeling overwhelmed by social interaction.",
                "questions": [
                    {"q": "How was today?", "a": "Exhausting. The meeting went longer than expected."},
                    {"q": "How well done do you think it was?", "a": "4/10 - I couldn't focus"},
                    {"q": "What would you improve?", "a": "Ask for a smaller group or individual alternative"},
                ],
                "insights": ["Social fatigue detected", "Consider requesting accommodation"],
            },
            {
                "id": "seed_3",
                "date": "2026-01-15",
                "contextType": "milestone",
                "contextName": "Request Accommodations",
                "sentiment": "neutral",
                "summary": "Started the accommodation request process. Nervous but hopeful.",
                "questions": [
                    {"q": "How was today?", "a": "Mixed feelings. Progress is slow but steady."},
                    {"q": "How well done do you think it was?", "a": "6/10 - okay"},
                    {"q": "What would you improve?", "a": "More preparation before meetings"},
                ],
                "insights": ["Steady progress", "Building confidence"],
            },
        ]
    
    return user_reflections

@router.get("/questions/{context_type}")
async def get_reflection_questions(context_type: str):
    """Get reflection questions for context type"""
    questions = {
        "path": [
            "How was your overall progress?",
            "What worked well?",
            "What would you improve?"
        ],
        "race": [
            "How is this race going?",
            "What milestones are you proud of?",
            "What challenges are you facing?"
        ],
        "milestone": [
            "How did this milestone go?",
            "What tools helped?",
            "What would you do differently?"
        ],
        "task": [
            "How was this task?",
            "Did the helper tricks work?",
            "How do you feel about completing it?"
        ],
        "calendar": [
            "How was your day?",
            "Did you stick to the schedule?",
            "What would you change?"
        ]
    }
    
    return {
        "questions": questions.get(context_type, [])
    }
