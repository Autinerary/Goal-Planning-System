# Goal Planning System - Autinerary

An agentic AI system that creates personalized life plans specifically designed for unique combinations of systematic barriers.

## Architecture

- **Frontend**: Next.js (React) with TypeScript
- **Backend**: Python FastAPI with multi-agent orchestration (LangGraph)
- **Database**: Supabase (PostgreSQL + pgvector for similarity search)
- **AI Agents**: 6 specialized agents (Path Planning, Pattern Recognition, Recommendation, Reflection Analysis, Adaptation, Calendar Optimization)

## Project Structure

```
Goal-Planning-System/
├── frontend/          # Next.js application
├── backend/           # FastAPI multi-agent system
├── shared/            # Shared types and utilities
├── database/          # Database schemas and migrations
└── docs/              # Documentation
```

## Getting Started

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

## Views

0. **Onboarding/Questionnaire** - User profile and barrier identification
1. **Path View** - Overview with stats, motivation wheel, race progress
2. **Race View** - Step-by-step milestones toward goals
3. **Milestone View** - Detailed milestone with recommended tools
3.5. **Pit Stop View** - Quick access to tools and resources
4. **Calendar View** - Schedule in list or time-block format
5. **Task View** - Individual task with helper tricks
6. **Journal/Reflection View** - Reflection and journaling

## Multi-Agent System

The system uses 6 specialized AI agents coordinated by an Orchestrator:

1. **Path Planning Agent** - Creates roadmap from current state to goals
2. **Pattern Recognition Agent** - Learns from similar users' journeys
3. **Tool Recommendation Agent** - Connects users with resources
4. **Reflection Analysis Agent** - Analyzes journals and reflections
5. **Adaptation Agent** - Adjusts plans based on progress
6. **Calendar Optimization Agent** - Schedules tasks realistically
