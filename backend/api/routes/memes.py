from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
import psycopg2
import os
from datetime import datetime

router = APIRouter()

# Database connection helper
def get_db_connection():
    database_url = os.getenv(
        "DATABASE_URL",
        f"postgresql://{os.getenv('USER', 'aayushbhan')}:password@localhost:5432/goal_planning"
    )
    return psycopg2.connect(database_url)

# Pydantic models
class MemeCreate(BaseModel):
    content_type: str = "emoji"  # emoji, image, text
    content: str
    caption: Optional[str] = None
    shared_with: Optional[List[str]] = []  # List of user IDs to share with (empty = all connections)

class MemeResponse(BaseModel):
    id: str
    user_id: str
    content_type: str
    content: str
    caption: Optional[str]
    shared_with: List[str]
    likes: int
    created_at: str
    liked_by_user: bool = False

class MemeLike(BaseModel):
    meme_id: str

@router.post("/share")
async def share_meme(
    meme: MemeCreate,
    user_id: str = Query(..., description="User ID")
):
    """Share a meme with connections"""
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get or create user
        cursor.execute("""
            SELECT get_or_create_user(%s) as user_uuid
        """, (user_id,))
        result = cursor.fetchone()
        user_uuid = result[0] if result else None
        
        if not user_uuid:
            raise HTTPException(status_code=400, detail="Invalid user ID")
        
        # Insert meme
        cursor.execute("""
            INSERT INTO memes (user_id, content_type, content, caption, shared_with)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id, created_at
        """, (
            user_uuid,
            meme.content_type,
            meme.content,
            meme.caption,
            meme.shared_with if meme.shared_with else []
        ))
        
        result = cursor.fetchone()
        meme_id = result[0]
        created_at = result[1]
        
        conn.commit()
        
        return {
            "id": str(meme_id),
            "message": "Meme shared successfully!",
            "created_at": created_at.isoformat()
        }
    except Exception as e:
        if conn:
            conn.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        if conn:
            cursor.close()
            conn.close()

@router.get("/feed")
async def get_meme_feed(
    user_id: str = Query(..., description="User ID"),
    limit: int = Query(20, ge=1, le=100)
):
    """Get meme feed from connections"""
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get or create user
        cursor.execute("""
            SELECT get_or_create_user(%s) as user_uuid
        """, (user_id,))
        result = cursor.fetchone()
        user_uuid = result[0] if result else None
        
        if not user_uuid:
            raise HTTPException(status_code=400, detail="Invalid user ID")
        
        # Get memes from connections (or public memes if shared_with is empty)
        cursor.execute("""
            SELECT 
                m.id,
                m.user_id,
                m.content_type,
                m.content,
                m.caption,
                m.shared_with,
                m.likes,
                m.created_at,
                CASE WHEN ml.user_id IS NOT NULL THEN true ELSE false END as liked_by_user
            FROM memes m
            LEFT JOIN meme_likes ml ON m.id = ml.meme_id AND ml.user_id = %s
            WHERE 
                m.user_id IN (
                    SELECT connected_user_id 
                    FROM connections 
                    WHERE user_id = %s AND status = 'accepted'
                    UNION
                    SELECT user_id 
                    FROM connections 
                    WHERE connected_user_id = %s AND status = 'accepted'
                )
                OR m.user_id = %s
                OR array_length(m.shared_with, 1) IS NULL
                OR %s = ANY(m.shared_with)
            ORDER BY m.created_at DESC
            LIMIT %s
        """, (user_uuid, user_uuid, user_uuid, user_uuid, user_uuid, limit))
        
        memes = []
        for row in cursor.fetchall():
            memes.append({
                "id": str(row[0]),
                "user_id": str(row[1]),
                "content_type": row[2],
                "content": row[3],
                "caption": row[4],
                "shared_with": row[5] if row[5] else [],
                "likes": row[6],
                "created_at": row[7].isoformat() if row[7] else None,
                "liked_by_user": row[8]
            })
        
        return memes
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        if conn:
            cursor.close()
            conn.close()

@router.post("/like")
async def like_meme(
    user_id: str = Query(..., description="User ID"),
    meme_id: str = Query(..., description="Meme ID")
):
    """Like or unlike a meme"""
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get or create user
        cursor.execute("""
            SELECT get_or_create_user(%s) as user_uuid
        """, (user_id,))
        result = cursor.fetchone()
        user_uuid = result[0] if result else None
        
        if not user_uuid:
            raise HTTPException(status_code=400, detail="Invalid user ID")
        
        # Check if already liked
        cursor.execute("""
            SELECT id FROM meme_likes 
            WHERE meme_id = %s AND user_id = %s
        """, (meme_id, user_uuid))
        
        existing = cursor.fetchone()
        
        if existing:
            # Unlike
            cursor.execute("""
                DELETE FROM meme_likes 
                WHERE meme_id = %s AND user_id = %s
            """, (meme_id, user_uuid))
            
            cursor.execute("""
                UPDATE memes SET likes = GREATEST(0, likes - 1)
                WHERE id = %s
            """, (meme_id,))
            
            action = "unliked"
        else:
            # Like
            cursor.execute("""
                INSERT INTO meme_likes (meme_id, user_id)
                VALUES (%s, %s)
            """, (meme_id, user_uuid))
            
            cursor.execute("""
                UPDATE memes SET likes = likes + 1
                WHERE id = %s
            """, (meme_id,))
            
            action = "liked"
        
        conn.commit()
        
        return {"message": f"Meme {action} successfully", "action": action}
    except Exception as e:
        if conn:
            conn.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        if conn:
            cursor.close()
            conn.close()
