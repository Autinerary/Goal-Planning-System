"""
Configuration for Goal Planning System
Supports simulation mode (no API keys needed) and production mode
"""

import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    """Application configuration"""
    
    # Mode: 'simulation' or 'production'
    MODE = os.getenv("APP_MODE", "simulation")
    
    # Simulation mode - no external services needed
    SIMULATION_MODE = MODE == "simulation"
    
    # Database
    DATABASE_URL = os.getenv(
        "DATABASE_URL",
        "sqlite:///./simulation.db" if SIMULATION_MODE else "postgresql://user:password@localhost:5432/goal_planning"
    )
    
    # API Keys (only needed in production)
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
    PINECONE_API_KEY = os.getenv("PINECONE_API_KEY", "")
    PINECONE_INDEX_HOST = os.getenv("PINECONE_INDEX_HOST", "")
    PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX_NAME", "goal-planning-users")
    
    # Vector DB
    VECTOR_DB_URL = os.getenv("VECTOR_DB_URL", "")
    
    @classmethod
    def is_simulation(cls) -> bool:
        return cls.SIMULATION_MODE
    
    @classmethod
    def get_mode_info(cls) -> dict:
        return {
            "mode": cls.MODE,
            "simulation": cls.SIMULATION_MODE,
            "database": "SQLite (in-memory)" if cls.SIMULATION_MODE else "PostgreSQL",
            "llm": "Mock responses" if cls.SIMULATION_MODE else "OpenAI",
            "vector_db": "Mock similarity" if cls.SIMULATION_MODE else "Pinecone"
        }


# Print mode on startup
print(f"🚀 Running in {Config.MODE.upper()} mode")
if Config.SIMULATION_MODE:
    print("   ✓ No API keys required")
    print("   ✓ Using mock data and responses")
    print("   ✓ SQLite in-memory database")
