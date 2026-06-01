"""
Database connection and session management
Supports simulation mode (SQLite) and production mode (PostgreSQL)
"""

import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.ext.declarative import declarative_base
from typing import Generator

load_dotenv()

# Check if we're in simulation mode
SIMULATION_MODE = os.getenv("APP_MODE", "simulation") == "simulation"

if SIMULATION_MODE:
    # Simulation mode - use in-memory SQLite
    DATABASE_URL = "sqlite:///./simulation.db"
    print("🗄️  Database: Simulation mode (SQLite)")
else:
    # Production mode - use PostgreSQL
    # For local dev, use the current user without password
    DATABASE_URL = os.getenv(
        "DATABASE_URL",
        "postgresql://localhost/goal_planning"
    )
    print(f"🗄️  Database: Production mode (PostgreSQL)")

# Create SQLAlchemy engine
if SIMULATION_MODE:
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(DATABASE_URL)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()

async def init_db():
    """Initialize database connection"""
    if SIMULATION_MODE:
        print("   ✓ Database initialized (simulation mode - SQLite)")
        return True
    
    # Test PostgreSQL connection
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT COUNT(*) FROM users"))
            count = result.scalar()
            print(f"   ✓ Database connected: PostgreSQL")
            print(f"   ✓ Users table has {count} records")
        return True
    except Exception as e:
        print(f"   ❌ Database connection failed: {e}")
        return False

def get_db() -> Generator[Session, None, None]:
    """Get database session - use as dependency"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_db_session() -> Session:
    """Get a new database session directly"""
    return SessionLocal()
