# Setup Instructions

## Prerequisites

- Node.js 18+ and npm
- Python 3.10+
- PostgreSQL 14+
- Redis (optional, for caching)

## Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Create virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your database credentials and API keys
```

5. Set up database:
```bash
# Create database
createdb goal_planning

# Run schema
psql goal_planning < ../database/schema.sql
```

6. Run backend:
```bash
uvicorn main:app --reload
```

Backend will be available at http://localhost:8000

## Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
# Edit .env.local with your API URL
```

4. Run frontend:
```bash
npm run dev
```

Frontend will be available at http://localhost:3000

## Usage

1. Start the backend server first
2. Start the frontend server
3. Navigate to http://localhost:3000
4. Complete the onboarding questionnaire
5. Your personalized path will be generated!

## Architecture

- **Frontend**: Next.js 14 with TypeScript and Tailwind CSS
- **Backend**: FastAPI with Python
- **Database**: Supabase (PostgreSQL)
- **AI Agents**: 6 specialized agents coordinated by Orchestrator
- **Vector DB**: Supabase pgvector (no external vector DB required)

## Development

- Backend API docs: http://localhost:8000/docs
- Frontend hot-reload: Enabled in dev mode
- Database migrations: Use Alembic (to be set up)

## Next Steps

1. Apply pgvector migrations (`servicehub-mvp/lib/supabase/schema.sql` and `backend/database/migrations/2026_pattern_user_embeddings.sql`)
2. Set up LLM API keys (OpenAI/Anthropic)
3. Add real data to knowledge base
4. Train/configure AI agents with actual models
5. Set up production deployment
