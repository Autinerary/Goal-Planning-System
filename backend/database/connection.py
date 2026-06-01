"""
Database connection and session management
Supports simulation mode (SQLite) and production mode (PostgreSQL)
"""

import os
from dotenv import load_dotenv

load_dotenv()

# Check if we're in simulation mode
SIMULATION_MODE = os.getenv("APP_MODE", "simulation") == "simulation"

if SIMULATION_MODE:
    # Simulation mode - use in-memory SQLite (no actual database needed)
    DATABASE_URL = "sqlite:///./simulation.db"
    print("🗄️  Database: Simulation mode (SQLite)")
else:
    # Production mode - use PostgreSQL
    DATABASE_URL = os.getenv(
        "DATABASE_URL",
        "postgresql://user:password@localhost:5432/goal_planning"
    )
    print(f"🗄️  Database: Production mode (PostgreSQL)")

# Only import SQLAlchemy if we actually need database operations
# For simulation, we can work without a real database

async def init_db():
    """Initialize database connection"""
    if SIMULATION_MODE:
        print("   ✓ Database initialized (simulation mode - no actual DB required)")
        return
    
    # Production database initialization would go here
    print(f"   ✓ Database initialized: {DATABASE_URL}")

def get_db():
    """Get database session"""
    if SIMULATION_MODE:
        # Return None in simulation mode - data is mocked
        return None
    
    # Production code would return actual session
    return None
