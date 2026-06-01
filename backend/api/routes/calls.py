"""
Video calls API routes for mentor calls and streams
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import uuid
import psycopg2
from psycopg2.extras import RealDictCursor
import os
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix="/api/calls", tags=["calls"])

# Database connection
def get_db_connection():
    conn = psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        database=os.getenv("DB_NAME", "goal_planning"),
        user=os.getenv("DB_USER", os.getenv("USER", "aayushbhan")),  # Use current system user as default
        password=os.getenv("DB_PASSWORD", ""),  # Empty password for local dev
        port=os.getenv("DB_PORT", "5432")
    )
    return conn

class CallCreate(BaseModel):
    receiver_id: str
    call_type: str = "mentor"
    scheduled_at: Optional[str] = None
    notes: Optional[str] = None

class CallUpdate(BaseModel):
    status: str
    notes: Optional[str] = None

class CallResponse(BaseModel):
    id: str
    caller_id: str
    receiver_id: str
    call_type: str
    status: str
    scheduled_at: Optional[str] = None
    started_at: Optional[str] = None
    ended_at: Optional[str] = None
    duration: Optional[int] = None
    notes: Optional[str] = None
    created_at: str

@router.post("/start", response_model=CallResponse)
async def start_call(call: CallCreate, user_id: str = Query(default="demo_user")):
    """Start or schedule a video call"""
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # Get or create user UUIDs
        cur.execute("SELECT get_or_create_user(%s) as caller_uuid", (user_id,))
        caller_result = cur.fetchone()
        caller_uuid = caller_result['caller_uuid'] if caller_result else str(uuid.uuid4())
        
        cur.execute("SELECT get_or_create_user(%s) as receiver_uuid", (call.receiver_id,))
        receiver_result = cur.fetchone()
        receiver_uuid = receiver_result['receiver_uuid'] if receiver_result else str(uuid.uuid4())
        
        call_id = str(uuid.uuid4())
        now = datetime.now()
        scheduled_time = datetime.fromisoformat(call.scheduled_at.replace('Z', '+00:00')) if call.scheduled_at else now
        
        status = 'scheduled' if call.scheduled_at and scheduled_time > now else 'in_progress'
        started_at = now if status == 'in_progress' else None
        
        cur.execute("""
            INSERT INTO video_calls (id, caller_id, receiver_id, call_type, status, scheduled_at, started_at, notes, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id, caller_id, receiver_id, call_type, status, scheduled_at, started_at, ended_at, duration, notes, created_at
        """, (call_id, caller_uuid, receiver_uuid, call.call_type, status, scheduled_time, started_at, call.notes, now))
        
        result = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()
        
        return {
            "id": str(result['id']),
            "caller_id": result['caller_id'],
            "receiver_id": result['receiver_id'],
            "call_type": result['call_type'],
            "status": result['status'],
            "scheduled_at": result['scheduled_at'].isoformat() if result['scheduled_at'] else None,
            "started_at": result['started_at'].isoformat() if result['started_at'] else None,
            "ended_at": result['ended_at'].isoformat() if result['ended_at'] else None,
            "duration": result['duration'],
            "notes": result['notes'],
            "created_at": result['created_at'].isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/{call_id}/end", response_model=CallResponse)
async def end_call(call_id: str, user_id: str = Query(default="demo_user")):
    """End a video call and record duration"""
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # Get user UUID
        cur.execute("SELECT get_or_create_user(%s) as user_uuid", (user_id,))
        user_result = cur.fetchone()
        user_uuid = user_result['user_uuid'] if user_result else str(uuid.uuid4())
        
        # Get call start time
        cur.execute("""
            SELECT started_at FROM video_calls WHERE id = %s AND caller_id = %s
        """, (call_id, user_uuid))
        
        call_data = cur.fetchone()
        if not call_data:
            raise HTTPException(status_code=404, detail="Call not found")
        
        now = datetime.now()
        started_at = call_data['started_at'] or now
        duration = int((now - started_at).total_seconds())
        
        cur.execute("""
            UPDATE video_calls 
            SET status = 'completed', ended_at = %s, duration = %s
            WHERE id = %s AND caller_id = %s
            RETURNING id, caller_id, receiver_id, call_type, status, scheduled_at, started_at, ended_at, duration, notes, created_at
        """, (now, duration, call_id, user_uuid))
        
        result = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()
        
        return {
            "id": str(result['id']),
            "caller_id": result['caller_id'],
            "receiver_id": result['receiver_id'],
            "call_type": result['call_type'],
            "status": result['status'],
            "scheduled_at": result['scheduled_at'].isoformat() if result['scheduled_at'] else None,
            "started_at": result['started_at'].isoformat() if result['started_at'] else None,
            "ended_at": result['ended_at'].isoformat() if result['ended_at'] else None,
            "duration": result['duration'],
            "notes": result['notes'],
            "created_at": result['created_at'].isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.get("/history", response_model=List[CallResponse])
async def get_call_history(user_id: str = Query(default="demo_user")):
    """Get call history for a user"""
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # Get user UUID
        cur.execute("SELECT get_or_create_user(%s) as user_uuid", (user_id,))
        user_result = cur.fetchone()
        user_uuid = user_result['user_uuid'] if user_result else str(uuid.uuid4())
        
        cur.execute("""
            SELECT id, caller_id, receiver_id, call_type, status, scheduled_at, started_at, ended_at, duration, notes, created_at
            FROM video_calls
            WHERE caller_id = %s OR receiver_id = %s
            ORDER BY created_at DESC
            LIMIT 50
        """, (user_uuid, user_uuid))
        
        calls = cur.fetchall()
        cur.close()
        conn.close()
        
        return [{
            "id": str(call['id']),
            "caller_id": call['caller_id'],
            "receiver_id": call['receiver_id'],
            "call_type": call['call_type'],
            "status": call['status'],
            "scheduled_at": call['scheduled_at'].isoformat() if call['scheduled_at'] else None,
            "started_at": call['started_at'].isoformat() if call['started_at'] else None,
            "ended_at": call['ended_at'].isoformat() if call['ended_at'] else None,
            "duration": call['duration'],
            "notes": call['notes'],
            "created_at": call['created_at'].isoformat()
        } for call in calls]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
