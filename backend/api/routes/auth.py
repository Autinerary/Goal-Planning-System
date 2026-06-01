"""
Authentication API Routes
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from typing import Optional

router = APIRouter()

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: Optional[str] = None

class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str

@router.post("/register", response_model=AuthResponse)
async def register(request: RegisterRequest):
    """Register new user"""
    # In production: Hash password, create user in DB
    return AuthResponse(
        access_token="mock_token",
        user_id="user_123"
    )

@router.post("/login", response_model=AuthResponse)
async def login(request: LoginRequest):
    """Login user"""
    # In production: Verify credentials
    return AuthResponse(
        access_token="mock_token",
        user_id="user_123"
    )
