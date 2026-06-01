# ServiceHub Agent Architecture

## Overview

ServiceHub uses a **multi-agent AI system** where specialized agents work together to provide personalized recommendations, discover patterns in community data, and ensure content quality. The system is designed with a clear migration path from rule-based MVP implementations to full LLM-powered agents.

## Architecture Principles

1. **Modularity**: Each agent is self-contained with clear responsibilities
2. **Composability**: Agents can work independently or together via the Orchestrator
3. **Explainability**: All agent decisions include confidence scores and explanations
4. **Migration Path**: Rule-based implementations can be swapped for LLM-powered versions without changing interfaces
5. **Scalability**: Agent system is designed to handle growth and parallel execution

## Agent Communication Flow

```
User Request
    ↓
Orchestrator (routes request)
    ↓
┌─────────────────────────────┐
│  Pattern Recognition Agent  │ (Discovers patterns)
│  Recommendation Agent       │ (Finds relevant resources)
│  Validation Agent           │ (Checks quality)
└─────────────────────────────┘
    ↓
Synthesis Engine (combines outputs)
    ↓
Final Response (with explanations)
```

## MVP Implementation (Current)

The current implementation uses **rule-based agents** that mimic agentic AI behavior. Each agent is a self-contained module with clear responsibilities and a defined interface.

### Agent Components

#### Agent 1: Recommendation Agent

**Location**: `/lib/agents/recommendation-agent/`

**Purpose**: Match users with resources based on their barrier profiles using collaborative filtering and similarity scoring.

**Current Implementation**:
- Uses vector similarity to find users with similar barriers
- Scores resources based on ratings from similar users
- Multi-factor scoring algorithm:
  - Barrier match score (40%)
  - Community rating from similar users (30%)
  - Popularity among users with same barriers (30%)
- Generates explanations for recommendations

**Key Functions**:
- `generateRecommendations()`: Main entry point
- `findSimilarUsers()`: Uses vector database to find similar users
- `getCandidateResources()`: Gets resources rated highly by similar users
- `scoreResources()`: Multi-factor scoring algorithm
- `generateExplanations()`: Creates human-readable explanations

**Upgrade Path**:
- Replace scoring algorithm with Claude/GPT API calls
- Use LLM to generate natural language explanations
- Implement semantic matching with embeddings
- Add context-aware recommendations (time of day, season, user goals)

**Files**:
- `index.ts`: Main agent interface
- `similarity.ts`: User similarity calculations
- `matcher.ts`: Resource matching logic
- `scorer.ts`: Multi-factor scoring algorithm
- `types.ts`: TypeScript interfaces

---

#### Agent 2: Pattern Recognition Agent

**Location**: `/lib/agents/pattern-agent/`

**Purpose**: Discover hidden patterns and connections in community data autonomously.

**Current Implementation**:
- Statistical analysis of barrier combinations
- Association rules for resource affinity
- User clustering using vector embeddings
- Pattern ranking by confidence and frequency

**Key Functions**:
- `discoverPatterns()`: Main entry point
- `findBarrierCombinations()`: Finds common barrier combinations
- `findResourceAffinity()`: Discovers which resources are rated together
- `findIntersectionalityPatterns()`: Analyzes intersectionality patterns
- `exploreNonObviousConnections()`: Finds surprising correlations

**Pattern Types**:
1. **Barrier Combinations**: "Users with autism + ADHD rate resources X% higher"
2. **Resource Affinity**: "Users who like Resource A also highly rate Resource B"
3. **Intersectionality**: "LGBTQ+ users with autism have different preferences"
4. **Non-Obvious Connections**: "Resources in Category X help with Barrier Y"

**Upgrade Path**:
- Replace statistical analysis with ML clustering (k-means, DBSCAN)
- Use LLM to generate insights from patterns
- Implement anomaly detection for new patterns
- Add temporal pattern analysis (trends over time)

**Files**:
- `index.ts`: Main agent interface
- `clustering.ts`: User clustering and barrier combinations
- `associations.ts`: Resource affinity discovery
- `insights.ts`: Human-readable insight generation
- `types.ts`: TypeScript interfaces

---

#### Agent 3: Validation Agent

**Location**: `/lib/agents/validation-agent/`

**Purpose**: Quality control and content moderation - independently decides what content is genuine vs. suspicious.

**Current Implementation**:
- Rule-based spam detection (patterns, keywords, length)
- User trust scoring (account age, contributions, violations)
- Content validation (profanity, completeness, duplicates)
- Behavioral pattern analysis (abuse detection)

**Key Functions**:
- `validate()`: Main entry point
- `validateContent()`: Content quality checks
- `detectSpam()`: Spam pattern detection
- `calculateUserTrust()`: User trust score (0-100)
- `detectAbuse()`: Suspicious activity patterns

**Decision Logic**:
- **Approve**: Trust score > 70 AND validation score > 80
- **Reject**: Trust score < 30 OR validation score < 40
- **Flag for Review**: Everything else

**Upgrade Path**:
- Replace rule-based checks with ML-powered fraud detection
- Use LLM for content analysis (sentiment, appropriateness)
- Implement adaptive learning from admin overrides
- Add real-time anomaly detection

**Files**:
- `index.ts`: Main agent interface
- `spam-detector.ts`: Spam pattern detection
- `trust-scorer.ts`: User trust calculation
- `content-validator.ts`: Content quality checks
- `abuse-detector.ts`: Behavioral pattern analysis
- `types.ts`: TypeScript interfaces

---

#### Orchestrator

**Location**: `/lib/agents/orchestrator/`

**Purpose**: Coordinate all agents, route requests, and manage agent interactions.

**Current Implementation**:
- Routes user requests to appropriate agents
- Manages sequential agent execution
- Handles conflict resolution between agents
- Tracks agent execution times and activity

**Key Functions**:
- `handleRequest()`: Main entry point
- `handleRecommendationRequest()`: Coordinates recommendation flow
- `handleSearchRequest()`: Coordinates search with pattern enhancement
- `handleValidationRequest()`: Coordinates validation flow
- `resolveAgentConflict()`: Resolves conflicts between agent outputs

**Request Types**:
1. **Recommendations**: Pattern Agent → Recommendation Agent → Validation Agent → Synthesis
2. **Search**: Search Service → Pattern Agent (enhancement) → Synthesis
3. **Validation**: Validation Agent → Decision

**Upgrade Path**:
- Implement parallel agent execution using message queues (RabbitMQ)
- Add advanced conflict resolution strategies
- Implement agent prioritization and routing policies
- Add agent health monitoring and failover

**Files**:
- `index.ts`: Main orchestrator interface
- `router.ts`: Request routing logic
- `coordinator.ts`: Agent interaction management
- `types.ts`: TypeScript interfaces

---

#### Synthesis Engine

**Location**: `/lib/agents/synthesis-engine/`

**Purpose**: Combine all agent outputs into coherent, explainable responses.

**Current Implementation**:
- Weighted ranking of results from multiple agents
- Pattern boosting (resources that match discovered patterns get higher scores)
- Validation filtering (removes resources flagged by Validation Agent)
- Explanation generation (combines insights from all agents)
- Confidence calculation (weighted average of agent confidences)

**Key Functions**:
- `synthesize()`: Main entry point
- `rankResults()`: Combines and ranks results from agents
- `applyValidation()`: Filters out flagged content
- `generateExplanation()`: Creates human-readable explanations
- `calculateOverallConfidence()`: Weighted confidence score
- `documentContributions()`: Tracks each agent's contribution

**Synthesis Logic**:
- Recommendation Agent: 40% weight
- Pattern Agent: 30% weight (boost for pattern matches)
- Validation Agent: 30% weight (filter/penalty)

**Upgrade Path**:
- Replace template explanations with LLM-powered natural language generation
- Implement dynamic weighting based on context
- Add explanation customization (detailed vs. simple)
- Implement multi-language explanations

**Files**:
- `index.ts`: Main synthesis engine interface
- `ranker.ts`: Result ranking and scoring
- `explainer.ts`: Explanation generation
- `types.ts`: TypeScript interfaces

---

## Agent Interaction Patterns

### 1. Recommendation Flow

```
User requests recommendations
    ↓
Orchestrator activates Pattern Agent
    ↓ (Discovers relevant patterns)
Orchestrator activates Recommendation Agent
    ↓ (Finds candidate resources)
Orchestrator activates Validation Agent
    ↓ (Filters low-quality resources)
Synthesis Engine combines outputs
    ↓
Returns ranked resources with explanations
```

### 2. Search Flow

```
User searches for resources
    ↓
Orchestrator performs semantic + keyword search
    ↓
Orchestrator activates Pattern Agent (optional)
    ↓ (Enhances results with patterns)
Synthesis Engine ranks results
    ↓
Returns enhanced search results
```

### 3. Validation Flow

```
User submits rating/resource
    ↓
Orchestrator activates Validation Agent
    ↓
Validation Agent checks:
  - Content quality
  - Spam patterns
  - User trust
  - Behavioral patterns
    ↓
Returns decision (approve/reject/flag)
```

## Vector Database Integration

All agents leverage the **pgvector** extension for semantic similarity:

- **User Embeddings**: Captures user's full barrier profile as a vector
- **Resource Embeddings**: Captures resource description and characteristics
- **Similarity Search**: Uses cosine similarity to find similar users/resources
- **Semantic Search**: Enables natural language search over resource descriptions

**Key Functions** (in `/lib/supabase/vector-queries.ts`):
- `findSimilarUsers()`: Find users with similar barrier profiles
- `findSimilarResources()`: Find semantically similar resources
- `semanticResourceSearch()`: Natural language resource search
- `findResourcesForUser()`: Personalized resource discovery

## Agent Output Format

All agents return structured outputs with:

```typescript
interface AgentOutput {
  // Agent-specific results
  results: any[]
  
  // Confidence score (0-100)
  confidence: number
  
  // Human-readable explanation
  explanation?: string
  
  // Metadata (execution time, etc.)
  metadata?: Record<string, any>
}
```

## Migration to LLM-Powered Agents

### Phase 1: Current (MVP)
- Rule-based implementations
- Statistical analysis
- Template-based explanations

### Phase 2: Hybrid (Post-Funding)
- Keep rule-based core
- Add LLM for explanations
- Use LLM for pattern insight generation

### Phase 3: Full LLM (Scale)
- Replace scoring algorithms with LLM calls
- LLM-powered pattern discovery
- Natural language explanations
- Context-aware reasoning

### Migration Strategy

1. **Keep Interfaces Stable**: Agent interfaces remain the same
2. **Gradual Replacement**: Swap implementations one function at a time
3. **A/B Testing**: Compare rule-based vs. LLM-powered outputs
4. **Fallback Mechanisms**: Keep rule-based as fallback if LLM fails
5. **Cost Optimization**: Use LLM strategically (explanations, complex reasoning)

## API Endpoints

### Agent Endpoints

- `POST /api/orchestrator`: Main entry point for all agent requests
- `GET /api/agents/recommendations`: Get recommendations (GET) or query (POST)
- `GET /api/agents/patterns`: Get discovered patterns or trigger discovery (POST)
- `POST /api/agents/validate`: Validate content

### Admin Endpoints

- `GET /api/admin/agent-activity`: View agent activity and performance metrics

## Monitoring & Observability

### Agent Metrics

- Execution time per agent
- Confidence score distribution
- Error rates
- Agent activation frequency

### Admin Dashboard

- Agent activity log (`/app/admin/agent-activity`)
- Execution times
- Coordination patterns
- Agent contribution breakdown

## Best Practices

1. **Always Include Explanations**: Users should understand why agents made decisions
2. **Track Confidence**: Lower confidence scores indicate uncertainty
3. **Handle Failures Gracefully**: Agents should fail safely with fallbacks
4. **Log Everything**: Track all agent decisions for improvement
5. **Test Thoroughly**: Test agents with diverse inputs and edge cases
6. **Document Decisions**: Code should explain why agents make specific choices
7. **Version Control**: Track agent implementations for rollback if needed

## Future Enhancements

- **Multi-Agent Collaboration**: Agents can query each other for information
- **Learning from Feedback**: Agents improve based on user interactions
- **Personalization**: Agents adapt to individual user preferences over time
- **Real-Time Updates**: Agents respond to data changes in real-time
- **Agent Marketplace**: Allow community to contribute agent improvements
- **Explainable AI Dashboard**: Visualize agent reasoning for users

## Related Documentation

- `/lib/agents/README.md`: Quick start guide for developers
- `/docs/TESTING_CHECKLIST.md`: Testing guide for agent system
- `/lib/embeddings/README.md`: Vector database and embeddings documentation
