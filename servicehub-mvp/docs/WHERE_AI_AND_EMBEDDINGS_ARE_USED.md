# Where Vector Embeddings and AI Are Used in ServiceHub

## Vector Embeddings Usage

Vector embeddings are **384-dimensional numerical representations** of text/data that enable semantic similarity search. They're generated using the free local model `Xenova/all-MiniLM-L6-v2`.

### 1. **Home Page - Personalized Recommendations**
- **File**: `app/page.tsx` → `RecommendedSection()`
- **What**: Uses user's barrier embedding to find similar users, then recommends resources those users rated highly
- **Vector Operations**:
  - `findSimilarUsers()` - Finds users with similar barrier profiles using cosine similarity
  - User embeddings stored in `user_embeddings.barrier_embedding`
- **User Impact**: Sees personalized "Recommended for You" section

### 2. **Search Page - Semantic Search**
- **File**: `app/api/search/route.ts`
- **What**: Converts search query to embedding, finds semantically similar resources
- **Vector Operations**:
  - `semanticResourceSearch()` - Converts query text to embedding, searches resource embeddings
  - Resource embeddings stored in `resource_embeddings.embedding` and `resource_embeddings.description_embedding`
- **User Impact**: Finds resources by meaning, not just keywords (e.g., "autism therapist" finds "ASD support services")

### 3. **Resource Detail Page - Similar Resources**
- **File**: `app/resources/[id]/page.tsx`
- **What**: Finds resources semantically similar to the current resource
- **Vector Operations**:
  - `findSimilarResources()` - Uses resource embedding to find similar resources via cosine similarity
- **User Impact**: Sees "Similar Resources" section with semantically related resources

### 4. **User Onboarding - Embedding Generation**
- **File**: `app/api/onboarding/complete/route.ts`
- **What**: Generates user's barrier embedding when they complete onboarding
- **Vector Operations**:
  - `generateBarrierEmbedding()` - Converts user's barriers to embedding
  - `upsertUserEmbedding()` - Stores embedding in `user_embeddings` table
- **User Impact**: Enables personalized recommendations and user similarity matching

### 5. **Resource Creation - Embedding Generation**
- **File**: `lib/embeddings/auto-generate.ts` → `onResourceCreated()`
- **What**: Generates resource embeddings when resources are created/approved
- **Vector Operations**:
  - `generateResourceEmbedding()` - Converts resource (name, description, category) to embedding
  - `generateResourceDescriptionEmbedding()` - Separate embedding for description
  - `upsertResourceEmbedding()` - Stores embeddings in `resource_embeddings` table
- **User Impact**: Enables semantic search and similar resources feature

### 6. **Recommendation Agent - Similar User Matching**
- **File**: `lib/agents/recommendation-agent/similarity.ts`
- **What**: Finds users with similar barrier profiles for collaborative filtering
- **Vector Operations**:
  - `findSimilarUsers()` - Uses pgvector to find similar users efficiently
- **User Impact**: Better recommendations based on users with similar needs

### 7. **Pattern Agent - User Clustering**
- **File**: `lib/agents/pattern-agent/clustering.ts`
- **What**: Groups users with similar barrier profiles to discover patterns
- **Vector Operations**:
  - Uses user embeddings to cluster users
  - Analyzes cluster preferences for pattern discovery
- **User Impact**: Discovers patterns like "Users with autism + ADHD prefer X resources"

---

## AI Agents Usage

The AI system consists of **3 specialized agents** coordinated by an **Orchestrator** and combined by a **Synthesis Engine**. Currently implemented as rule-based algorithms (easily upgradeable to LLM-powered).

### 1. **Home Page - AI-Powered Recommendations**
- **File**: `app/page.tsx` → `RecommendedSection()`
- **Agents Used**: All agents via Orchestrator
  - **Orchestrator** (`lib/agents/orchestrator/index.ts`) - Coordinates all agents
  - **Recommendation Agent** - Finds personalized resources
  - **Pattern Agent** - Discovers relevant patterns
  - **Validation Agent** - Filters low-quality resources
  - **Synthesis Engine** - Combines outputs with explanations
- **Code**:
  ```typescript
  const orchestrationResult = await orchestrator.handleRequest({
    userId: user.id,
    requestType: 'recommendations',
    barriers: userBarriers,
    context: { location }
  })
  ```
- **User Impact**: Sees personalized recommendations with explanations and confidence scores

### 2. **Home Page - Discovered Patterns**
- **File**: `app/page.tsx` → `RecentPatternsSection()` (if implemented)
- **Agent Used**: Pattern Recognition Agent
- **What**: Shows patterns discovered by the Pattern Agent (barrier combinations, resource affinities)
- **User Impact**: Sees insights like "Users with autism + ADHD rate these resources 4.8/5"

### 3. **Search - AI-Enhanced Search (via Orchestrator)**
- **File**: `lib/agents/orchestrator/index.ts` → `handleSearchRequest()`
- **Agent Used**: Orchestrator (can coordinate Pattern and Recommendation agents for search)
- **What**: Can enhance search with agent-based ranking and filtering
- **Note**: Currently search uses direct semantic search, but orchestrator can be integrated

### 4. **Resource Submission - Content Validation**
- **File**: `app/api/resources/new/route.ts`
- **Agent Used**: Validation Agent
- **What**: Validates new resource submissions
  - Spam detection
  - Duplicate detection
  - Content quality checks
  - User trust scoring
- **Code**:
  ```typescript
  const validationResult = await validationAgent.validate({
    itemType: 'resource',
    item: resourceData,
    context: { userId, userHistory }
  })
  ```
- **User Impact**: Resources are automatically validated before moderation queue

### 5. **Rating Submission - Content Validation**
- **File**: `app/api/resources/[id]/ratings/route.ts`
- **Agent Used**: Validation Agent
- **What**: Validates rating submissions
  - Spam detection (repeated characters, URLs, profanity)
  - User trust scoring
  - Behavioral pattern detection
- **Code**:
  ```typescript
  const validationResult = await validationAgent.validate({
    itemType: 'rating',
    item: ratingData,
    context: { userId, userHistory }
  })
  ```
- **User Impact**: Low-quality ratings are automatically flagged for moderation

### 6. **Admin Moderation Dashboard**
- **File**: `app/admin/moderation/page.tsx`
- **Agent Used**: Validation Agent
- **What**: Shows items flagged by Validation Agent
  - Displays agent's decision (approve/reject/flag)
  - Shows agent's reasoning and confidence scores
  - Allows admin overrides (creates feedback loop)
- **Admin Impact**: Sees AI-powered content quality assessments

### 7. **API Endpoints - Direct Agent Access**
- **Files**: 
  - `app/api/agents/recommendations/route.ts` - Recommendation Agent API
  - `app/api/agents/patterns/route.ts` - Pattern Agent API
  - `app/api/agents/validate/route.ts` - Validation Agent API
  - `app/api/orchestrator/route.ts` - Orchestrator API (main entry point)
- **What**: Direct access to agents via REST API
- **Use Cases**: Can be called from frontend, other services, or webhooks

---

## Summary Table

| Feature | Location | Vector Embeddings? | AI Agents? | Purpose |
|---------|----------|-------------------|------------|---------|
| Home Page Recommendations | `app/page.tsx` | ✅ Yes | ✅ Yes | Personalized resource recommendations |
| Search (Semantic) | `app/api/search/route.ts` | ✅ Yes | ❌ No | Find resources by meaning |
| Similar Resources | `app/resources/[id]/page.tsx` | ✅ Yes | ❌ No | Find semantically similar resources |
| User Onboarding | `app/api/onboarding/complete/route.ts` | ✅ Yes | ❌ No | Generate user barrier embedding |
| Resource Creation | `lib/embeddings/auto-generate.ts` | ✅ Yes | ❌ No | Generate resource embedding |
| Resource Submission | `app/api/resources/new/route.ts` | ❌ No | ✅ Yes | Validate content quality |
| Rating Submission | `app/api/resources/[id]/ratings/route.ts` | ❌ No | ✅ Yes | Validate rating quality |
| Admin Moderation | `app/admin/moderation/page.tsx` | ❌ No | ✅ Yes | Review AI validation decisions |
| Recommendation Agent | `lib/agents/recommendation-agent/` | ✅ Yes | ✅ Yes | Find personalized resources |
| Pattern Agent | `lib/agents/pattern-agent/` | ✅ Yes | ✅ Yes | Discover patterns in data |
| Validation Agent | `lib/agents/validation-agent/` | ❌ No | ✅ Yes | Validate content quality |

---

## Key Technologies

### Vector Embeddings
- **Model**: `Xenova/all-MiniLM-L6-v2` (384 dimensions)
- **Storage**: PostgreSQL with pgvector extension
- **Cost**: FREE (runs locally, no API costs)
- **Location**: `lib/embeddings/generator.ts`

### AI Agents
- **Architecture**: Multi-agent system with Orchestrator
- **Current**: Rule-based algorithms (MVP)
- **Future**: Upgradeable to LLM-powered (Claude, GPT)
- **Location**: `lib/agents/`

### Vector Database
- **Technology**: Supabase PostgreSQL + pgvector
- **Tables**: 
  - `user_embeddings` (user barrier embeddings)
  - `resource_embeddings` (resource embeddings)
- **Functions**: SQL functions in `lib/supabase/vector-functions.sql`
- **Location**: `lib/supabase/vector-queries.ts`

---

## Data Flow Example

**User visits home page with barriers (autism, ADHD):**

1. **Vector Embeddings**:
   - User's barrier embedding retrieved from `user_embeddings.barrier_embedding`
   - `findSimilarUsers()` finds users with similar embeddings
   - Those users' rated resources become candidates

2. **AI Agents** (via Orchestrator):
   - **Recommendation Agent** scores candidates based on:
     - Barrier match (40%)
     - Ratings from similar users (30%)
     - Popularity (30%)
   - **Pattern Agent** discovers patterns (e.g., "autism + ADHD users prefer X")
   - **Validation Agent** filters low-quality resources
   - **Synthesis Engine** combines outputs with explanations

3. **Result**: User sees personalized recommendations with explanations and confidence scores

---

## Future Upgrades

Current implementations are designed to be easily upgraded:

1. **Vector Embeddings**: Already using best-in-class free model
2. **AI Agents**: Can swap rule-based logic for LLM API calls (Claude, GPT)
3. **Orchestrator**: Can add parallel execution, message queues
4. **Pattern Agent**: Can upgrade to ML clustering (k-means, DBSCAN)
