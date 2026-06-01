# Where AI is Used in ServiceHub

This document explains where and how AI agents are integrated throughout the ServiceHub application.

## Overview

ServiceHub uses a **multi-agent AI system** with three specialized agents:
1. **Recommendation Agent** - Personalizes resource recommendations
2. **Pattern Recognition Agent** - Discovers hidden patterns in community data
3. **Validation Agent** - Ensures content quality and catches spam

All agents are coordinated by the **Orchestrator**, and their outputs are combined by the **Synthesis Engine**.

## Current Implementation

**Note:** The current implementation uses **rule-based algorithms** that mimic AI agent behavior. These are designed to be easily upgraded to full LLM-powered agents (Claude, GPT) post-funding.

## Where AI is Used

### 1. Home Page - Personalized Recommendations

**Location:** `/app/page.tsx` → `RecommendedSection()`

**What happens:**
- When a logged-in user visits the home page, the **Orchestrator** coordinates all agents
- **Pattern Agent** discovers relevant patterns
- **Recommendation Agent** finds resources matching the user's barriers
- **Validation Agent** filters out low-quality resources
- **Synthesis Engine** combines outputs and generates explanations

**User sees:**
- "Recommended for You" section with personalized resources
- Explanation of why each resource was recommended
- Confidence scores
- Agent contribution breakdown

**Code:**
```typescript
const orchestrationResult = await orchestrator.handleRequest({
  userId: user.id,
  requestType: 'recommendations',
  barriers: userBarriers,
  context: { location }
})
```

---

### 2. Home Page - Discovered Patterns

**Location:** `/app/page.tsx` → `RecentPatternsSection()`

**What happens:**
- **Pattern Recognition Agent** discovers patterns (barrier combinations, resource affinities)
- Patterns are cached in the database
- Recent patterns are displayed on the home page

**User sees:**
- "Recently Discovered Patterns" section
- Insights like "Users with autism + ADHD rate these resources 4.8/5"
- Pattern confidence and frequency

**Code:**
```typescript
const { data: cachedPatterns } = await supabase
  .from('pattern_discoveries')
  .select('*')
  .eq('scope', 'global')
  .order('discovered_at', { ascending: false })
  .limit(3)
```

---

### 3. Search - Semantic Search

**Location:** `/app/api/search/route.ts`

**What happens:**
- When user searches, query is converted to an embedding using local AI model
- **Vector similarity search** finds semantically similar resources
- Results are combined with traditional keyword search (hybrid search)

**User sees:**
- Search results that match the meaning of their query, not just keywords
- More relevant results (e.g., searching "autism therapist" finds resources about "ASD support services")

**Code:**
```typescript
if (query && query.trim().length > 0) {
  semanticResults = await semanticResourceSearch(query, pageSize * 2, 0.7)
  // Combine with keyword search...
}
```

---

### 4. Resource Detail Page - Similar Resources

**Location:** `/app/resources/[id]/page.tsx`

**What happens:**
- Uses **vector similarity** to find resources similar to the current resource
- Compares resource embeddings (description, characteristics)
- Falls back to category-based similarity if vector search returns few results

**User sees:**
- "Similar Resources" section on resource detail pages
- Resources that are semantically similar, not just same category

**Code:**
```typescript
const vectorResults = await findSimilarResources(resourceId, 6, 0.7)
```

---

### 5. Rating Submission - Content Validation

**Location:** `/app/api/resources/[id]/ratings/route.ts`

**What happens:**
- When user submits a rating, **Validation Agent** checks:
  - Spam patterns (repeated characters, excessive capitalization, URLs)
  - Profanity detection
  - User trust score
  - Behavioral patterns (too many submissions, suspicious activity)
- Agent decides: approve, reject, or flag for review

**User sees:**
- Rating is saved (if approved) or flagged for moderation
- No visible indication unless there's an issue (then admin reviews)

**Code:**
```typescript
const validationResult = await validationAgent.validate({
  itemType: 'rating',
  item: ratingData,
  context: { userId, userHistory }
})
```

---

### 6. Resource Submission - Content Validation

**Location:** `/app/api/resources/new/route.ts`

**What happens:**
- When user submits a new resource, **Validation Agent** validates:
  - Content quality
  - Spam detection
  - Duplicate detection
  - User trust score
- Resource is saved with status 'pending' and added to moderation queue
- Agent's decision and reasoning are stored for admin review

**User sees:**
- Submission confirmation message
- Explanation that resources need approval

**Code:**
```typescript
const validationResult = await validationAgent.validate({
  itemType: 'resource',
  item: resourceData,
  context: { userId, userHistory }
})
```

---

### 7. Admin Moderation Dashboard

**Location:** `/app/admin/moderation/page.tsx`

**What happens:**
- Shows items flagged by Validation Agent
- Displays agent's reasoning and confidence scores
- Admins can override agent decisions
- Feedback loop tracks agent accuracy

**Admin sees:**
- List of items needing review
- Agent decision (approve/reject/flag)
- Agent reasoning and confidence
- Option to approve/reject manually

---

### 8. Embeddings - Local AI Model

**Location:** `/lib/embeddings/generator.ts`

**What happens:**
- Uses **Xenova/all-MiniLM-L6-v2** model (local, free, no API costs)
- Generates 384-dimensional embeddings for:
  - User barrier profiles
  - Resource descriptions
  - Search queries
- Enables semantic similarity and vector search

**User impact:**
- Better search results (semantic matching)
- More accurate recommendations (similarity matching)
- No API costs (runs locally)

**Code:**
```typescript
const embedding = await generateBarrierEmbedding(barriers)
const similarity = cosineSimilarity(embedding1, embedding2)
```

---

### 9. Onboarding - User Embedding Generation

**Location:** `/app/api/onboarding/complete/route.ts`

**What happens:**
- When user completes onboarding, their barrier profile is converted to an embedding
- Embedding captures full intersectional profile (all barriers combined)
- Stored in `user_embeddings` table for similarity matching

**User impact:**
- Enables finding users with similar barrier profiles
- Powers recommendation system
- Enables pattern discovery

**Code:**
```typescript
generateUserEmbeddingJob(user.id).catch((error) => {
  console.error('Error generating user embedding:', error)
})
```

---

### 10. Resource Creation - Resource Embedding Generation

**Location:** `/lib/embeddings/auto-generate.ts` → `onResourceCreated()`

**What happens:**
- When a resource is created/approved, embedding is generated automatically
- Embedding captures resource name, description, category, characteristics
- Stored in `resource_embeddings` table for similarity search

**User impact:**
- Enables semantic search
- Powers "similar resources" feature
- Improves recommendation quality

---

## Agent Architecture

### Orchestrator Flow

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

### API Endpoints

- `POST /api/orchestrator` - Main entry point for all agent requests
- `GET /api/agents/recommendations` - Get recommendations
- `GET /api/agents/patterns` - Get discovered patterns
- `POST /api/agents/validate` - Validate content

---

## Vector Database Integration

All AI features leverage **pgvector** (Supabase's vector extension):

- **User Embeddings**: Stored in `user_embeddings` table
- **Resource Embeddings**: Stored in `resource_embeddings` table
- **Similarity Search**: Uses cosine similarity via pgvector functions
- **Semantic Search**: Converts queries to embeddings, finds similar resources

---

## Future Upgrade Path

Current rule-based implementations can be upgraded to:

1. **LLM-Powered Agents** (Claude, GPT)
   - Replace scoring algorithms with LLM calls
   - Generate natural language explanations
   - Context-aware reasoning

2. **ML Clustering** (Pattern Agent)
   - Replace statistical analysis with k-means, DBSCAN
   - Discover more complex patterns

3. **Advanced Validation** (Validation Agent)
   - ML-powered fraud detection
   - Adaptive learning from admin overrides

4. **Parallel Execution** (Orchestrator)
   - Message queues (RabbitMQ)
   - Parallel agent execution
   - Better conflict resolution

---

## Summary

AI is used throughout ServiceHub to:
- **Personalize** recommendations based on user barriers
- **Discover** patterns in community data
- **Validate** content quality and catch spam
- **Search** semantically (understand query meaning)
- **Match** users with similar barriers and resources

All AI features use **free, local models** (no API costs) and are designed to be easily upgraded to full LLM-powered agents post-funding.
