"""
Messaging API routes for moderated communication
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import uuid
import psycopg2
from psycopg2.extras import RealDictCursor
import os
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix="/api/messaging", tags=["messaging"])

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

class MessageCreate(BaseModel):
    receiver_id: str
    content: str

class MessageResponse(BaseModel):
    id: str
    sender_id: str
    receiver_id: str
    content: str
    is_moderated: bool
    moderation_status: str
    created_at: str
    read_at: Optional[str] = None

@router.post("/send", response_model=MessageResponse)
async def send_message(message: MessageCreate, user_id: str = Query(default="demo_user")):
    """Send a moderated message"""
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # Get or create user UUIDs
        cur.execute("SELECT get_or_create_user(%s) as sender_uuid", (user_id,))
        sender_result = cur.fetchone()
        sender_uuid = sender_result['sender_uuid'] if sender_result else str(uuid.uuid4())
        
        cur.execute("SELECT get_or_create_user(%s) as receiver_uuid", (message.receiver_id,))
        receiver_result = cur.fetchone()
        receiver_uuid = receiver_result['receiver_uuid'] if receiver_result else str(uuid.uuid4())
        
        message_id = str(uuid.uuid4())
        now = datetime.now()
        
        cur.execute("""
            INSERT INTO messages (id, sender_id, receiver_id, content, is_moderated, moderation_status, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id, sender_id, receiver_id, content, is_moderated, moderation_status, created_at, read_at
        """, (message_id, sender_uuid, receiver_uuid, message.content, True, 'pending', now))
        
        result = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()
        
        return {
            "id": str(result['id']),
            "sender_id": result['sender_id'],
            "receiver_id": result['receiver_id'],
            "content": result['content'],
            "is_moderated": result['is_moderated'],
            "moderation_status": result['moderation_status'],
            "created_at": result['created_at'].isoformat(),
            "read_at": result['read_at'].isoformat() if result['read_at'] else None
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.get("/conversations", response_model=List[dict])
async def get_conversations(user_id: str = Query(default="demo_user")):
    """Get all conversations for a user"""
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # Get user UUID
        cur.execute("SELECT get_or_create_user(%s) as user_uuid", (user_id,))
        user_result = cur.fetchone()
        user_uuid = user_result['user_uuid'] if user_result else str(uuid.uuid4())
        
        cur.execute("""
            SELECT DISTINCT 
                CASE 
                    WHEN sender_id = %s THEN receiver_id 
                    ELSE sender_id 
                END as other_user_id,
                u.email as other_user_email
            FROM messages m
            LEFT JOIN users u ON u.id = CASE 
                WHEN m.sender_id = %s THEN m.receiver_id 
                ELSE m.sender_id 
            END
            WHERE (sender_id = %s OR receiver_id = %s) 
            AND deleted_at IS NULL
            ORDER BY (
                SELECT MAX(created_at) 
                FROM messages m2 
                WHERE (m2.sender_id = m.sender_id AND m2.receiver_id = m.receiver_id)
                   OR (m2.sender_id = m.receiver_id AND m2.receiver_id = m.sender_id)
            ) DESC
        """, (user_uuid, user_uuid, user_uuid, user_uuid))
        
        conversations = cur.fetchall()
        cur.close()
        conn.close()
        
        return [dict(conv) for conv in conversations]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.get("/conversation/{other_user_id}", response_model=List[MessageResponse])
async def get_conversation(other_user_id: str, user_id: str = Query(default="demo_user")):
    """Get messages in a conversation"""
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # Get user UUIDs
        cur.execute("SELECT get_or_create_user(%s) as user_uuid", (user_id,))
        user_result = cur.fetchone()
        user_uuid = user_result['user_uuid'] if user_result else str(uuid.uuid4())
        
        cur.execute("SELECT get_or_create_user(%s) as other_uuid", (other_user_id,))
        other_result = cur.fetchone()
        other_uuid = other_result['other_uuid'] if other_result else str(uuid.uuid4())
        
        cur.execute("""
            SELECT id, sender_id, receiver_id, content, is_moderated, moderation_status, created_at, read_at
            FROM messages
            WHERE ((sender_id = %s AND receiver_id = %s) OR (sender_id = %s AND receiver_id = %s))
            AND deleted_at IS NULL
            AND moderation_status = 'approved'
            ORDER BY created_at ASC
        """, (user_uuid, other_uuid, other_uuid, user_uuid))
        
        messages = cur.fetchall()
        cur.close()
        conn.close()
        
        return [{
            "id": str(msg['id']),
            "sender_id": msg['sender_id'],
            "receiver_id": msg['receiver_id'],
            "content": msg['content'],
            "is_moderated": msg['is_moderated'],
            "moderation_status": msg['moderation_status'],
            "created_at": msg['created_at'].isoformat(),
            "read_at": msg['read_at'].isoformat() if msg['read_at'] else None
        } for msg in messages]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
