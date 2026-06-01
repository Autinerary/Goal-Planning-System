"""
Reflection API Routes
Step 6: Journal/Reflection View
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import uuid
from sqlalchemy.orm import Session
from sqlalchemy import text

from database.connection import get_db_session, SIMULATION_MODE

router = APIRouter()

# In-memory storage for simulation mode
reflections_store: List[dict] = []

def is_valid_uuid(val: str) -> bool:
    """Check if a string is a valid UUID"""
    try:
        uuid.UUID(str(val))
        return True
    except (ValueError, AttributeError):
        return False

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

# Default demo user UUID
DEMO_USER_ID = "00000000-0000-0000-0000-000000000001"

@router.post("/", response_model=ReflectionResponse)
async def create_reflection(request: ReflectionRequest, user_id: str = DEMO_USER_ID):
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
    
    reflection_id = str(uuid.uuid4())
    
    if SIMULATION_MODE:
        # Store in memory for simulation
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
        reflections_store.insert(0, reflection)
    else:
        # Store in PostgreSQL
        try:
            db = get_db_session()
            
            # First, ensure we have a user (create if not exists)
            user_check = db.execute(text("SELECT id FROM users WHERE id = CAST(:user_id AS uuid)"), {"user_id": user_id})
            if not user_check.fetchone():
                # Create a default user for testing
                db.execute(text("""
                    INSERT INTO users (id, email, password_hash, barrier_types, goals) 
                    VALUES (CAST(:id AS uuid), :email, :password, CAST(:barriers AS text[]), CAST(:goals AS text[]))
                """), {
                    "id": user_id,
                    "email": "demo@autinerary.ca",
                    "password": "demo_hash",
                    "barriers": "{autism,adhd}",
                    "goals": "{graduate,get_job}"
                })
                db.commit()
            
            # Insert reflection
            context_id_value = request.contextId if is_valid_uuid(request.contextId) else reflection_id
            db.execute(text("""
                INSERT INTO reflections (id, user_id, context_type, context_id, free_form_text, sentiment)
                VALUES (CAST(:id AS uuid), CAST(:user_id AS uuid), :context_type, CAST(:context_id AS uuid), :free_form_text, :sentiment)
            """), {
                "id": reflection_id,
                "user_id": user_id,
                "context_type": request.contextType,
                "context_id": context_id_value,
                "free_form_text": summary or request.freeFormText,
                "sentiment": sentiment
            })
            
            # Insert questions
            for q in request.questions:
                q_id = str(uuid.uuid4())
                db.execute(text("""
                    INSERT INTO reflection_questions (id, reflection_id, question, answer)
                    VALUES (CAST(:id AS uuid), CAST(:reflection_id AS uuid), :question, :answer)
                """), {
                    "id": q_id,
                    "reflection_id": reflection_id,
                    "question": q.get('question', ''),
                    "answer": q.get('answer', '')
                })
            
            db.commit()
            db.close()
        except Exception as e:
            print(f"Database error: {e}")
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    
    return ReflectionResponse(
        reflectionId=reflection_id,
        insights={"sentiment": sentiment, "patterns": insights},
        adaptations={"recommendations": ["Keep journaling!", "Review your progress weekly"]}
    )

@router.get("/user/{user_id}")
async def get_user_reflections(user_id: str = DEMO_USER_ID):
    """Get user's previous reflections"""
    
    # Normalize user_id to demo user if it's the old format
    if user_id == "user_123":
        user_id = DEMO_USER_ID
    
    if SIMULATION_MODE:
        # Return from memory or seed data
        user_reflections = [r for r in reflections_store if r.get("userId") == user_id]
        
        if not user_reflections:
            return get_seed_reflections()
        return user_reflections
    else:
        # Query PostgreSQL
        try:
            db = get_db_session()
            
            result = db.execute(text("""
                SELECT r.id, r.context_type, r.context_id, r.free_form_text, r.sentiment, r.created_at
                FROM reflections r
                WHERE r.user_id = CAST(:user_id AS uuid)
                ORDER BY r.created_at DESC
            """), {"user_id": user_id})
            
            reflections = []
            for row in result.fetchall():
                # Get questions for this reflection
                q_result = db.execute(text("""
                    SELECT question, answer FROM reflection_questions
                    WHERE reflection_id = :reflection_id
                """), {"reflection_id": row[0]})
                
                questions = [{"q": q[0], "a": q[1]} for q in q_result.fetchall()]
                
                reflections.append({
                    "id": str(row[0]),
                    "date": row[5].strftime("%Y-%m-%d") if row[5] else datetime.now().strftime("%Y-%m-%d"),
                    "contextType": row[1],
                    "contextName": f"{row[1].capitalize()} Reflection",
                    "sentiment": row[3] or "neutral",
                    "summary": row[4] or "Reflection recorded",
                    "questions": questions,
                    "insights": ["Pattern detected", "Keep going!"]
                })
            
            db.close()
            
            if not reflections:
                return get_seed_reflections()
            
            return reflections
        except Exception as e:
            print(f"Database error: {e}")
            return get_seed_reflections()

def get_seed_reflections():
    """Return seed reflections for demo"""
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
